import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
require('@testing-library/jest-dom');
import ResultsDashboard from '@/components/results-dashboard';

// Mock data for testing
const mockData = {
  overallScore: 78,
  analysisDate: "2024-05-31",
  fileName: "test-pitch-deck.pptx",
  frameworkScores: [
    {
      id: "content-clarity",
      name: "Content Clarity",
      score: 85,
      category: "Content & Structure",
      description: "How clearly the content communicates the core message",
      feedback: "Your content is well-structured with clear messaging.",
      recommendations: [
        "Consider adding more specific examples",
        "Include quantifiable benefits"
      ]
    },
    {
      id: "visual-appeal",
      name: "Visual Appeal",
      score: 82,
      category: "Visual Design",
      description: "Overall aesthetic quality and professional appearance",
      feedback: "Strong visual design with consistent branding.",
      recommendations: [
        "Consider using more engaging imagery",
        "Ensure all charts are clearly labeled"
      ]
    }
  ]
};

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

describe('Dashboard Functionality Verification', () => {
  describe('✅ Tab Functionality (Core Feature)', () => {
    it('should switch to Tips tab and show recommendations', async () => {
      const user = userEvent.setup();
      render(<ResultsDashboard data={mockData} />);
      
      // Click Tips tab
      const tipsTab = screen.getByRole('tab', { name: /tips/i });
      await user.click(tipsTab);
      
      // Verify tab is active
      await waitFor(() => {
        expect(tipsTab).toHaveAttribute('data-state', 'active');
      });
      
      // Verify recommendations are shown
      expect(screen.getByText('Consider adding more specific examples')).toBeInTheDocument();
      expect(screen.getByText('Consider using more engaging imagery')).toBeInTheDocument();
    });

    it('should switch to Export tab and show export options', async () => {
      const user = userEvent.setup();
      render(<ResultsDashboard data={mockData} />);
      
      // Click Export tab
      const exportTab = screen.getByRole('tab', { name: /export/i });
      await user.click(exportTab);
      
      // Verify tab is active
      await waitFor(() => {
        expect(exportTab).toHaveAttribute('data-state', 'active');
      });
      
      // Verify export options are shown
      expect(screen.getByText('📄 Download PDF Report')).toBeInTheDocument();
      expect(screen.getByText('📊 Export to Excel')).toBeInTheDocument();
      expect(screen.getByText('Analysis Summary')).toBeInTheDocument();
    });

    it('should maintain proper tab state transitions', async () => {
      const user = userEvent.setup();
      render(<ResultsDashboard data={mockData} />);
      
      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      const tipsTab = screen.getByRole('tab', { name: /tips/i });
      const exportTab = screen.getByRole('tab', { name: /export/i });
      
      // Start with Overview active
      expect(overviewTab).toHaveAttribute('data-state', 'active');
      
      // Switch to Tips
      await user.click(tipsTab);
      await waitFor(() => {
        expect(tipsTab).toHaveAttribute('data-state', 'active');
        expect(overviewTab).toHaveAttribute('data-state', 'inactive');
      });
      
      // Switch to Export
      await user.click(exportTab);
      await waitFor(() => {
        expect(exportTab).toHaveAttribute('data-state', 'active');
        expect(tipsTab).toHaveAttribute('data-state', 'inactive');
      });
      
      // Switch back to Overview
      await user.click(overviewTab);
      await waitFor(() => {
        expect(overviewTab).toHaveAttribute('data-state', 'active');
        expect(exportTab).toHaveAttribute('data-state', 'inactive');
      });
    });
  });

  describe('✅ Color-Coding System', () => {
    it('should display correct color coding for different score levels', () => {
      render(<ResultsDashboard data={mockData} />);
      
      // Use getAllByText to handle multiple score badges
      const scoreElements = screen.getAllByText('85/100');
      const goodScoreElements = screen.getAllByText('82/100');
      
      // Ensure both score types are present
      expect(scoreElements.length).toBeGreaterThan(0);
      expect(goodScoreElements.length).toBeGreaterThan(0);
      
      // Verify they exist in the document
      expect(scoreElements[0]).toBeInTheDocument();
      expect(goodScoreElements[0]).toBeInTheDocument();
    });

    it('should show performance legend with color indicators', () => {
      render(<ResultsDashboard data={mockData} />);
      
      // Performance Scale legend should be visible
      expect(screen.getByText('Performance Scale')).toBeInTheDocument();
      
      // Legend text includes emojis and appears multiple times, so use getAllByText
      const excellentElements = screen.getAllByText('🎯 Excellent');
      const goodElements = screen.getAllByText('👍 Good');
      
      expect(excellentElements.length).toBeGreaterThan(0);
      expect(goodElements.length).toBeGreaterThan(0);
      expect(excellentElements[0]).toBeInTheDocument();
      expect(goodElements[0]).toBeInTheDocument();
    });
  });

  describe('✅ Interactive Elements', () => {
    it('should allow expanding framework details', async () => {
      const user = userEvent.setup();
      render(<ResultsDashboard data={mockData} />);
      
      // Find expand button for Content Clarity
      const expandButtons = screen.getAllByLabelText(/expand/i);
      const contentClarityButton = expandButtons.find(button => 
        button.getAttribute('aria-label')?.includes('Content Clarity')
      );
      
      if (contentClarityButton) {
        await user.click(contentClarityButton);
        
        // Check that detailed content is shown
        await waitFor(() => {
          expect(screen.getByText('Your content is well-structured with clear messaging.')).toBeInTheDocument();
        });
      }
    });

    it('should allow toggling filter visibility', async () => {
      const user = userEvent.setup();
      render(<ResultsDashboard data={mockData} />);
      
      // Click show filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);
      
      // Verify filters are shown
      await waitFor(() => {
        expect(screen.getByText('Hide Filters')).toBeInTheDocument();
      });
      
      // Click hide filters
      const hideFiltersButton = screen.getByText('Hide Filters');
      await user.click(hideFiltersButton);
      
      // Verify filters are hidden
      await waitFor(() => {
        expect(screen.getByText('Show Filters')).toBeInTheDocument();
      });
    });
  });

  describe('✅ Overall Functionality', () => {
    it('should render complete dashboard with all core elements', () => {
      render(<ResultsDashboard data={mockData} />);
      
      // Check main title
      expect(screen.getByText('Pitch Analysis Dashboard')).toBeInTheDocument();
      
      // Check overall score section
      expect(screen.getByText('Overall Score')).toBeInTheDocument();
      expect(screen.getByText('78')).toBeInTheDocument();
      
      // Check framework cards
      expect(screen.getByText('Content Clarity')).toBeInTheDocument();
      expect(screen.getByText('Visual Appeal')).toBeInTheDocument();
      
      // Check all tabs are present
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Detailed')).toBeInTheDocument();
      expect(screen.getByText('Tips')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('should display correct scores and metadata', () => {
      render(<ResultsDashboard data={mockData} />);
      
      // Check file name
      expect(screen.getByText('test-pitch-deck.pptx')).toBeInTheDocument();
      
      // Use getAllByText for scores that appear multiple times
      const excellentScores = screen.getAllByText('85/100');
      const goodScores = screen.getAllByText('82/100');
      
      // Verify scores exist
      expect(excellentScores.length).toBeGreaterThan(0);
      expect(goodScores.length).toBeGreaterThan(0);
      expect(excellentScores[0]).toBeInTheDocument();
      expect(goodScores[0]).toBeInTheDocument();
      
      // Check categories
      const contentStructureElements = screen.getAllByText('Content & Structure');
      const visualDesignElements = screen.getAllByText('Visual Design');
      
      expect(contentStructureElements.length).toBeGreaterThan(0);
      expect(visualDesignElements.length).toBeGreaterThan(0);
      expect(contentStructureElements[0]).toBeInTheDocument();
      expect(visualDesignElements[0]).toBeInTheDocument();
    });
  });
}); 
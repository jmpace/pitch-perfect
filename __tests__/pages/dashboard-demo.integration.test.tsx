import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
require('@testing-library/jest-dom');

// Import the actual page component
import DashboardDemo from '@/app/dashboard-demo/page';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

describe('Dashboard Demo Page Integration Test', () => {
  it('should render the page and allow tab switching', async () => {
    const user = userEvent.setup();
    
    // Render the actual page component
    render(<DashboardDemo />);
    
    // Verify page renders
    expect(screen.getByText('Pitch Analysis Dashboard')).toBeInTheDocument();
    
    // Check that tabs are present
    const tipsTab = screen.getByRole('tab', { name: /tips/i });
    const exportTab = screen.getByRole('tab', { name: /export/i });
    
    expect(tipsTab).toBeInTheDocument();
    expect(exportTab).toBeInTheDocument();
    
    console.log('Before clicking Tips tab:');
    console.log('Tips tab state:', tipsTab.getAttribute('data-state'));
    console.log('Tips tab classes:', tipsTab.className);
    
    // Try clicking Tips tab
    await user.click(tipsTab);
    
    console.log('After clicking Tips tab:');
    console.log('Tips tab state:', tipsTab.getAttribute('data-state'));
    console.log('Tips tab classes:', tipsTab.className);
    
    // Check if tab state changed
    await waitFor(() => {
      expect(tipsTab).toHaveAttribute('data-state', 'active');
    }, { timeout: 5000 });
    
    // Check if Tips content is visible
    expect(screen.getByText('Consider adding more specific examples to illustrate key points')).toBeInTheDocument();
  });

  it('should debug tab click behavior at page level', async () => {
    const user = userEvent.setup();
    render(<DashboardDemo />);
    
    // Get all tabs
    const allTabs = screen.getAllByRole('tab');
    console.log('Found tabs:', allTabs.map(tab => ({
      name: tab.textContent,
      state: tab.getAttribute('data-state'),
      ariaSelected: tab.getAttribute('aria-selected'),
      disabled: tab.hasAttribute('disabled'),
      tabIndex: tab.getAttribute('tabindex')
    })));
    
    const tipsTab = screen.getByRole('tab', { name: /tips/i });
    
    // Try multiple click methods
    console.log('Trying different click methods...');
    
    // Method 1: userEvent.click
    await user.click(tipsTab);
    console.log('After userEvent.click:', tipsTab.getAttribute('data-state'));
    
    // Method 2: Direct event dispatch
    tipsTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    console.log('After direct click dispatch:', tipsTab.getAttribute('data-state'));
    
    // Method 3: Focus and enter
    tipsTab.focus();
    await user.keyboard('{Enter}');
    console.log('After focus + enter:', tipsTab.getAttribute('data-state'));
    
    // Check if any event listeners are attached
    console.log('Tab event listeners:', Object.getOwnPropertyNames(tipsTab).filter(prop => prop.startsWith('on')));
  });
}); 
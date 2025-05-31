/**
 * Integration Tests for Recommendation System
 * 
 * Tests the complete recommendation system workflow including:
 * - Recommendation generation and prioritization
 * - Template rendering and configuration
 * - Timeline integration and scheduling
 * - End-to-end user scenarios
 */

import {
  RecommendationPrioritizer,
  PrioritizationContext,
  PITCH_OPTIMIZATION_WEIGHTS
} from '../../lib/recommendation-prioritization';
import {
  renderRecommendationTemplate,
  renderRecommendationList,
  selectOptimalTemplate,
  RecommendationTemplateRegistry,
  createDefaultConfig
} from '../../lib/recommendation-templates/resolver';
import {
  TimelineIntegrationService
} from '../../lib/recommendation-timeline-integration';
import { TimelineUtilsImpl } from '../../lib/recommendation-timeline-utils';
import { Recommendation, RecommendationSet } from '../../lib/recommendation-engine';
import { ComprehensiveFrameworkScore, FrameworkScore } from '../../lib/scoring-framework';

// Mock individual framework scores
const mockIndividualScores: FrameworkScore[] = [
  {
    pointId: 'content_market_opportunity',
    score: 5.5,
    rationale: 'Market size data is unclear',
    improvementSuggestions: ['Add TAM/SAM data', 'Include market research'],
    confidence: 0.9
  },
  {
    pointId: 'content_financials_projections',
    score: 6.0,
    rationale: 'Financial projections need more detail',
    improvementSuggestions: ['Add unit economics', 'Include sensitivity analysis'],
    confidence: 0.85
  },
  {
    pointId: 'content_team_expertise',
    score: 8.5,
    rationale: 'Strong team with relevant experience',
    improvementSuggestions: ['Add advisor credentials'],
    confidence: 0.7
  },
  {
    pointId: 'speech_filler_words',
    score: 8.0,
    rationale: 'Good control of filler words',
    improvementSuggestions: ['Practice strategic pauses'],
    confidence: 0.8
  }
];

// Mock comprehensive framework score
const mockFrameworkScore: ComprehensiveFrameworkScore = {
  sessionId: 'test-session',
  overallScore: 7.2,
  categoryScores: {
    content: 6.8,
    speech: 7.5,
    visual: 7.8,
    overall: 7.2
  },
  individualScores: mockIndividualScores,
  analysisTimestamp: new Date(),
  processingTime: 150
};

// Mock recommendations for testing
const mockRecommendations: Recommendation[] = [
  {
    id: '1',
    type: 'critical_issue',
    category: 'content',
    priority: 'critical',
    title: 'Clarify Market Size and Opportunity',
    description: 'The market opportunity section lacks specific data and compelling metrics that investors need to assess the business potential.',
    actionableSteps: [
      'Research and include Total Addressable Market (TAM) data',
      'Add Serviceable Addressable Market (SAM) calculations',
      'Include competitive landscape analysis',
      'Provide market growth projections with sources'
    ],
    estimatedImpact: 'high',
    estimatedEffort: 'high',
    relatedFrameworkPoints: ['content_market_opportunity'],
    confidence: 0.9
  },
  {
    id: '2',
    type: 'quick_win',
    category: 'speech',
    priority: 'medium',
    title: 'Reduce Filler Words',
    description: 'Minimize use of "um," "uh," and "like" to improve professional delivery and audience engagement.',
    actionableSteps: [
      'Practice with recording device to identify patterns',
      'Use strategic pauses instead of filler words',
      'Rehearse key sections until smooth'
    ],
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    relatedFrameworkPoints: ['speech_filler_words'],
    confidence: 0.8
  },
  {
    id: '3',
    type: 'strength_to_leverage',
    category: 'content',
    priority: 'low',
    title: 'Emphasize Team Expertise',
    description: 'Your team section is already strong. Leverage this strength by connecting team expertise more explicitly to execution capability.',
    actionableSteps: [
      'Add specific examples of relevant experience',
      'Connect team background to key challenges',
      'Include advisor or board member credentials'
    ],
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    relatedFrameworkPoints: ['content_team_expertise'],
    confidence: 0.7
  },
  {
    id: '4',
    type: 'high_impact_improvement',
    category: 'content',
    priority: 'high',
    title: 'Strengthen Financial Projections',
    description: 'Financial projections need more detailed assumptions and realistic growth scenarios to build investor confidence.',
    actionableSteps: [
      'Break down revenue assumptions by customer segment',
      'Include sensitivity analysis for key variables',
      'Add unit economics and customer acquisition costs',
      'Provide 3-year detailed projections'
    ],
    estimatedImpact: 'high',
    estimatedEffort: 'high',
    relatedFrameworkPoints: ['content_financials_projections'],
    confidence: 0.85
  }
];

// Mock prioritization context
const mockContext: PrioritizationContext = {
  userProfile: {
    experienceLevel: 'intermediate',
    focusAreas: ['content', 'delivery'],
    timeToPresentation: 7
  },
  presentationContext: {
    audienceType: 'investors',
    presentationLength: 10,
    criticality: 'high'
  },
  frameworkScore: mockFrameworkScore
};

// Helper function to create mock recommendation set
function createMockRecommendationSet(): RecommendationSet {
  return {
    sessionId: 'mock-session',
    overallAssessment: {
      primaryStrengths: ['Strong team', 'Clear problem statement'],
      primaryWeaknesses: ['Market size unclear', 'Financial projections weak'],
      scorePercentile: 72,
      competitivePosition: 'Above average'
    },
    recommendations: [
      {
        id: '1',
        type: 'critical_issue',
        category: 'content',
        priority: 'critical',
        title: 'Test Critical Issue',
        description: 'Test description',
        actionableSteps: ['Step 1', 'Step 2'],
        estimatedImpact: 'high',
        estimatedEffort: 'medium',
        relatedFrameworkPoints: ['content_market_opportunity'],
        confidence: 0.9
      },
      {
        id: '2',
        type: 'quick_win',
        category: 'speech',
        priority: 'medium',
        title: 'Test Quick Win',
        description: 'Test description',
        actionableSteps: ['Step 1'],
        estimatedImpact: 'medium',
        estimatedEffort: 'low',
        relatedFrameworkPoints: ['speech_filler_words'],
        confidence: 0.8
      }
    ],
    categorizedRecommendations: {
      critical: [],
      high: [],
      medium: [],
      low: []
    },
    quickWins: [],
    generatedAt: new Date(),
    totalRecommendations: 2
  };
}

describe('Recommendation System Integration Tests', () => {
  let prioritizer: RecommendationPrioritizer;
  let templateRegistry: RecommendationTemplateRegistry;
  let timelineService: TimelineIntegrationService;
  let timelineUtils: TimelineUtilsImpl;

  beforeEach(() => {
    prioritizer = new RecommendationPrioritizer(PITCH_OPTIMIZATION_WEIGHTS);
    templateRegistry = new RecommendationTemplateRegistry();
    timelineService = new TimelineIntegrationService();
    timelineUtils = new TimelineUtilsImpl();
  });

  describe('End-to-End Recommendation Workflow', () => {
    test('should process recommendations from generation to rendering', () => {
      // Step 1: Prioritize recommendations
      const prioritizedRecs = prioritizer.prioritizeRecommendations(mockRecommendations, mockContext);
      
      expect(prioritizedRecs).toHaveLength(4);
      expect(prioritizedRecs[0].priorityScore).toBeGreaterThan(prioritizedRecs[1].priorityScore);
      
      // Step 2: Select optimal templates for each recommendation
      const templatedRecs = prioritizedRecs.map(rec => {
        const config = selectOptimalTemplate(rec, 'dashboard', 'intermediate');
        return { recommendation: rec, config };
      });
      
      expect(templatedRecs).toHaveLength(4);
      expect(templatedRecs[0].config.variant).toBeDefined();
      
      // Step 3: Render templates
      const renderedTemplates = templatedRecs.map(({ recommendation, config }) => {
        return renderRecommendationTemplate(recommendation, config, {
          sessionId: 'integration-test',
          totalRecommendations: prioritizedRecs.length,
          userProfile: {
            experienceLevel: 'intermediate',
            focusAreas: ['content', 'delivery']
          }
        });
      });
      
      expect(renderedTemplates).toHaveLength(4);
      renderedTemplates.forEach(template => {
        expect(template.content).toBeDefined();
        expect(template.metadata.templateId).toBeDefined();
        expect(template.metadata.renderTime).toBeGreaterThan(0);
      });
      
      // Step 4: Initialize timeline with recommendations
      const recommendationSet = createMockRecommendationSet();
      timelineService.initializeTimeline(recommendationSet);
      
      const timelineRecs = timelineService.getRecommendations();
      expect(timelineRecs.length).toBeGreaterThan(0);
    });

    test('should handle different user experience levels consistently', () => {
      const userLevels = ['beginner', 'intermediate', 'advanced'] as const;
      
      userLevels.forEach(level => {
        // Prioritize with user level context
        const contextWithLevel = {
          ...mockContext,
          userProfile: { ...mockContext.userProfile, experienceLevel: level }
        };
        
        const prioritizedRecs = prioritizer.prioritizeRecommendations(mockRecommendations, contextWithLevel);
        
        // Template selection should respect user level
        const config = selectOptimalTemplate(prioritizedRecs[0], 'results', level);
        expect(config.userLevel).toBe(level);
        
        // Rendering should work for all levels
        const rendered = renderRecommendationTemplate(prioritizedRecs[0], config, {
          sessionId: `test-${level}`,
          userProfile: { experienceLevel: level }
        });
        
        expect(rendered.content).toBeDefined();
      });
    });

    test('should handle different display contexts appropriately', () => {
      const contexts = ['dashboard', 'results', 'modal', 'mobile', 'print'] as const;
      const prioritizedRecs = prioritizer.prioritizeRecommendations(mockRecommendations, mockContext);
      
      contexts.forEach(context => {
        const config = selectOptimalTemplate(prioritizedRecs[0], context);
        expect(config.context).toBe(context);
        
        // Context-specific adjustments should be applied
        if (context === 'mobile') {
          expect(config.showMetrics).toBe(false);
          expect(config.maxActionSteps).toBe(3);
        }
        
        if (context === 'print') {
          expect(config.variant).toBe('export');
          expect(config.enableInteractions).toBe(false);
        }
        
        // Rendering should work for all contexts
        const rendered = renderRecommendationTemplate(prioritizedRecs[0], config, {
          sessionId: `test-${context}`,
          userProfile: { experienceLevel: 'intermediate' }
        });
        
        expect(rendered.content).toBeDefined();
      });
    });
  });

  describe('Timeline Integration Scenarios', () => {
    test('should integrate prioritized recommendations with timeline scheduling', () => {
      // Generate prioritized recommendations
      const prioritizedRecs = prioritizer.prioritizeRecommendations(mockRecommendations, mockContext);
      
      // Create timeline-compatible recommendation set
      const timelineRecs = prioritizedRecs.map(rec => ({
        ...rec,
        timeline: {
          scheduledTime: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in next week
          estimatedDuration: 30 + Math.floor(Math.random() * 60), // 30-90 minutes
          dependencies: rec.prerequisiteRecommendations || []
        },
        status: 'scheduled' as const
      }));
      
      const recommendationSet = createMockRecommendationSet();
      
      // Initialize timeline service
      timelineService.initializeTimeline(recommendationSet);
      
      // Test filtering by priority
      const criticalRecs = timelineUtils.filterRecommendations(timelineRecs, { 
        priority: ['critical'] 
      });
      expect(criticalRecs.length).toBeGreaterThanOrEqual(0);
      
      // Test upcoming recommendations
      const upcoming = timelineUtils.getUpcomingRecommendations(timelineRecs, 60); // Next hour
      expect(Array.isArray(upcoming)).toBe(true);
      
      // Test rescheduling
      if (timelineRecs.length > 0) {
        const newTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
        const rescheduled = timelineUtils.rescheduleRecommendation(timelineRecs[0], newTime, 'Integration test reschedule');
        
        expect(rescheduled.timeline.scheduledTime).toEqual(newTime);
        expect(rescheduled.progress?.notes).toContainEqual(
          expect.stringContaining('Integration test reschedule')
        );
      }
    });

    test('should handle recommendation completion workflow', () => {
      const recommendationSet = createMockRecommendationSet();
      timelineService.initializeTimeline(recommendationSet);
      
      // Get initial recommendations
      const initialRecs = timelineService.getRecommendations();
      expect(initialRecs.length).toBeGreaterThan(0);
      
      // Complete a recommendation
      const targetRec = initialRecs[0];
      timelineService.handleEvent({
        type: 'COMPLETE_RECOMMENDATION',
        payload: {
          id: targetRec.id,
          completedAt: new Date(),
          notes: 'Integration test completion'
        }
      });
      
      // Verify completion (need to show completed items)
      const serviceWithCompleted = new TimelineIntegrationService({ showCompleted: true });
      serviceWithCompleted.initializeTimeline(recommendationSet);
      serviceWithCompleted.handleEvent({
        type: 'COMPLETE_RECOMMENDATION',
        payload: {
          id: targetRec.id,
          completedAt: new Date(),
          notes: 'Integration test completion'
        }
      });
      
      const updatedRecs = serviceWithCompleted.getRecommendations();
      const completedRec = updatedRecs.find(r => r.id === targetRec.id);
      
      expect(completedRec?.status).toBe('completed');
      expect(completedRec?.progress?.notes).toContain('Integration test completion');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large recommendation sets efficiently', () => {
      // Generate a larger set of recommendations
      const largeRecommendationSet = Array.from({ length: 50 }, (_, i) => ({
        ...mockRecommendations[i % mockRecommendations.length],
        id: `rec-${i}`,
        title: `Recommendation ${i + 1}`
      }));
      
      const startTime = performance.now();
      
      // Prioritize large set
      const prioritized = prioritizer.prioritizeRecommendations(largeRecommendationSet, mockContext);
      
      const prioritizationTime = performance.now() - startTime;
      expect(prioritizationTime).toBeLessThan(1000); // Should complete within 1 second
      expect(prioritized).toHaveLength(50);
      
      // Batch render templates
      const renderStartTime = performance.now();
      const config = createDefaultConfig('summary', 'dashboard');
      
      const rendered = renderRecommendationList(prioritized, config, {
        sessionId: 'performance-test',
        totalRecommendations: prioritized.length,
        userProfile: { experienceLevel: 'intermediate' }
      });
      
      const renderTime = performance.now() - renderStartTime;
      expect(renderTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(rendered).toHaveLength(50);
      
      // Verify all templates rendered successfully
      rendered.forEach(template => {
        expect(template.content).toBeDefined();
        expect(template.metadata.renderTime).toBeGreaterThan(0);
      });
    });

    test('should maintain consistent prioritization across multiple runs', () => {
      const runs = 5;
      const results = [];
      
      for (let i = 0; i < runs; i++) {
        const prioritized = prioritizer.prioritizeRecommendations(mockRecommendations, mockContext);
        results.push(prioritized.map(r => ({ id: r.id, score: r.priorityScore })));
      }
      
      // Verify consistency across runs
      for (let i = 1; i < runs; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty recommendation sets gracefully', () => {
      const emptyPrioritized = prioritizer.prioritizeRecommendations([], mockContext);
      expect(emptyPrioritized).toHaveLength(0);
      
      const emptyRendered = renderRecommendationList([], createDefaultConfig('summary', 'dashboard'), {
        sessionId: 'empty-test',
        userProfile: { experienceLevel: 'intermediate' }
      });
      expect(emptyRendered).toHaveLength(0);
      
      // Timeline should handle empty sets
      const emptySet: RecommendationSet = {
        sessionId: 'empty-test',
        overallAssessment: {
          primaryStrengths: [],
          primaryWeaknesses: []
        },
        recommendations: [],
        categorizedRecommendations: {
          critical: [],
          high: [],
          medium: [],
          low: []
        },
        quickWins: [],
        generatedAt: new Date(),
        totalRecommendations: 0
      };
      
      expect(() => timelineService.initializeTimeline(emptySet)).not.toThrow();
      expect(timelineService.getRecommendations()).toHaveLength(0);
    });

    test('should handle malformed recommendation data', () => {
      const malformedRec: Partial<Recommendation> = {
        id: 'malformed',
        type: 'critical_issue',
        title: 'Test',
        // Missing required fields like relatedFrameworkPoints, actionableSteps, etc.
      };
      
      // Prioritizer should throw error for malformed data
      expect(() => {
        prioritizer.prioritizeRecommendations([malformedRec as Recommendation], mockContext);
      }).toThrow();
    });

    test('should handle invalid template configurations', () => {
      const prioritized = prioritizer.prioritizeRecommendations(mockRecommendations, mockContext);
      const invalidConfig = {
        variant: 'invalid' as any,
        context: 'dashboard' as any
      };
      
      // Should throw error for invalid configuration
      expect(() => {
        renderRecommendationTemplate(prioritized[0], invalidConfig, {
          sessionId: 'error-test',
          userProfile: { experienceLevel: 'intermediate' }
        });
      }).toThrow();
    });
  });

  describe('Cross-Component Data Flow', () => {
    test('should maintain data integrity across component boundaries', () => {
      // Start with raw recommendations
      const originalIds = mockRecommendations.map(r => r.id);
      
      // Prioritize
      const prioritized = prioritizer.prioritizeRecommendations(mockRecommendations, mockContext);
      const prioritizedIds = prioritized.map(r => r.id);
      
      // Verify no recommendations lost or duplicated
      expect(prioritizedIds.sort()).toEqual(originalIds.sort());
      
      // Render templates
      const config = createDefaultConfig('summary', 'dashboard');
      const rendered = renderRecommendationList(prioritized, config, {
        sessionId: 'data-flow-test',
        userProfile: { experienceLevel: 'intermediate' }
      });
      
      // Verify template metadata references correct recommendations
      rendered.forEach((template, index) => {
        expect(template.metadata.templateId).toContain(prioritized[index].type);
      });
      
      // Timeline integration
      const timelineRecs = prioritized.map(rec => ({
        ...rec,
        timeline: {
          scheduledTime: new Date(),
          estimatedDuration: 30
        },
        status: 'scheduled' as const
      }));
      
      const recommendationSet: RecommendationSet = {
        sessionId: 'data-flow-test',
        overallAssessment: {
          primaryStrengths: ['Test strength'],
          primaryWeaknesses: ['Test weakness']
        },
        recommendations: timelineRecs,
        categorizedRecommendations: {
          critical: [],
          high: [],
          medium: [],
          low: []
        },
        quickWins: [],
        generatedAt: new Date(),
        totalRecommendations: timelineRecs.length
      };
      
      timelineService.initializeTimeline(recommendationSet);
      const timelineResult = timelineService.getRecommendations();
      
      // Verify timeline preserves recommendation data
      expect(timelineResult.map(r => r.id).sort()).toEqual(originalIds.sort());
    });
  });
}); 
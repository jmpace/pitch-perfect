/**
 * Tests for Timeline Integration for Recommendation System
 * 
 * Validates all timeline functionality including scheduling, filtering,
 * sorting, and integration with the existing recommendation system.
 */

import { timelineUtils } from '../../lib/recommendation-timeline-utils';
import { TimelineIntegrationService } from '../../lib/recommendation-timeline-integration';
import { 
  TimelineRecommendation,
  TimelineFilter,
  TimelineConfig,
  PresentationPhase 
} from '../../lib/recommendation-timeline';
import { RecommendationSet } from '../../lib/recommendation-engine';

describe('Timeline Utility Functions', () => {
  const mockRecommendations: TimelineRecommendation[] = [
    {
      id: '1',
      type: 'critical_issue',
      category: 'content',
      priority: 'critical',
      title: 'Fix Opening Hook',
      description: 'Improve the opening statement to capture attention',
      actionableSteps: ['Revise opening line', 'Add compelling statistic'],
      estimatedImpact: 'high',
      estimatedEffort: 'medium',
      relatedFrameworkPoints: ['opening_hook'],
      confidence: 0.9,
      timeline: {
        scheduledTime: new Date('2024-01-15T09:00:00'),
        estimatedDuration: 45,
        slideIndex: 1,
        contextualTriggers: {
          presentationPhase: 'preparation'
        }
      },
      status: 'scheduled',
      priorityScore: 11.5,
      impactMultiplier: 1.8,
      urgencyFactor: 0.9,
      implementationDifficulty: 6,
      investorRelevance: 9.5,
      timeToImplement: 1
    },
    {
      id: '2',
      type: 'quick_win',
      category: 'speech',
      priority: 'medium',
      title: 'Practice Pace',
      description: 'Slow down speaking pace for better comprehension',
      actionableSteps: ['Record practice session', 'Use metronome'],
      estimatedImpact: 'medium',
      estimatedEffort: 'low',
      relatedFrameworkPoints: ['speaking_pace'],
      confidence: 0.8,
      timeline: {
        scheduledTime: new Date('2024-01-15T10:00:00'),
        estimatedDuration: 20,
        contextualTriggers: {
          presentationPhase: 'practice'
        },
        prerequisites: ['1']
      },
      status: 'scheduled',
      priorityScore: 9.2,
      impactMultiplier: 1.3,
      urgencyFactor: 0.7,
      implementationDifficulty: 3,
      investorRelevance: 6.5,
      timeToImplement: 0.5
    },
    {
      id: '3',
      type: 'high_impact_improvement',
      category: 'visual',
      priority: 'high',
      title: 'Enhance Slide Design',
      description: 'Improve visual hierarchy and readability',
      actionableSteps: ['Use consistent fonts', 'Add white space'],
      estimatedImpact: 'high',
      estimatedEffort: 'high',
      relatedFrameworkPoints: ['visual_design'],
      confidence: 0.85,
      timeline: {
        deadline: new Date('2024-01-16T17:00:00'),
        estimatedDuration: 60,
        slideIndex: 3,
        contextualTriggers: {
          slideRange: [2, 5]
        }
      },
      status: 'scheduled',
      priorityScore: 10.1,
      impactMultiplier: 1.6,
      urgencyFactor: 0.8,
      implementationDifficulty: 4,
      investorRelevance: 7.0,
      timeToImplement: 2,
      progress: {
        completionPercentage: 30,
        notes: ['Started font consistency review']
      }
    }
  ];

  describe('Scheduling Functions', () => {
    test('scheduleRecommendation should set scheduled time and status', () => {
      const rec = mockRecommendations[0];
      const newTime = new Date('2024-01-16T14:00:00');
      
      const scheduled = timelineUtils.scheduleRecommendation(rec, newTime);
      
      expect(scheduled.timeline.scheduledTime).toEqual(newTime);
      expect(scheduled.status).toBe('scheduled');
    });

    test('rescheduleRecommendation should update time and add note', () => {
      const rec = mockRecommendations[0];
      const newTime = new Date('2024-01-16T15:00:00');
      const reason = 'Meeting conflict';
      
      const rescheduled = timelineUtils.rescheduleRecommendation(rec, newTime, reason);
      
      expect(rescheduled.timeline.scheduledTime).toEqual(newTime);
      expect(rescheduled.progress?.notes).toContainEqual(
        expect.stringContaining(reason)
      );
    });

    test('autoScheduleRecommendations should respect dependencies', () => {
      const config = {
        enabled: true,
        workingHours: [9, 17] as [number, number],
        breakBetweenTasks: 15,
        preferredDuration: 30
      };
      
      const scheduled = timelineUtils.autoScheduleRecommendations(mockRecommendations, config);
      
      // Recommendation 2 depends on 1, so should be scheduled after
      const rec1 = scheduled.find(r => r.id === '1');
      const rec2 = scheduled.find(r => r.id === '2');
      
      expect(rec1?.timeline.scheduledTime).toBeDefined();
      expect(rec2?.timeline.scheduledTime).toBeDefined();
      
      if (rec1?.timeline.scheduledTime && rec2?.timeline.scheduledTime) {
        expect(rec2.timeline.scheduledTime.getTime()).toBeGreaterThan(
          rec1.timeline.scheduledTime.getTime()
        );
      }
    });
  });

  describe('Filtering Functions', () => {
    test('filterRecommendations should filter by status', () => {
      const filter: TimelineFilter = {
        status: ['scheduled']
      };
      
      const filtered = timelineUtils.filterRecommendations(mockRecommendations, filter);
      
      expect(filtered).toHaveLength(3);
      expect(filtered.every(r => r.status === 'scheduled')).toBe(true);
    });

    test('filterRecommendations should filter by slide range', () => {
      const filter: TimelineFilter = {
        slideRange: [1, 2]
      };
      
      const filtered = timelineUtils.filterRecommendations(mockRecommendations, filter);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].timeline.slideIndex).toBe(1);
    });

    test('filterRecommendations should filter by time range', () => {
      const filter: TimelineFilter = {
        timeRange: {
          start: new Date('2024-01-15T16:00:00Z'),
          end: new Date('2024-01-15T19:00:00Z')
        }
      };
      
      const filtered = timelineUtils.filterRecommendations(mockRecommendations, filter);
      
      expect(filtered).toHaveLength(2); // Only items with scheduledTime in range
      expect(filtered.every(r => 
        r.timeline.scheduledTime &&
        r.timeline.scheduledTime >= filter.timeRange!.start &&
        r.timeline.scheduledTime <= filter.timeRange!.end
      )).toBe(true);
    });
  });

  describe('Sorting Functions', () => {
    test('sortRecommendations by chronological should order by scheduled time', () => {
      const sorted = timelineUtils.sortRecommendations(mockRecommendations, 'chronological');
      
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].timeline.scheduledTime?.getTime() || 0;
        const curr = sorted[i].timeline.scheduledTime?.getTime() || Infinity;
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });

    test('sortRecommendations by priority should order by priority score', () => {
      const sorted = timelineUtils.sortRecommendations(mockRecommendations, 'priority');
      
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].priorityScore || 0;
        const curr = sorted[i].priorityScore || 0;
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    test('sortRecommendations by slide_sequence should order by slide index', () => {
      const sorted = timelineUtils.sortRecommendations(mockRecommendations, 'slide_sequence');
      
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].timeline.slideIndex ?? Infinity;
        const curr = sorted[i].timeline.slideIndex ?? Infinity;
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });

    test('sortRecommendations by dependency should respect prerequisites', () => {
      const sorted = timelineUtils.sortRecommendations(mockRecommendations, 'dependency');
      
      // Recommendation 1 should come before recommendation 2 (which depends on 1)
      const rec1Index = sorted.findIndex(r => r.id === '1');
      const rec2Index = sorted.findIndex(r => r.id === '2');
      
      expect(rec1Index).toBeLessThan(rec2Index);
    });
  });

  describe('Context-aware Functions', () => {
    test('getContextualRecommendations should filter by presentation phase', () => {
      const context = { phase: 'preparation' };
      
      const contextual = timelineUtils.getContextualRecommendations(mockRecommendations, context);
      
      expect(contextual).toHaveLength(1); // Only items with matching presentation phase trigger
      const withTrigger = contextual.find(r => r.timeline.contextualTriggers?.presentationPhase === 'preparation');
      expect(withTrigger).toBeDefined();
    });

    test('getContextualRecommendations should filter by slide range', () => {
      const context = { slideIndex: 4 };
      
      const contextual = timelineUtils.getContextualRecommendations(mockRecommendations, context);
      
      expect(contextual).toHaveLength(1); // Only items with matching slide range trigger
      const withSlideRange = contextual.find(r => r.timeline.contextualTriggers?.slideRange);
      expect(withSlideRange?.timeline.contextualTriggers?.slideRange).toEqual([2, 5]);
    });

    test('getOverdueRecommendations should identify overdue items', () => {
      const futureTime = new Date();
      futureTime.setDate(futureTime.getDate() + 10);
      
      const overdueRecs = mockRecommendations.map(rec => ({
        ...rec,
        timeline: {
          ...rec.timeline,
          deadline: new Date('2024-01-01T12:00:00') // Past deadline
        }
      }));
      
      const overdue = timelineUtils.getOverdueRecommendations(overdueRecs);
      
      expect(overdue).toHaveLength(3);
    });

    test('getUpcomingRecommendations should find items within time window', () => {
      const fixedTime = new Date('2024-01-15T16:00:00Z');
      const futureRecs = mockRecommendations.map(rec => ({
        ...rec,
        timeline: {
          ...rec.timeline,
          scheduledTime: new Date('2024-01-15T18:00:00Z')
        },
        status: 'scheduled' as const
      }));
      
      // Use jest's system time mocking
      jest.useFakeTimers();
      jest.setSystemTime(fixedTime);
      
      const upcoming = timelineUtils.getUpcomingRecommendations(futureRecs, 4 * 60); // 4 hours
      
      expect(upcoming).toHaveLength(3);
      
      // Restore real timers
      jest.useRealTimers();
    });
  });

  describe('Progress Tracking', () => {
    test('updateProgress should merge progress data', () => {
      const rec = mockRecommendations[2];
      const newProgress = {
        completionPercentage: 50,
        timeSpent: 30,
        notes: ['Made significant progress']
      };
      
      const updated = timelineUtils.updateProgress(rec, newProgress);
      
      expect(updated.progress?.completionPercentage).toBe(50);
      expect(updated.progress?.timeSpent).toBe(30);
      expect(updated.progress?.notes).toContain('Made significant progress');
    });

    test('calculateCompletionStats should compute accurate statistics', () => {
      const mixedRecs = [
        { ...mockRecommendations[0], status: 'completed' as const },
        { ...mockRecommendations[1], status: 'active' as const },
        { ...mockRecommendations[2], status: 'scheduled' as const }
      ];
      
      const stats = timelineUtils.calculateCompletionStats(mixedRecs);
      
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.completionRate).toBeCloseTo(0.33, 2);
    });
  });

  describe('Dependency Validation', () => {
    test('validateTimelineDependencies should detect missing prerequisites', () => {
      const invalidRecs = [
        mockRecommendations[0],
        {
          ...mockRecommendations[1],
          timeline: {
            ...mockRecommendations[1].timeline,
            prerequisites: ['nonexistent']
          }
        }
      ];
      
      const validation = timelineUtils.validateTimelineDependencies(invalidRecs);
      
      expect(validation.valid).toBe(false);
      expect(validation.conflicts).toContainEqual(
        expect.stringContaining('nonexistent')
      );
    });

    test('validateTimelineDependencies should detect scheduling conflicts', () => {
      const conflictRecs = [
        {
          ...mockRecommendations[0],
          timeline: {
            ...mockRecommendations[0].timeline,
            scheduledTime: new Date('2024-01-15T11:00:00')
          }
        },
        {
          ...mockRecommendations[1],
          timeline: {
            ...mockRecommendations[1].timeline,
            scheduledTime: new Date('2024-01-15T10:00:00'),
            prerequisites: ['1']
          }
        }
      ];
      
      const validation = timelineUtils.validateTimelineDependencies(conflictRecs);
      
      expect(validation.valid).toBe(false);
      expect(validation.conflicts).toContainEqual(
        expect.stringContaining('scheduled before its prerequisite')
      );
    });
  });
});

describe('Timeline Integration Service', () => {
  let service: TimelineIntegrationService;
  
  const mockRecommendationSet: RecommendationSet = {
    sessionId: 'test-session',
    overallAssessment: {
      primaryStrengths: ['Clear structure'],
      primaryWeaknesses: ['Needs better opening'],
      scorePercentile: 75
    },
    recommendations: [
      {
        id: '1',
        type: 'critical_issue',
        category: 'content',
        priority: 'critical',
        title: 'Fix Opening Hook',
        description: 'Improve the opening statement',
        actionableSteps: ['Revise opening line'],
        estimatedImpact: 'high',
        estimatedEffort: 'medium',
        relatedFrameworkPoints: ['opening_hook'],
        confidence: 0.9
      },
      {
        id: '2',
        type: 'quick_win',
        category: 'speech',
        priority: 'medium',
        title: 'Practice Pace',
        description: 'Slow down speaking pace',
        actionableSteps: ['Record practice session'],
        estimatedImpact: 'medium',
        estimatedEffort: 'low',
        relatedFrameworkPoints: ['speaking_pace'],
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

  beforeEach(() => {
    service = new TimelineIntegrationService();
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      const state = service.getState();
      
      expect(state.config.viewType).toBe('chronological');
      expect(state.config.scope).toBe('all_pending');
      expect(state.presentationPhase).toBe('preparation');
    });

    test('should initialize timeline with recommendation set', () => {
      service.initializeTimeline(mockRecommendationSet);
      
      const recommendations = service.getRecommendations();
      
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].timeline).toBeDefined();
      expect(recommendations[0].status).toBe('scheduled');
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      service.initializeTimeline(mockRecommendationSet);
    });

    test('should handle SCHEDULE_RECOMMENDATION event', () => {
      const scheduledTime = new Date('2024-01-15T10:00:00');
      
      service.handleEvent({
        type: 'SCHEDULE_RECOMMENDATION',
        payload: { id: '1', scheduledTime }
      });
      
      const recommendations = service.getRecommendations();
      const scheduled = recommendations.find(r => r.id === '1');
      
      expect(scheduled?.timeline.scheduledTime).toEqual(scheduledTime);
    });

    test('should handle COMPLETE_RECOMMENDATION event', () => {
      const service = new TimelineIntegrationService({ showCompleted: true });
      service.initializeTimeline(mockRecommendationSet);
      
      const completedAt = new Date();
      const notes = 'Task completed successfully';
      
      service.handleEvent({
        type: 'COMPLETE_RECOMMENDATION',
        payload: {
          id: '1',
          completedAt,
          notes
        }
      });
      
      const recommendations = service.getRecommendations();
      const completed = recommendations.find(r => r.id === '1');
      
      expect(completed?.status).toBe('completed');
      expect(completed?.progress?.completedAt).toEqual(completedAt);
      expect(completed?.progress?.notes).toContain(notes);
    });

    test('should handle CHANGE_SLIDE event', () => {
      service.handleEvent({
        type: 'CHANGE_SLIDE',
        payload: { slideIndex: 3, timestamp: 45.5 }
      });
      
      const state = service.getState();
      
      expect(state.currentSlide).toBe(3);
      expect(state.currentTimestamp).toBe(45.5);
    });

    test('should handle CHANGE_PHASE event', () => {
      service.handleEvent({
        type: 'CHANGE_PHASE',
        payload: { phase: 'practice' }
      });
      
      const state = service.getState();
      
      expect(state.presentationPhase).toBe('practice');
    });
  });

  describe('Context-aware Recommendations', () => {
    beforeEach(() => {
      service.initializeTimeline(mockRecommendationSet);
    });

    test('should filter recommendations by current context', () => {
      // Set context
      service.handleEvent({
        type: 'CHANGE_PHASE',
        payload: { phase: 'preparation' }
      });
      
      const contextual = service.getContextualRecommendations();
      
      // Should include recommendations appropriate for preparation phase
      expect(contextual.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(() => {
      service.initializeTimeline(mockRecommendationSet);
    });

    test('should calculate completion statistics', () => {
      // Complete one recommendation
      service.handleEvent({
        type: 'COMPLETE_RECOMMENDATION',
        payload: { id: '1', completedAt: new Date() }
      });
      
      const stats = service.getCompletionStats();
      
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.completionRate).toBe(0.5);
    });
  });

  describe('Event Listeners', () => {
    test('should notify event listeners', () => {
      const listener = jest.fn();
      service.addEventListener(listener);
      
      service.handleEvent({
        type: 'CHANGE_PHASE',
        payload: { phase: 'practice' }
      });
      
      expect(listener).toHaveBeenCalledWith({
        type: 'CHANGE_PHASE',
        payload: { phase: 'practice' }
      });
    });

    test('should remove event listeners', () => {
      const listener = jest.fn();
      service.addEventListener(listener);
      service.removeEventListener(listener);
      
      service.handleEvent({
        type: 'CHANGE_PHASE',
        payload: { phase: 'practice' }
      });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('Timeline Integration Edge Cases', () => {
  test('should handle empty recommendation sets gracefully', () => {
    const emptySet: RecommendationSet = {
      sessionId: 'empty',
      overallAssessment: {
        primaryStrengths: [],
        primaryWeaknesses: []
      },
      recommendations: [],
      categorizedRecommendations: { critical: [], high: [], medium: [], low: [] },
      quickWins: [],
      generatedAt: new Date(),
      totalRecommendations: 0
    };
    
    const service = new TimelineIntegrationService();
    service.initializeTimeline(emptySet);
    
    const recommendations = service.getRecommendations();
    expect(recommendations).toHaveLength(0);
  });

  test('should handle recommendations without timeline properties', () => {
    const basicRec: TimelineRecommendation = {
      id: '1',
      type: 'quick_win',
      category: 'content',
      priority: 'low',
      title: 'Basic Recommendation',
      description: 'A simple recommendation',
      actionableSteps: ['Do something'],
      estimatedImpact: 'low',
      estimatedEffort: 'low',
      relatedFrameworkPoints: [],
      confidence: 0.5,
      timeline: {},
      status: 'scheduled',
      priorityScore: 5.0,
      impactMultiplier: 1.0,
      urgencyFactor: 0.5,
      implementationDifficulty: 2,
      investorRelevance: 3.0,
      timeToImplement: 1
    };
    
    const result = timelineUtils.scheduleRecommendation(basicRec, new Date());
    expect(result.timeline.scheduledTime).toBeDefined();
    expect(result.status).toBe('scheduled');
  });
}); 
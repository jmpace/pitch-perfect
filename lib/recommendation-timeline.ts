/**
 * Timeline Integration for Recommendation System
 * 
 * Extends the recommendation system with timeline and scheduling capabilities,
 * enabling recommendations to be associated with specific time points, deadlines,
 * and presentation sequences.
 */

import { 
  Recommendation, 
  RecommendationSet,
  RecommendationPriority,
  RecommendationType 
} from './recommendation-engine';
import { PrioritizedRecommendation } from './recommendation-prioritization';

// Timeline-specific properties for recommendations
export interface TimelineProperties {
  scheduledTime?: Date;           // When the recommendation is scheduled to be addressed
  deadline?: Date;                // Optional deadline for completion
  slideTimestamp?: number;        // Associated slide timestamp (in seconds)
  slideIndex?: number;            // Associated slide index
  estimatedDuration?: number;     // Estimated time to complete (in minutes)
  prerequisites?: string[];       // IDs of recommendations that must be completed first
  followUps?: string[];          // IDs of recommendations that should follow this one
  contextualTriggers?: {         // Conditions that trigger this recommendation
    slideRange?: [number, number]; // Show only when viewing specific slide range
    presentationPhase?: 'preparation' | 'practice' | 'delivery' | 'review';
    userProgress?: number;         // Show only when user has progressed past certain point (0-1)
  };
  recurrence?: {                 // For recurring recommendations
    type: 'daily' | 'weekly' | 'before_each_practice' | 'after_feedback';
    interval?: number;             // Days between recurrences
    endDate?: Date;               // When recurrence stops
  };
}

export type PresentationPhase = 'preparation' | 'practice' | 'delivery' | 'review';

// Timeline-enhanced recommendation interface
export interface TimelineRecommendation extends PrioritizedRecommendation {
  timeline: TimelineProperties;
  status: 'scheduled' | 'active' | 'completed' | 'skipped' | 'deferred';
  progress?: {
    startedAt?: Date;
    completedAt?: Date;
    completionPercentage?: number; // 0-100
    timeSpent?: number;            // Minutes spent working on this
    notes?: string[];              // User notes/progress updates
  };
}

// Timeline view configurations
export type TimelineViewType = 
  | 'chronological'    // Ordered by scheduled time
  | 'slide_sequence'   // Ordered by slide index/timestamp
  | 'priority'         // Ordered by priority score
  | 'dependency'       // Ordered by prerequisite dependencies
  | 'duration';        // Ordered by estimated duration

export type TimelineScope = 
  | 'today'           // Only today's recommendations
  | 'this_week'       // This week's recommendations
  | 'all_pending'     // All unCompleted recommendations
  | 'slide_focused'   // Based on currently viewed slide
  | 'contextual';     // Based on current presentation phase

// Timeline filter options
export interface TimelineFilter {
  status?: TimelineRecommendation['status'][];
  priority?: RecommendationPriority[];
  type?: RecommendationType[];
  slideRange?: [number, number];
  timeRange?: {
    start: Date;
    end: Date;
  };
  estimatedDuration?: {
    min?: number; // Minutes
    max?: number; // Minutes
  };
  hasDeadline?: boolean;
  overdue?: boolean;
}

// Timeline configuration for display and behavior
export interface TimelineConfig {
  viewType: TimelineViewType;
  scope: TimelineScope;
  filter?: TimelineFilter;
  groupBy?: 'date' | 'slide' | 'priority' | 'type' | 'status';
  showCompleted?: boolean;
  showProgress?: boolean;
  enableDragDrop?: boolean;      // Allow reordering recommendations
  enableQuickActions?: boolean;   // Show quick action buttons
  highlightOverdue?: boolean;
  autoScheduling?: {
    enabled: boolean;
    workingHours?: [number, number]; // [start, end] hours (24h format)
    breakBetweenTasks?: number;      // Minutes between tasks
    preferredDuration?: number;      // Preferred task duration in minutes
  };
}

// Timeline state management
export interface TimelineState {
  recommendations: TimelineRecommendation[];
  currentSlide?: number;
  currentTimestamp?: number;
  presentationPhase: PresentationPhase;
  userProgress: number; // 0-1
  config: TimelineConfig;
  lastUpdated: Date;
}

// Timeline events for state updates
export type TimelineEvent = 
  | { type: 'SCHEDULE_RECOMMENDATION'; payload: { id: string; scheduledTime: Date; } }
  | { type: 'COMPLETE_RECOMMENDATION'; payload: { id: string; completedAt: Date; notes?: string; } }
  | { type: 'START_RECOMMENDATION'; payload: { id: string; startedAt: Date; } }
  | { type: 'UPDATE_PROGRESS'; payload: { id: string; percentage: number; timeSpent?: number; } }
  | { type: 'CHANGE_SLIDE'; payload: { slideIndex: number; timestamp?: number; } }
  | { type: 'CHANGE_PHASE'; payload: { phase: PresentationPhase; } }
  | { type: 'DEFER_RECOMMENDATION'; payload: { id: string; newScheduledTime: Date; reason?: string; } }
  | { type: 'UPDATE_CONFIG'; payload: Partial<TimelineConfig>; }
  | { type: 'BULK_SCHEDULE'; payload: { recommendations: Array<{ id: string; scheduledTime: Date; }>; } };

// Timeline utility functions interface
export interface TimelineUtils {
  // Scheduling functions
  scheduleRecommendation(recommendation: TimelineRecommendation, scheduledTime: Date): TimelineRecommendation;
  rescheduleRecommendation(recommendation: TimelineRecommendation, newTime: Date, reason?: string): TimelineRecommendation;
  autoScheduleRecommendations(recommendations: TimelineRecommendation[], config: TimelineConfig['autoScheduling']): TimelineRecommendation[];
  
  // Filtering and sorting
  filterRecommendations(recommendations: TimelineRecommendation[], filter: TimelineFilter): TimelineRecommendation[];
  sortRecommendations(recommendations: TimelineRecommendation[], viewType: TimelineViewType): TimelineRecommendation[];
  groupRecommendations(recommendations: TimelineRecommendation[], groupBy: TimelineConfig['groupBy']): Record<string, TimelineRecommendation[]>;
  
  // Context-aware functions
  getContextualRecommendations(recommendations: TimelineRecommendation[], context: { slideIndex?: number; phase?: string; progress?: number; }): TimelineRecommendation[];
  getOverdueRecommendations(recommendations: TimelineRecommendation[]): TimelineRecommendation[];
  getUpcomingRecommendations(recommendations: TimelineRecommendation[], timeWindow?: number): TimelineRecommendation[];
  
  // Progress tracking
  updateProgress(recommendation: TimelineRecommendation, progress: Partial<TimelineRecommendation['progress']>): TimelineRecommendation;
  calculateCompletionStats(recommendations: TimelineRecommendation[]): {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
    averageTimeToComplete: number;
  };
  
  // Timeline validation
  validateTimelineDependencies(recommendations: TimelineRecommendation[]): { valid: boolean; conflicts: string[]; };
  suggestOptimalScheduling(recommendations: TimelineRecommendation[]): TimelineRecommendation[];
} 
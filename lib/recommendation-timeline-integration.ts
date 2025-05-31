/**
 * Timeline Integration Service
 * 
 * Provides integration between the existing recommendation system and the new timeline
 * functionality, converting regular recommendations to timeline-enhanced ones and
 * managing timeline state.
 */

import { 
  Recommendation,
  RecommendationSet,
  RecommendationType 
} from './recommendation-engine';
import { PrioritizedRecommendation } from './recommendation-prioritization';
import { 
  TimelineRecommendation,
  TimelineProperties,
  TimelineState,
  TimelineConfig,
  TimelineEvent,
  PresentationPhase 
} from './recommendation-timeline';
import { timelineUtils } from './recommendation-timeline-utils';

/**
 * Service for integrating timeline functionality with existing recommendation system
 */
export class TimelineIntegrationService {
  private state: TimelineState;
  private eventListeners: Array<(event: TimelineEvent) => void> = [];

  constructor(initialConfig?: Partial<TimelineConfig>) {
    this.state = {
      recommendations: [],
      presentationPhase: 'preparation',
      userProgress: 0,
      config: {
        viewType: 'chronological',
        scope: 'all_pending',
        showCompleted: false,
        showProgress: true,
        enableDragDrop: false,
        enableQuickActions: true,
        highlightOverdue: true,
        autoScheduling: {
          enabled: false,
          workingHours: [9, 17],
          breakBetweenTasks: 15,
          preferredDuration: 30
        },
        ...initialConfig
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Convert a RecommendationSet to timeline-enhanced recommendations
   */
  convertToTimelineRecommendations(recommendationSet: RecommendationSet): TimelineRecommendation[] {
    // Handle null or invalid recommendations gracefully
    if (!recommendationSet?.recommendations || !Array.isArray(recommendationSet.recommendations)) {
      console.warn('TimelineIntegrationService: Invalid or empty recommendations provided');
      return [];
    }

    return recommendationSet.recommendations.map(rec => this.enhanceWithTimeline(rec));
  }

  /**
   * Convert a single recommendation to timeline-enhanced recommendation
   */
  enhanceWithTimeline(recommendation: Recommendation | PrioritizedRecommendation): TimelineRecommendation {
    // Validate recommendation input
    if (!recommendation || typeof recommendation !== 'object' || !recommendation.id) {
      throw new Error('TimelineIntegrationService: Invalid recommendation provided to enhanceWithTimeline');
    }

    const baseTimeline: TimelineProperties = {
      estimatedDuration: this.estimateDuration(recommendation),
      contextualTriggers: this.inferContextualTriggers(recommendation),
      ...this.extractSlideInfo(recommendation)
    };

    return {
      ...recommendation,
      timeline: baseTimeline,
      status: 'scheduled',
      progress: {
        completionPercentage: 0,
        notes: []
      }
    } as TimelineRecommendation;
  }

  /**
   * Initialize timeline with existing recommendations
   */
  initializeTimeline(recommendationSet: RecommendationSet, config?: Partial<TimelineConfig>): void {
    // Validate input
    if (!recommendationSet) {
      console.warn('TimelineIntegrationService: No recommendation set provided to initializeTimeline');
      this.state.recommendations = [];
      this.state.lastUpdated = new Date();
      return;
    }

    if (config) {
      this.updateConfig(config);
    }

    const timelineRecs = this.convertToTimelineRecommendations(recommendationSet);
    
    // Auto-schedule if enabled
    if (this.state.config.autoScheduling?.enabled) {
      this.state.recommendations = timelineUtils.autoScheduleRecommendations(
        timelineRecs, 
        this.state.config.autoScheduling
      );
    } else {
      this.state.recommendations = timelineRecs;
    }

    this.state.lastUpdated = new Date();
    this.emitEvent({ type: 'UPDATE_CONFIG', payload: this.state.config });
  }

  /**
   * Get current timeline state
   */
  getState(): TimelineState {
    return { ...this.state };
  }

  /**
   * Get filtered and sorted recommendations based on current config
   */
  getRecommendations(): TimelineRecommendation[] {
    let recommendations = [...this.state.recommendations];

    // Apply scope filtering
    recommendations = this.applyScopeFilter(recommendations);

    // Apply additional filters if configured
    if (this.state.config.filter) {
      recommendations = timelineUtils.filterRecommendations(recommendations, this.state.config.filter);
    }

    // Sort based on view type
    recommendations = timelineUtils.sortRecommendations(recommendations, this.state.config.viewType);

    // Filter completed if not showing them
    if (!this.state.config.showCompleted) {
      recommendations = recommendations.filter(rec => rec.status !== 'completed');
    }

    return recommendations;
  }

  /**
   * Get recommendations grouped by the configured grouping
   */
  getGroupedRecommendations(): Record<string, TimelineRecommendation[]> {
    const recommendations = this.getRecommendations();
    return timelineUtils.groupRecommendations(recommendations, this.state.config.groupBy);
  }

  /**
   * Handle timeline events
   */
  handleEvent(event: TimelineEvent): void {
    switch (event.type) {
      case 'SCHEDULE_RECOMMENDATION':
        this.scheduleRecommendation(event.payload.id, event.payload.scheduledTime);
        break;
      
      case 'COMPLETE_RECOMMENDATION':
        this.completeRecommendation(event.payload.id, event.payload.completedAt, event.payload.notes);
        break;
      
      case 'START_RECOMMENDATION':
        this.startRecommendation(event.payload.id, event.payload.startedAt);
        break;
      
      case 'UPDATE_PROGRESS':
        this.updateProgress(event.payload.id, event.payload.percentage, event.payload.timeSpent);
        break;
      
      case 'CHANGE_SLIDE':
        this.changeSlide(event.payload.slideIndex, event.payload.timestamp);
        break;
      
      case 'CHANGE_PHASE':
        this.changePhase(event.payload.phase);
        break;
      
      case 'DEFER_RECOMMENDATION':
        this.deferRecommendation(event.payload.id, event.payload.newScheduledTime, event.payload.reason);
        break;
      
      case 'UPDATE_CONFIG':
        this.updateConfig(event.payload);
        break;
      
      case 'BULK_SCHEDULE':
        this.bulkSchedule(event.payload.recommendations);
        break;
    }

    this.state.lastUpdated = new Date();
    this.emitEvent(event);
  }

  /**
   * Schedule a specific recommendation
   */
  private scheduleRecommendation(id: string, scheduledTime: Date): void {
    const index = this.state.recommendations.findIndex(rec => rec.id === id);
    if (index !== -1) {
      this.state.recommendations[index] = timelineUtils.scheduleRecommendation(
        this.state.recommendations[index], 
        scheduledTime
      );
    }
  }

  /**
   * Mark a recommendation as completed
   */
  private completeRecommendation(id: string, completedAt: Date, notes?: string): void {
    const index = this.state.recommendations.findIndex(rec => rec.id === id);
    if (index !== -1) {
      const rec = this.state.recommendations[index];
      this.state.recommendations[index] = {
        ...rec,
        status: 'completed',
        progress: {
          ...rec.progress,
          completedAt,
          completionPercentage: 100,
          notes: notes ? [...(rec.progress?.notes || []), notes] : rec.progress?.notes
        }
      };
    }
  }

  /**
   * Start working on a recommendation
   */
  private startRecommendation(id: string, startedAt: Date): void {
    const index = this.state.recommendations.findIndex(rec => rec.id === id);
    if (index !== -1) {
      const rec = this.state.recommendations[index];
      this.state.recommendations[index] = {
        ...rec,
        status: 'active',
        progress: {
          ...rec.progress,
          startedAt,
          completionPercentage: rec.progress?.completionPercentage || 0
        }
      };
    }
  }

  /**
   * Update progress for a recommendation
   */
  private updateProgress(id: string, percentage: number, timeSpent?: number): void {
    const index = this.state.recommendations.findIndex(rec => rec.id === id);
    if (index !== -1) {
      const rec = this.state.recommendations[index];
      this.state.recommendations[index] = timelineUtils.updateProgress(rec, {
        completionPercentage: percentage,
        timeSpent: timeSpent ? (rec.progress?.timeSpent || 0) + timeSpent : rec.progress?.timeSpent
      });
    }
  }

  /**
   * Change current slide context
   */
  private changeSlide(slideIndex: number, timestamp?: number): void {
    this.state.currentSlide = slideIndex;
    this.state.currentTimestamp = timestamp;
    
    // Update user progress based on slide progression
    // This is a simple heuristic - could be more sophisticated
    if (slideIndex > 0) {
      this.state.userProgress = Math.min(slideIndex / 10, 1); // Assume max 10 slides
    }
  }

  /**
   * Change presentation phase
   */
  private changePhase(phase: PresentationPhase): void {
    this.state.presentationPhase = phase;
  }

  /**
   * Defer a recommendation to a new time
   */
  private deferRecommendation(id: string, newScheduledTime: Date, reason?: string): void {
    const index = this.state.recommendations.findIndex(rec => rec.id === id);
    if (index !== -1) {
      this.state.recommendations[index] = timelineUtils.rescheduleRecommendation(
        this.state.recommendations[index],
        newScheduledTime,
        reason
      );
      this.state.recommendations[index].status = 'deferred';
    }
  }

  /**
   * Update timeline configuration
   */
  private updateConfig(configUpdate: Partial<TimelineConfig>): void {
    this.state.config = { ...this.state.config, ...configUpdate };
  }

  /**
   * Bulk schedule multiple recommendations
   */
  private bulkSchedule(scheduleData: Array<{ id: string; scheduledTime: Date; }>): void {
    for (const { id, scheduledTime } of scheduleData) {
      this.scheduleRecommendation(id, scheduledTime);
    }
  }

  /**
   * Get contextual recommendations for current state
   */
  getContextualRecommendations(): TimelineRecommendation[] {
    return timelineUtils.getContextualRecommendations(
      this.state.recommendations,
      {
        slideIndex: this.state.currentSlide,
        phase: this.state.presentationPhase,
        progress: this.state.userProgress
      }
    );
  }

  /**
   * Get completion statistics
   */
  getCompletionStats() {
    return timelineUtils.calculateCompletionStats(this.state.recommendations);
  }

  /**
   * Subscribe to timeline events
   */
  addEventListener(listener: (event: TimelineEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Unsubscribe from timeline events
   */
  removeEventListener(listener: (event: TimelineEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: TimelineEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in timeline event listener:', error);
      }
    }
  }

  // Helper methods for recommendation enhancement
  private estimateDuration(recommendation: Recommendation): number {
    // Estimate duration based on type and complexity
    const baseDurations: Record<RecommendationType, number> = {
      'critical_issue': 60,
      'high_impact_improvement': 45,
      'strength_to_leverage': 30,
      'quick_win': 15,
      'comparative_insight': 20,
      'advanced_optimization': 90
    };

    const baseDuration = baseDurations[recommendation.type] || 30;
    
    // Adjust based on effort
    const effortMultiplier = {
      'low': 0.7,
      'medium': 1.0,
      'high': 1.5
    };

    return Math.round(baseDuration * (effortMultiplier[recommendation.estimatedEffort] || 1.0));
  }

  private inferContextualTriggers(recommendation: Recommendation): TimelineProperties['contextualTriggers'] {
    const triggers: TimelineProperties['contextualTriggers'] = {};

    // Infer presentation phase based on recommendation type
    switch (recommendation.type) {
      case 'critical_issue':
        triggers.presentationPhase = 'preparation';
        break;
      case 'strength_to_leverage':
        triggers.presentationPhase = 'practice';
        break;
      case 'quick_win':
        triggers.presentationPhase = 'preparation';
        break;
      case 'advanced_optimization':
        triggers.presentationPhase = 'review';
        break;
    }

    // Infer user progress requirement
    if (recommendation.type === 'advanced_optimization') {
      triggers.userProgress = 0.7; // Only show after 70% progress
    }

    return triggers;
  }

  private extractSlideInfo(recommendation: Recommendation): Partial<TimelineProperties> {
    // Try to extract slide information from related framework points or description
    // This is a simplified extraction - could be more sophisticated
    const slideKeywords = recommendation.relatedFrameworkPoints?.find(point => 
      point.toLowerCase().includes('slide') || point.toLowerCase().includes('visual')
    );

    if (slideKeywords) {
      // Extract slide number if mentioned
      const slideMatch = recommendation.description.match(/slide\s+(\d+)/i);
      if (slideMatch) {
        return { slideIndex: parseInt(slideMatch[1]) };
      }
    }

    return {};
  }

  private applyScopeFilter(recommendations: TimelineRecommendation[]): TimelineRecommendation[] {
    const now = new Date();
    
    switch (this.state.config.scope) {
      case 'today':
        return recommendations.filter(rec => {
          if (!rec.timeline.scheduledTime) return false;
          return rec.timeline.scheduledTime.toDateString() === now.toDateString();
        });
        
      case 'this_week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        return recommendations.filter(rec => {
          if (!rec.timeline.scheduledTime) return false;
          return rec.timeline.scheduledTime >= weekStart && rec.timeline.scheduledTime < weekEnd;
        });
        
      case 'slide_focused':
        if (this.state.currentSlide !== undefined) {
          return recommendations.filter(rec => 
            rec.timeline.slideIndex === this.state.currentSlide ||
            (rec.timeline.contextualTriggers?.slideRange && 
             rec.timeline.contextualTriggers.slideRange[0] <= this.state.currentSlide! &&
             rec.timeline.contextualTriggers.slideRange[1] >= this.state.currentSlide!)
          );
        }
        return recommendations;
        
      case 'contextual':
        return this.getContextualRecommendations();
        
      case 'all_pending':
      default:
        // Only filter out completed if not showing them
        if (this.state.config.showCompleted) {
          return recommendations; // Show all recommendations including completed
        } else {
          return recommendations.filter(rec => rec.status !== 'completed');
        }
    }
  }
}

// Export singleton instance for easy use
export const timelineIntegration = new TimelineIntegrationService(); 
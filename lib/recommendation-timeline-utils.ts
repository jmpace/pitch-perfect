/**
 * Timeline Utility Functions Implementation
 * 
 * Provides concrete implementations for timeline-related operations on recommendations,
 * including scheduling, filtering, sorting, and context-aware recommendation management.
 */

import { 
  TimelineRecommendation, 
  TimelineFilter, 
  TimelineViewType, 
  TimelineConfig,
  TimelineUtils,
  PresentationPhase 
} from './recommendation-timeline';

/**
 * Timeline Utilities Implementation
 */
export class TimelineUtilsImpl implements TimelineUtils {
  
  // Scheduling functions
  scheduleRecommendation(recommendation: TimelineRecommendation, scheduledTime: Date): TimelineRecommendation {
    return {
      ...recommendation,
      timeline: {
        ...recommendation.timeline,
        scheduledTime
      },
      status: 'scheduled'
    };
  }

  rescheduleRecommendation(
    recommendation: TimelineRecommendation, 
    newTime: Date, 
    reason?: string
  ): TimelineRecommendation {
    return {
      ...recommendation,
      timeline: {
        ...recommendation.timeline,
        scheduledTime: newTime
      },
      progress: {
        ...recommendation.progress,
        notes: [
          ...(recommendation.progress?.notes || []),
          `Rescheduled to ${newTime.toLocaleString()}${reason ? `: ${reason}` : ''}`
        ]
      }
    };
  }

  autoScheduleRecommendations(
    recommendations: TimelineRecommendation[], 
    config?: TimelineConfig['autoScheduling']
  ): TimelineRecommendation[] {
    if (!config?.enabled) return recommendations;

    const now = new Date();
    const workStart = config.workingHours?.[0] || 9;
    const workEnd = config.workingHours?.[1] || 17;
    const breakTime = config.breakBetweenTasks || 15;
    const preferredDuration = config.preferredDuration || 30;

    // Sort by priority and dependencies first
    const sortedRecs = this.sortRecommendations(recommendations, 'dependency');
    const scheduled: TimelineRecommendation[] = [];
    
    let currentTime = new Date(now);
    // Start scheduling from next working hour if outside working hours
    currentTime.setMinutes(0, 0, 0);
    if (currentTime.getHours() < workStart) {
      currentTime.setHours(workStart);
    } else if (currentTime.getHours() >= workEnd) {
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(workStart);
    }

    for (const rec of sortedRecs) {
      if (rec.status === 'completed' || rec.timeline.scheduledTime) {
        scheduled.push(rec);
        continue;
      }

      // Check if all prerequisites are scheduled before this time
      const prereqsMet = this.arePrerequisitesMet(rec, scheduled, currentTime);
      if (!prereqsMet) {
        // Find the latest prerequisite completion time and schedule after
        const latestPrereqTime = this.getLatestPrerequisiteTime(rec, scheduled);
        if (latestPrereqTime && latestPrereqTime > currentTime) {
          currentTime = new Date(latestPrereqTime);
          currentTime.setMinutes(currentTime.getMinutes() + breakTime);
        }
      }

      // Adjust for working hours
      currentTime = this.adjustToWorkingHours(currentTime, workStart, workEnd);

      const duration = rec.timeline.estimatedDuration || preferredDuration;
      const scheduledRec = this.scheduleRecommendation(rec, new Date(currentTime));
      scheduled.push(scheduledRec);

      // Move to next slot
      currentTime.setMinutes(currentTime.getMinutes() + duration + breakTime);
    }

    return scheduled;
  }

  // Filtering and sorting
  filterRecommendations(recommendations: TimelineRecommendation[], filter: TimelineFilter): TimelineRecommendation[] {
    return recommendations.filter(rec => {
      // Status filter
      if (filter.status && !filter.status.includes(rec.status)) return false;
      
      // Priority filter
      if (filter.priority && !filter.priority.includes(rec.priority)) return false;
      
      // Type filter
      if (filter.type && !filter.type.includes(rec.type)) return false;
      
      // Slide range filter - only include items with slideIndex in range
      if (filter.slideRange) {
        if (rec.timeline.slideIndex === undefined) return false;
        const [start, end] = filter.slideRange;
        if (rec.timeline.slideIndex < start || rec.timeline.slideIndex > end) return false;
      }
      
      // Time range filter
      if (filter.timeRange) {
        if (!rec.timeline.scheduledTime) return false; // Exclude items without scheduledTime
        if (rec.timeline.scheduledTime < filter.timeRange.start || 
            rec.timeline.scheduledTime > filter.timeRange.end) return false;
      }
      
      // Duration filter
      if (filter.estimatedDuration && rec.timeline.estimatedDuration !== undefined) {
        const duration = rec.timeline.estimatedDuration;
        if (filter.estimatedDuration.min && duration < filter.estimatedDuration.min) return false;
        if (filter.estimatedDuration.max && duration > filter.estimatedDuration.max) return false;
      }
      
      // Deadline filter
      if (filter.hasDeadline !== undefined) {
        const hasDeadline = rec.timeline.deadline !== undefined;
        if (filter.hasDeadline !== hasDeadline) return false;
      }
      
      // Overdue filter
      if (filter.overdue) {
        const isOverdue = rec.timeline.deadline && new Date() > rec.timeline.deadline && rec.status !== 'completed';
        if (!isOverdue) return false;
      }
      
      return true;
    });
  }

  sortRecommendations(recommendations: TimelineRecommendation[], viewType: TimelineViewType): TimelineRecommendation[] {
    const sorted = [...recommendations];
    
    switch (viewType) {
      case 'chronological':
        return sorted.sort((a, b) => {
          const timeA = a.timeline.scheduledTime?.getTime() || Infinity;
          const timeB = b.timeline.scheduledTime?.getTime() || Infinity;
          return timeA - timeB;
        });
        
      case 'slide_sequence':
        return sorted.sort((a, b) => {
          const slideA = a.timeline.slideIndex ?? Infinity;
          const slideB = b.timeline.slideIndex ?? Infinity;
          if (slideA !== slideB) return slideA - slideB;
          
          const timestampA = a.timeline.slideTimestamp ?? Infinity;
          const timestampB = b.timeline.slideTimestamp ?? Infinity;
          return timestampA - timestampB;
        });
        
      case 'priority':
        return sorted.sort((a, b) => {
          // Use priorityScore if available, otherwise use priority string
          const scoreA = a.priorityScore ?? this.getPriorityValue(a.priority);
          const scoreB = b.priorityScore ?? this.getPriorityValue(b.priority);
          return scoreB - scoreA; // Higher scores first
        });
        
      case 'dependency':
        return this.topologicalSort(sorted);
        
      case 'duration':
        return sorted.sort((a, b) => {
          const durationA = a.timeline.estimatedDuration ?? 0;
          const durationB = b.timeline.estimatedDuration ?? 0;
          return durationA - durationB; // Shorter tasks first
        });
        
      default:
        return sorted;
    }
  }

  groupRecommendations(
    recommendations: TimelineRecommendation[], 
    groupBy?: TimelineConfig['groupBy']
  ): Record<string, TimelineRecommendation[]> {
    if (!groupBy) return { 'all': recommendations };
    
    const groups: Record<string, TimelineRecommendation[]> = {};
    
    for (const rec of recommendations) {
      let key: string;
      
      switch (groupBy) {
        case 'date':
          key = rec.timeline.scheduledTime 
            ? rec.timeline.scheduledTime.toDateString()
            : 'Unscheduled';
          break;
          
        case 'slide':
          key = rec.timeline.slideIndex !== undefined 
            ? `Slide ${rec.timeline.slideIndex}`
            : 'General';
          break;
          
        case 'priority':
          key = rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1);
          break;
          
        case 'type':
          key = rec.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
          break;
          
        case 'status':
          key = rec.status.charAt(0).toUpperCase() + rec.status.slice(1);
          break;
          
        default:
          key = 'Other';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    }
    
    return groups;
  }

  // Context-aware functions
  getContextualRecommendations(
    recommendations: TimelineRecommendation[], 
    context: { slideIndex?: number; phase?: string; progress?: number; }
  ): TimelineRecommendation[] {
    return recommendations.filter(rec => {
      const triggers = rec.timeline.contextualTriggers;
      if (!triggers) return true; // Include items without triggers by default
      
      let hasMatchingTrigger = false;
      
      // Check slide range
      if (triggers.slideRange && context.slideIndex !== undefined) {
        const [start, end] = triggers.slideRange;
        if (context.slideIndex >= start && context.slideIndex <= end) {
          hasMatchingTrigger = true;
        } else {
          return false; // Explicit slide range mismatch
        }
      }
      
      // Check presentation phase
      if (triggers.presentationPhase && context.phase) {
        if (triggers.presentationPhase === context.phase) {
          hasMatchingTrigger = true;
        } else {
          return false; // Explicit phase mismatch
        }
      }
      
      // Check user progress
      if (triggers.userProgress !== undefined && context.progress !== undefined) {
        if (context.progress >= triggers.userProgress) {
          hasMatchingTrigger = true;
        } else {
          return false; // Explicit progress mismatch
        }
      }
      
      // If we have triggers but no context matches, exclude
      if (Object.keys(triggers).length > 0 && !hasMatchingTrigger) {
        return false;
      }
      
      return true;
    });
  }

  getOverdueRecommendations(recommendations: TimelineRecommendation[]): TimelineRecommendation[] {
    const now = new Date();
    return recommendations.filter(rec => 
      rec.timeline.deadline && 
      now > rec.timeline.deadline && 
      rec.status !== 'completed'
    );
  }

  getUpcomingRecommendations(
    recommendations: TimelineRecommendation[], 
    timeWindow: number = 24 * 60 // Default 24 hours in minutes
  ): TimelineRecommendation[] {
    const now = new Date();
    const futureTime = new Date(now.getTime() + timeWindow * 60 * 1000);
    
    return recommendations.filter(rec => 
      rec.timeline.scheduledTime &&
      rec.timeline.scheduledTime >= now &&
      rec.timeline.scheduledTime <= futureTime &&
      rec.status !== 'completed'
    );
  }

  // Progress tracking
  updateProgress(
    recommendation: TimelineRecommendation, 
    progress: Partial<TimelineRecommendation['progress']>
  ): TimelineRecommendation {
    return {
      ...recommendation,
      progress: {
        ...recommendation.progress,
        ...progress
      }
    };
  }

  calculateCompletionStats(recommendations: TimelineRecommendation[]) {
    const total = recommendations.length;
    const completed = recommendations.filter(r => r.status === 'completed').length;
    const inProgress = recommendations.filter(r => r.status === 'active').length;
    const overdue = this.getOverdueRecommendations(recommendations).length;
    
    const completionRate = total > 0 ? completed / total : 0;
    
    // Calculate average time to complete
    const completedRecs = recommendations.filter(r => 
      r.status === 'completed' && r.progress?.startedAt && r.progress?.completedAt
    );
    
    const totalCompletionTime = completedRecs.reduce((sum, rec) => {
      const start = rec.progress!.startedAt!.getTime();
      const end = rec.progress!.completedAt!.getTime();
      return sum + (end - start);
    }, 0);
    
    const averageTimeToComplete = completedRecs.length > 0 
      ? totalCompletionTime / completedRecs.length / (1000 * 60) // Convert to minutes
      : 0;

    return {
      total,
      completed,
      inProgress,
      overdue,
      completionRate,
      averageTimeToComplete
    };
  }

  // Timeline validation
  validateTimelineDependencies(recommendations: TimelineRecommendation[]): { valid: boolean; conflicts: string[]; } {
    const conflicts: string[] = [];
    
    for (const rec of recommendations) {
      if (!rec.timeline.prerequisites) continue;
      
      for (const prereqId of rec.timeline.prerequisites) {
        const prereq = recommendations.find(r => r.id === prereqId);
        if (!prereq) {
          conflicts.push(`Recommendation ${rec.id} references non-existent prerequisite ${prereqId}`);
          continue;
        }
        
        // Check for circular dependencies
        if (this.hasCircularDependency(rec, prereq, recommendations)) {
          conflicts.push(`Circular dependency detected between ${rec.id} and ${prereqId}`);
        }
        
        // Check scheduled times
        if (rec.timeline.scheduledTime && prereq.timeline.scheduledTime) {
          if (rec.timeline.scheduledTime <= prereq.timeline.scheduledTime) {
            conflicts.push(`Recommendation ${rec.id} is scheduled before its prerequisite ${prereqId}`);
          }
        }
      }
    }
    
    return { valid: conflicts.length === 0, conflicts };
  }

  suggestOptimalScheduling(recommendations: TimelineRecommendation[]): TimelineRecommendation[] {
    // This is a simplified optimal scheduling suggestion
    // In a real implementation, this could use more sophisticated algorithms
    
    const config = {
      enabled: true,
      workingHours: [9, 17] as [number, number],
      breakBetweenTasks: 15,
      preferredDuration: 30
    };
    
    return this.autoScheduleRecommendations(recommendations, config);
  }

  // Helper methods
  private getPriorityValue(priority: string): number {
    const values = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    return values[priority as keyof typeof values] || 0;
  }

  private arePrerequisitesMet(
    recommendation: TimelineRecommendation, 
    scheduled: TimelineRecommendation[], 
    currentTime: Date
  ): boolean {
    if (!recommendation.timeline.prerequisites) return true;
    
    return recommendation.timeline.prerequisites.every(prereqId => {
      const prereq = scheduled.find(r => r.id === prereqId);
      if (!prereq?.timeline.scheduledTime) return false;
      
      const prereqEndTime = new Date(prereq.timeline.scheduledTime);
      prereqEndTime.setMinutes(prereqEndTime.getMinutes() + (prereq.timeline.estimatedDuration || 30));
      
      return prereqEndTime <= currentTime;
    });
  }

  private getLatestPrerequisiteTime(
    recommendation: TimelineRecommendation, 
    scheduled: TimelineRecommendation[]
  ): Date | null {
    if (!recommendation.timeline.prerequisites) return null;
    
    let latestTime: Date | null = null;
    
    for (const prereqId of recommendation.timeline.prerequisites) {
      const prereq = scheduled.find(r => r.id === prereqId);
      if (!prereq?.timeline.scheduledTime) continue;
      
      const prereqEndTime = new Date(prereq.timeline.scheduledTime);
      prereqEndTime.setMinutes(prereqEndTime.getMinutes() + (prereq.timeline.estimatedDuration || 30));
      
      if (!latestTime || prereqEndTime > latestTime) {
        latestTime = prereqEndTime;
      }
    }
    
    return latestTime;
  }

  private adjustToWorkingHours(time: Date, workStart: number, workEnd: number): Date {
    const adjusted = new Date(time);
    
    if (adjusted.getHours() < workStart) {
      adjusted.setHours(workStart, 0, 0, 0);
    } else if (adjusted.getHours() >= workEnd) {
      adjusted.setDate(adjusted.getDate() + 1);
      adjusted.setHours(workStart, 0, 0, 0);
    }
    
    return adjusted;
  }

  private topologicalSort(recommendations: TimelineRecommendation[]): TimelineRecommendation[] {
    const visited = new Set<string>();
    const result: TimelineRecommendation[] = [];
    const recMap = new Map(recommendations.map(r => [r.id, r]));
    
    const visit = (rec: TimelineRecommendation) => {
      if (visited.has(rec.id)) return;
      
      visited.add(rec.id);
      
      // Visit prerequisites first
      if (rec.timeline.prerequisites) {
        for (const prereqId of rec.timeline.prerequisites) {
          const prereq = recMap.get(prereqId);
          if (prereq) visit(prereq);
        }
      }
      
      result.push(rec);
    };
    
    for (const rec of recommendations) {
      visit(rec);
    }
    
    return result;
  }

  private hasCircularDependency(
    rec: TimelineRecommendation, 
    prereq: TimelineRecommendation, 
    allRecs: TimelineRecommendation[],
    visited: Set<string> = new Set()
  ): boolean {
    if (visited.has(prereq.id)) return true;
    if (prereq.id === rec.id) return true;
    
    visited.add(prereq.id);
    
    if (prereq.timeline.prerequisites) {
      for (const nextPrereqId of prereq.timeline.prerequisites) {
        const nextPrereq = allRecs.find(r => r.id === nextPrereqId);
        if (nextPrereq && this.hasCircularDependency(rec, nextPrereq, allRecs, new Set(visited))) {
          return true;
        }
      }
    }
    
    return false;
  }
}

// Export singleton instance
export const timelineUtils = new TimelineUtilsImpl(); 
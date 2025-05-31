/**
 * Recommendation Template Components
 * 
 * React components for rendering recommendation templates with different
 * variants, priorities, and contexts. Integrates with existing UI system.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  TemplateData, 
  TemplateConfig, 
  TemplateVariant,
  DisplayContext,
  UserExperienceLevel 
} from './types';
import { 
  RecommendationType, 
  RecommendationPriority,
  RecommendationCategory 
} from '../recommendation-engine';
import { PrioritizedRecommendation } from '../recommendation-prioritization';

// Icon mapping for different recommendation types
const RECOMMENDATION_ICONS: Record<RecommendationType, string> = {
  'critical_issue': '🚨',
  'high_impact_improvement': '⚡',
  'strength_to_leverage': '💪',
  'quick_win': '🎯',
  'comparative_insight': '📊',
  'advanced_optimization': '🔧'
};

// Priority color mapping for badges
const PRIORITY_VARIANTS = {
  'critical': 'destructive' as const,
  'high': 'default' as const,
  'medium': 'secondary' as const,
  'low': 'outline' as const
};

// Category color classes
const CATEGORY_COLORS = {
  'speech': 'border-l-blue-500',
  'content': 'border-l-green-500',
  'visual': 'border-l-purple-500',
  'overall': 'border-l-orange-500',
  'cross_category': 'border-l-gray-500'
};

interface BaseTemplateProps {
  data: TemplateData;
  config: TemplateConfig;
  className?: string;
  onAction?: (action: string, recommendationId: string) => void;
}

// Summary Template - Brief overview for lists
export function SummaryTemplate({ data, config, className, onAction }: BaseTemplateProps) {
  const { recommendation, metadata, context } = data;
  const icon = config.customIcons?.[recommendation.type] || RECOMMENDATION_ICONS[recommendation.type];
  const priorityVariant = PRIORITY_VARIANTS[recommendation.priority];
  const categoryColor = CATEGORY_COLORS[recommendation.category];

  return (
    <Card className={cn('transition-all hover:shadow-md', categoryColor, className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-lg flex-shrink-0">{icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                  {recommendation.title}
                </h3>
                <Badge variant={priorityVariant} className="text-xs">
                  {recommendation.priority}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                {recommendation.description}
              </p>
              {config.showMetrics && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>Impact: {recommendation.estimatedImpact}</span>
                  <span>•</span>
                  <span>Effort: {recommendation.estimatedEffort}</span>
                  <span>•</span>
                  <span>{recommendation.timeToImplement}h</span>
                </div>
              )}
            </div>
          </div>
          {config.enableInteractions && (
            <CardAction>
              <button
                onClick={() => onAction?.('expand', recommendation.id)}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                View
              </button>
            </CardAction>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Detailed Template - Full details for focus views
export function DetailedTemplate({ data, config, className, onAction }: BaseTemplateProps) {
  const { recommendation, metadata, context } = data;
  const icon = config.customIcons?.[recommendation.type] || RECOMMENDATION_ICONS[recommendation.type];
  const priorityVariant = PRIORITY_VARIANTS[recommendation.priority];
  const categoryColor = CATEGORY_COLORS[recommendation.category];

  const maxSteps = config.maxActionSteps || recommendation.actionableSteps.length;
  const displaySteps = recommendation.actionableSteps.slice(0, maxSteps);

  return (
    <Card className={cn('transition-all', categoryColor, className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg text-gray-900 dark:text-white">
                {recommendation.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={priorityVariant}>
                  {recommendation.priority} Priority
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {recommendation.category.replace('_', ' ')}
                </Badge>
                {config.showMetrics && (
                  <Badge variant="outline" className="text-xs">
                    Score: {recommendation.priorityScore}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Description */}
        <div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {recommendation.description}
          </p>
        </div>

        {/* Metrics Grid */}
        {config.showMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {recommendation.estimatedImpact}
              </div>
              <div className="text-xs text-gray-500">Impact</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {recommendation.estimatedEffort}
              </div>
              <div className="text-xs text-gray-500">Effort</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {recommendation.timeToImplement}h
              </div>
              <div className="text-xs text-gray-500">Time</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {Math.round(recommendation.confidence * 100)}%
              </div>
              <div className="text-xs text-gray-500">Confidence</div>
            </div>
          </div>
        )}

        {/* Action Steps */}
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <span>📋</span>
            Action Steps
          </h4>
          <ol className="space-y-3">
            {displaySteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full flex items-center justify-center">
                  {index + 1}
                </span>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {step}
                </p>
              </li>
            ))}
          </ol>
          
          {recommendation.actionableSteps.length > maxSteps && (
            <button
              onClick={() => onAction?.('show-all-steps', recommendation.id)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Show {recommendation.actionableSteps.length - maxSteps} more steps
            </button>
          )}
        </div>

        {/* Prerequisites */}
        {config.showPrerequisites && recommendation.prerequisiteRecommendations?.length && (
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>🔗</span>
              Prerequisites
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Complete these recommendations first: {recommendation.prerequisiteRecommendations.join(', ')}
            </div>
          </div>
        )}

        {/* Evidence */}
        {recommendation.evidence && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
              <span>💡</span>
              Evidence
            </h4>
            <p className="text-blue-800 dark:text-blue-300 text-sm leading-relaxed">
              {recommendation.evidence}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {config.enableInteractions && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onAction?.('start', recommendation.id)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Start Working
            </button>
            <button
              onClick={() => onAction?.('schedule', recommendation.id)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Schedule
            </button>
            <button
              onClick={() => onAction?.('bookmark', recommendation.id)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Save for Later
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact Template - Minimal display for mobile/constrained spaces
export function CompactTemplate({ data, config, className, onAction }: BaseTemplateProps) {
  const { recommendation } = data;
  const icon = config.customIcons?.[recommendation.type] || RECOMMENDATION_ICONS[recommendation.type];
  const priorityVariant = PRIORITY_VARIANTS[recommendation.priority];

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition-all',
      className
    )}>
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {recommendation.title}
          </h4>
          <Badge variant={priorityVariant} className="text-xs">
            {recommendation.priority}
          </Badge>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">
          {recommendation.description}
        </p>
      </div>
      {config.enableInteractions && (
        <button
          onClick={() => onAction?.('expand', recommendation.id)}
          className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 px-2"
        >
          View
        </button>
      )}
    </div>
  );
}

// Export Template - Print/document friendly format
export function ExportTemplate({ data, config, className }: BaseTemplateProps) {
  const { recommendation, context } = data;
  const icon = config.customIcons?.[recommendation.type] || RECOMMENDATION_ICONS[recommendation.type];

  return (
    <div className={cn('print:break-inside-avoid mb-6', className)}>
      <div className="border border-gray-300 rounded-lg p-6 bg-white">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <span className="text-xl">{icon}</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {recommendation.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="px-2 py-1 bg-gray-100 rounded">
                {recommendation.priority} Priority
              </span>
              <span className="px-2 py-1 bg-gray-100 rounded">
                {recommendation.category.replace('_', ' ')}
              </span>
              <span className="px-2 py-1 bg-gray-100 rounded">
                {recommendation.timeToImplement}h estimated
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p className="text-gray-700 leading-relaxed">
            {recommendation.description}
          </p>
        </div>

        {/* Action Steps */}
        <div className="mb-4">
          <h4 className="font-semibold text-gray-900 mb-2">Action Steps:</h4>
          <ol className="list-decimal list-inside space-y-1">
            {recommendation.actionableSteps.map((step, index) => (
              <li key={index} className="text-gray-700 leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded text-center text-sm">
          <div>
            <div className="font-semibold text-gray-900">Impact</div>
            <div className="text-gray-600">{recommendation.estimatedImpact}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">Effort</div>
            <div className="text-gray-600">{recommendation.estimatedEffort}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">Confidence</div>
            <div className="text-gray-600">{Math.round(recommendation.confidence * 100)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Timeline Template - Integrated with timeline/scheduling
export function TimelineTemplate({ data, config, className, onAction }: BaseTemplateProps) {
  const { recommendation, metadata } = data;
  const icon = config.customIcons?.[recommendation.type] || RECOMMENDATION_ICONS[recommendation.type];
  const priorityVariant = PRIORITY_VARIANTS[recommendation.priority];

  // Type assertion for timeline-enhanced recommendation
  const timelineRec = recommendation as any; // Will be properly typed when integrated
  const timeline = timelineRec.timeline || {};
  const progress = timelineRec.progress || {};
  const status = timelineRec.status || 'pending';

  // Calculate time-related displays
  const now = new Date();
  const scheduledTime = timeline.scheduledTime ? new Date(timeline.scheduledTime) : null;
  const deadline = timeline.deadline ? new Date(timeline.deadline) : null;
  const isOverdue = deadline && now > deadline && status !== 'completed';
  const isUpcoming = scheduledTime && scheduledTime > now && scheduledTime.getTime() - now.getTime() < 24 * 60 * 60 * 1000; // Within 24 hours
  
  // Progress calculation
  const progressPercentage = progress.completionPercentage || 0;
  const isInProgress = status === 'active' && progressPercentage > 0;

  // Time displays
  const formatTime = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    if (isToday) return `Today ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    if (isTomorrow) return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className={cn(
      'flex gap-4 p-4 border-l-4 relative', 
      CATEGORY_COLORS[recommendation.category],
      isOverdue && 'bg-red-50 dark:bg-red-900/20 border-l-red-500',
      isUpcoming && 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500',
      className
    )}>
      {/* Timeline indicator with status */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center relative",
          status === 'completed' && 'bg-green-100 dark:bg-green-900',
          status === 'active' && 'bg-blue-100 dark:bg-blue-900',
          status === 'scheduled' && 'bg-gray-100 dark:bg-gray-700',
          status === 'deferred' && 'bg-yellow-100 dark:bg-yellow-900',
          isOverdue && 'bg-red-100 dark:bg-red-900'
        )}>
          <span className="text-sm">{icon}</span>
          {status === 'completed' && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
          )}
          {isOverdue && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
          )}
        </div>
        
        {/* Progress indicator */}
        {isInProgress && (
          <div className="w-px h-6 bg-gradient-to-b from-blue-500 to-gray-300 dark:to-gray-600 mt-1 relative">
            <div 
              className="absolute top-0 w-px bg-blue-500 transition-all duration-300"
              style={{ height: `${progressPercentage}%` }}
            />
          </div>
        )}
        
        {/* Timeline connector */}
        {!isInProgress && (
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mt-2"></div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-medium text-gray-900 dark:text-white">
            {recommendation.title}
          </h4>
          <div className="flex items-center gap-2">
            <Badge variant={priorityVariant} className="text-xs">
              {recommendation.priority}
            </Badge>
            {status === 'completed' && (
              <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                Done
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                Overdue
              </Badge>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {recommendation.description}
        </p>

        {/* Timeline information */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-3">
          <span>⏱️ {timeline.estimatedDuration || recommendation.timeToImplement || 30}min</span>
          <span>📈 {recommendation.estimatedImpact} impact</span>
          
          {scheduledTime && (
            <span className={cn(
              "flex items-center gap-1",
              isOverdue && "text-red-600 dark:text-red-400",
              isUpcoming && "text-blue-600 dark:text-blue-400"
            )}>
              🕒 {formatTime(scheduledTime)}
            </span>
          )}
          
          {deadline && (
            <span className={cn(
              "flex items-center gap-1",
              isOverdue && "text-red-600 dark:text-red-400 font-medium"
            )}>
              ⏰ Due {formatTime(deadline)}
            </span>
          )}
          
          {timeline.slideIndex !== undefined && (
            <span>📄 Slide {timeline.slideIndex}</span>
          )}
          
          {timeline.prerequisites?.length && (
            <span>🔗 {timeline.prerequisites.length} prereq{timeline.prerequisites.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Progress bar for active tasks */}
        {isInProgress && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">Progress</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Context-based scheduling info */}
        {config.showTimeline && (
          <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
            {!scheduledTime && status !== 'completed' && (
              <span>📅 Ready to schedule</span>
            )}
            {scheduledTime && timeline.contextualTriggers?.presentationPhase && (
              <span>🎯 Best during: {timeline.contextualTriggers.presentationPhase}</span>
            )}
            {timeline.recurrence && (
              <span>🔄 Recurring: {timeline.recurrence.type}</span>
            )}
          </div>
        )}

        {/* Action buttons */}
        {config.enableInteractions && (
          <div className="flex gap-2 mt-3">
            {status === 'scheduled' && (
              <button
                onClick={() => onAction?.('start', recommendation.id)}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Start Now
              </button>
            )}
            
            {status === 'active' && (
              <>
                <button
                  onClick={() => onAction?.('complete', recommendation.id)}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Mark Complete
                </button>
                <button
                  onClick={() => onAction?.('pause', recommendation.id)}
                  className="text-xs px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                >
                  Pause
                </button>
              </>
            )}
            
            {(status === 'scheduled' || status === 'active') && (
              <button
                onClick={() => onAction?.('reschedule', recommendation.id)}
                className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Reschedule
              </button>
            )}
            
            {status !== 'completed' && !scheduledTime && (
              <button
                onClick={() => onAction?.('schedule', recommendation.id)}
                className="text-xs px-3 py-1 bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
              >
                Schedule
              </button>
            )}
            
            {status !== 'completed' && (
              <button
                onClick={() => onAction?.('defer', recommendation.id)}
                className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Defer
              </button>
            )}
          </div>
        )}

        {/* Recent progress notes */}
        {progress.notes?.length && config.showProgress && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recent Notes:</h5>
            <div className="text-xs text-gray-500 space-y-1">
              {progress.notes.slice(-2).map((note: string, index: number) => (
                <div key={index} className="truncate">{note}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
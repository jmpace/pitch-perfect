'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineEvent } from '@/lib/timeline-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface TimelineFeedbackProps {
  event: TimelineEvent;
  isExpanded?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
  onToggleExpand?: (eventId: string, expanded: boolean) => void;
  className?: string;
  showCompact?: boolean;
}

export function TimelineFeedback({
  event,
  isExpanded = false,
  isSelected = false,
  isFocused = false,
  onToggleExpand,
  className,
  showCompact = false
}: TimelineFeedbackProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);

  // Use local state if no external control
  const expanded = onToggleExpand ? isExpanded : localExpanded;
  
  const handleToggle = () => {
    const newExpanded = !expanded;
    if (onToggleExpand) {
      onToggleExpand(event.id, newExpanded);
    } else {
      setLocalExpanded(newExpanded);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleToggle();
    }
  };

  // Don't render if no feedback
  if (!event.feedback) {
    return null;
  }

  const { feedback } = event;

  // Get severity styling
  const getSeverityConfig = (severity: typeof feedback.severity) => {
    switch (severity) {
      case 'critical':
        return {
          icon: XCircle,
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-950/20',
          border: 'border-red-200 dark:border-red-800',
          badge: 'destructive' as const
        };
      case 'high':
        return {
          icon: AlertTriangle,
          color: 'text-orange-600 dark:text-orange-400',
          bg: 'bg-orange-50 dark:bg-orange-950/20',
          border: 'border-orange-200 dark:border-orange-800',
          badge: 'destructive' as const
        };
      case 'medium':
        return {
          icon: Info,
          color: 'text-yellow-600 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-950/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          badge: 'outline' as const
        };
      case 'low':
        return {
          icon: CheckCircle,
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-950/20',
          border: 'border-green-200 dark:border-green-800',
          badge: 'secondary' as const
        };
    }
  };

  const severityConfig = getSeverityConfig(feedback.severity);
  const SeverityIcon = severityConfig.icon;

  // Compact view for timeline
  if (showCompact) {
    return (
      <div className={cn("relative", className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-6 px-2 text-xs transition-all duration-200",
            severityConfig.color,
            severityConfig.bg,
            "hover:opacity-80",
            // Enhanced selection states
            isSelected && "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/50",
            isFocused && !isSelected && "ring-2 ring-purple-500 bg-purple-100 dark:bg-purple-900/50"
          )}
          aria-label={`${feedback.category} feedback${expanded ? ' (expanded)' : ' (collapsed)'}${isSelected ? ' (selected)' : ''}${isFocused ? ' (focused)' : ''}`}
          aria-expanded={expanded}
        >
          <SeverityIcon className="w-3 h-3 mr-1" />
          {feedback.category}
          {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
        </Button>
        
        {expanded && (
          <Card className={cn(
            "absolute top-8 left-0 z-20 w-80 shadow-lg transition-all duration-200",
            severityConfig.border,
            // Enhanced visual feedback for selection states
            isSelected && "ring-2 ring-blue-500 shadow-blue-200/50 dark:shadow-blue-900/50",
            isFocused && !isSelected && "ring-2 ring-purple-500 shadow-purple-200/50 dark:shadow-purple-900/50"
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center">
                  <SeverityIcon className={cn("w-4 h-4 mr-2", severityConfig.color)} />
                  {feedback.category}
                </CardTitle>
                <Badge variant={severityConfig.badge} className="text-xs">
                  {feedback.severity}
                </Badge>
              </div>
              {feedback.score !== undefined && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Score: {feedback.score}/100
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {feedback.recommendations.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Recommendations:
                  </div>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {feedback.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Full view for detailed feedback
  return (
    <Card className={cn(
      "transition-all duration-200",
      severityConfig.border,
      severityConfig.bg,
      // Enhanced selection state visuals
      isSelected && "ring-2 ring-blue-500 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50",
      isFocused && !isSelected && "ring-2 ring-purple-500 shadow-lg shadow-purple-200/50 dark:shadow-purple-900/50",
      className
    )}>
      <CardHeader 
        className={cn(
          "cursor-pointer transition-colors",
          "hover:bg-gray-50 dark:hover:bg-gray-800/50",
          isSelected && "bg-blue-50 dark:bg-blue-900/30",
          isFocused && !isSelected && "bg-purple-50 dark:bg-purple-900/30"
        )}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${feedback.category} feedback${expanded ? ' (expanded)' : ' (collapsed)'}${isSelected ? ' (selected)' : ''}${isFocused ? ' (focused)' : ''}`}
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center">
            <SeverityIcon className={cn("w-5 h-5 mr-2", severityConfig.color)} />
            {feedback.category}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={severityConfig.badge}
              className={cn(
                isSelected && "bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-900"
              )}
            >
              {feedback.severity}
            </Badge>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
        {feedback.score !== undefined && (
          <div className={cn(
            "text-sm",
            isSelected 
              ? "text-blue-700 dark:text-blue-300" 
              : "text-gray-600 dark:text-gray-400"
          )}>
            Score: {feedback.score}/100
          </div>
        )}
      </CardHeader>
      
      {expanded && (
        <CardContent className={cn(
          "pt-0 transition-all duration-200",
          isSelected && "bg-blue-25 dark:bg-blue-950/10"
        )}>
          {feedback.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className={cn(
                "text-sm font-medium",
                isSelected 
                  ? "text-blue-800 dark:text-blue-200" 
                  : "text-gray-700 dark:text-gray-300"
              )}>
                Recommendations:
              </div>
              <ul className={cn(
                "text-sm space-y-2",
                isSelected 
                  ? "text-blue-700 dark:text-blue-300" 
                  : "text-gray-600 dark:text-gray-400"
              )}>
                {feedback.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className={cn(
                      "mr-2 mt-0.5",
                      isSelected ? "text-blue-500" : "text-blue-500"
                    )}>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Enhanced multiple feedback sections component
interface TimelineFeedbackListProps {
  events: TimelineEvent[];
  expandedEventIds?: Set<string>;
  selectedEventId?: string;
  focusedEventId?: string;
  onToggleExpand?: (eventId: string, expanded: boolean) => void;
  className?: string;
  showCompact?: boolean;
  maxItems?: number;
}

export function TimelineFeedbackList({
  events,
  expandedEventIds = new Set(),
  selectedEventId,
  focusedEventId,
  onToggleExpand,
  className,
  showCompact = false,
  maxItems
}: TimelineFeedbackListProps) {
  // Filter events that have feedback
  const feedbackEvents = events.filter(event => event.feedback);
  
  // Limit items if maxItems is specified
  const displayEvents = maxItems ? feedbackEvents.slice(0, maxItems) : feedbackEvents;

  if (displayEvents.length === 0) {
    return (
      <div className={cn("text-center text-gray-500 dark:text-gray-400 py-4", className)}>
        No feedback available
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {displayEvents.map((event) => (
        <TimelineFeedback
          key={event.id}
          event={event}
          isExpanded={expandedEventIds.has(event.id)}
          isSelected={event.id === selectedEventId}
          isFocused={event.id === focusedEventId}
          onToggleExpand={onToggleExpand}
          showCompact={showCompact}
        />
      ))}
      
      {/* Show more indicator if items were limited */}
      {maxItems && feedbackEvents.length > maxItems && (
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-2">
          +{feedbackEvents.length - maxItems} more feedback items
        </div>
      )}
    </div>
  );
}

// Enhanced feedback summary component
interface FeedbackSummaryProps {
  events: TimelineEvent[];
  selectedEventId?: string;
  className?: string;
}

export function FeedbackSummary({ 
  events, 
  selectedEventId,
  className 
}: FeedbackSummaryProps) {
  const feedbackEvents = events.filter(event => event.feedback);
  
  if (feedbackEvents.length === 0) {
    return null;
  }

  // Calculate summary statistics
  const severityCounts = feedbackEvents.reduce((acc, event) => {
    const severity = event.feedback!.severity;
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const averageScore = feedbackEvents
    .filter(event => event.feedback!.score !== undefined)
    .reduce((sum, event, _, arr) => {
      return sum + (event.feedback!.score! / arr.length);
    }, 0);

  // Get selected event feedback if available
  const selectedEvent = selectedEventId 
    ? events.find(event => event.id === selectedEventId)
    : null;
  const selectedFeedback = selectedEvent?.feedback;

  return (
    <Card className={cn(
      "transition-all duration-200",
      selectedEventId && "ring-1 ring-blue-300 dark:ring-blue-700",
      className
    )}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Feedback Summary</span>
          {selectedFeedback && (
            <Badge variant="outline" className="text-xs">
              Selected: {selectedFeedback.category}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600 dark:text-gray-400">Total Issues</div>
            <div className="font-medium">{feedbackEvents.length}</div>
          </div>
          {averageScore > 0 && (
            <div>
              <div className="text-gray-600 dark:text-gray-400">Avg Score</div>
              <div className="font-medium">{Math.round(averageScore)}/100</div>
            </div>
          )}
        </div>
        
        <div className="mt-4 space-y-2">
          {Object.entries(severityCounts).map(([severity, count]) => {
            const config = {
              critical: { color: 'text-red-600', bg: 'bg-red-100' },
              high: { color: 'text-orange-600', bg: 'bg-orange-100' },
              medium: { color: 'text-yellow-600', bg: 'bg-yellow-100' },
              low: { color: 'text-green-600', bg: 'bg-green-100' }
            }[severity] || { color: 'text-gray-600', bg: 'bg-gray-100' };
            
            return (
              <div key={severity} className="flex items-center justify-between text-xs">
                <span className={cn("capitalize", config.color)}>{severity}</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs", 
                    config.color,
                    selectedFeedback?.severity === severity && "ring-2 ring-blue-500"
                  )}
                >
                  {count}
                </Badge>
              </div>
            );
          })}
        </div>

        {selectedFeedback && (
          <div className="mt-4 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
            <div className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
              Selected Event Feedback:
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              {selectedFeedback.category} ({selectedFeedback.severity})
              {selectedFeedback.score && ` • Score: ${selectedFeedback.score}/100`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
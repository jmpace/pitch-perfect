'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TimelineProps, TimelineEvent } from '@/lib/timeline-types';
import { SlideThumbnail } from './slide-thumbnail';
import { TimelineFeedback } from './timeline-feedback';
import { 
  useTimelineSelection, 
  isEventSelected, 
  isEventExpanded, 
  isEventFocused 
} from '@/lib/use-timeline-selection';

interface TimelineScrollAreaProps extends TimelineProps {
  orientation?: 'horizontal' | 'vertical';
  autoScroll?: boolean;
  smoothScrollDuration?: number;
  showFeedback?: boolean;
  autoExpand?: boolean;
  selectedEventId?: string;
}

export function TimelineScrollArea({
  timeline,
  onEventSelect,
  onEventExpand,
  onPositionChange,
  className,
  orientation = 'horizontal',
  autoScroll = true,
  smoothScrollDuration = 300,
  showFeedback = true,
  autoExpand = true,
  selectedEventId,
  ...props
}: TimelineScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Use the selection hook for enhanced event management
  const [selectionState, selectionActions] = useTimelineSelection({
    onEventSelect,
    onEventExpand,
    autoExpand
  });

  // Format timestamp for display
  const formatTimestamp = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Calculate scroll position based on timeline position
  const calculateScrollPosition = useCallback((position: number): number => {
    if (!scrollRef.current || timeline.duration === 0) return 0;
    
    const scrollWidth = scrollRef.current.scrollWidth;
    const clientWidth = scrollRef.current.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    
    return (position / timeline.duration) * maxScroll;
  }, [timeline.duration]);

  // Scroll to specific position with smooth animation
  const scrollToPosition = useCallback((targetPosition: number, smooth: boolean = true) => {
    if (!scrollRef.current) return;
    
    const scrollPosition = calculateScrollPosition(targetPosition);
    
    if (smooth) {
      setIsScrolling(true);
      scrollRef.current.scrollTo({
        [orientation === 'horizontal' ? 'left' : 'top']: scrollPosition,
        behavior: 'smooth'
      });
      
      // Reset scrolling state after animation
      setTimeout(() => setIsScrolling(false), smoothScrollDuration);
    } else {
      scrollRef.current.scrollTo({
        [orientation === 'horizontal' ? 'left' : 'top']: scrollPosition,
      });
    }
  }, [calculateScrollPosition, orientation, smoothScrollDuration]);

  // Scroll event into view when selected
  const scrollEventIntoView = useCallback((eventId: string) => {
    const event = timeline.events.find(e => e.id === eventId);
    if (event) {
      scrollToPosition(event.timestamp);
    }
  }, [timeline.events, scrollToPosition]);

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (isScrolling) return; // Avoid feedback loops during programmatic scrolling
    
    const scrollElement = event.currentTarget;
    const scrollPos = orientation === 'horizontal' ? scrollElement.scrollLeft : scrollElement.scrollTop;
    const maxScroll = orientation === 'horizontal' 
      ? scrollElement.scrollWidth - scrollElement.clientWidth
      : scrollElement.scrollHeight - scrollElement.clientHeight;
    
    if (maxScroll > 0) {
      const normalizedPosition = scrollPos / maxScroll;
      const timelinePosition = normalizedPosition * timeline.duration;
      
      setScrollPosition(timelinePosition);
      onPositionChange?.(timelinePosition);
    }
  }, [isScrolling, orientation, timeline.duration, onPositionChange]);

  // Enhanced event selection with auto-scroll
  const handleEventSelect = useCallback((event: TimelineEvent) => {
    selectionActions.selectEvent(event.id);
    
    // Auto-scroll to selected event if enabled
    if (autoScroll) {
      scrollEventIntoView(event.id);
    }
    
    // Call external handler
    onEventSelect?.(event);
  }, [selectionActions, autoScroll, scrollEventIntoView, onEventSelect]);

  // Handle feedback expansion
  const handleFeedbackExpand = useCallback((eventId: string, expanded: boolean) => {
    if (expanded) {
      selectionActions.expandEvent(eventId);
    } else {
      selectionActions.collapseEvent(eventId);
    }
  }, [selectionActions]);

  // Handle keyboard events for navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Prevent default for handled keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
    }
    
    selectionActions.handleKeyboardNavigation(event.key, timeline.events);
  }, [selectionActions, timeline.events]);

  // Auto-scroll when timeline position changes externally
  useEffect(() => {
    if (autoScroll && !isScrolling) {
      scrollToPosition(timeline.currentPosition, false);
    }
  }, [timeline.currentPosition, autoScroll, isScrolling, scrollToPosition]);

  // Auto-scroll when selection changes
  useEffect(() => {
    if (selectionState.selectedEventId && autoScroll) {
      scrollEventIntoView(selectionState.selectedEventId);
    }
  }, [selectionState.selectedEventId, autoScroll, scrollEventIntoView]);

  // Sync external selectedEventId with internal state
  useEffect(() => {
    if (selectedEventId && selectedEventId !== selectionState.selectedEventId) {
      selectionActions.selectEvent(selectedEventId);
    }
  }, [selectedEventId, selectionState.selectedEventId, selectionActions]);

  // Position indicator component
  const PositionIndicator = () => {
    const indicatorPosition = timeline.duration > 0 
      ? (timeline.currentPosition / timeline.duration) * 100 
      : 0;
    
    return (
      <div 
        className={cn(
          "absolute z-10 bg-blue-500 transition-all duration-200",
          orientation === 'horizontal' 
            ? "top-0 bottom-0 w-0.5" 
            : "left-0 right-0 h-0.5"
        )}
        style={{
          [orientation === 'horizontal' ? 'left' : 'top']: `${indicatorPosition}%`
        }}
      >
        <div className={cn(
          "absolute bg-blue-500 rounded-full",
          orientation === 'horizontal' 
            ? "-top-1 -left-1 w-2 h-2" 
            : "-left-1 -top-1 w-2 h-2"
        )} />
      </div>
    );
  };

  return (
    <div 
      className={cn("relative", className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Timeline interface"
      aria-describedby="timeline-instructions"
    >
      {/* Keyboard instructions */}
      <div id="timeline-instructions" className="sr-only">
        Use arrow keys to navigate events, Enter or Space to select, E to expand/collapse feedback, Escape to deselect.
      </div>

      {/* Timeline progress indicator */}
      <div className="mb-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>{formatTimestamp(timeline.currentPosition)}</span>
        <span className="text-xs">
          {timeline.events.length} events • {timeline.metadata.totalSlides} slides
          {selectionState.selectedEventId && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              • Selected: {timeline.events.find(e => e.id === selectionState.selectedEventId)?.title}
            </span>
          )}
        </span>
        <span>{formatTimestamp(timeline.duration)}</span>
      </div>

      {/* Scrollable timeline container */}
      <div className="relative border rounded-lg bg-white dark:bg-gray-900">
        <PositionIndicator />
        
        <ScrollArea 
          className={cn(
            "w-full",
            orientation === 'horizontal' ? "h-40" : "h-96" // Increased height for feedback
          )}
        >
          <div 
            ref={scrollRef}
            className={cn(
              "p-4",
              orientation === 'horizontal' 
                ? "flex items-start space-x-4 min-w-max" 
                : "space-y-4"
            )}
            onScroll={handleScroll}
          >
            {timeline.events.map((event, index) => (
              <TimelineEventMarker
                key={event.id}
                event={event}
                index={index}
                orientation={orientation}
                isActive={Math.abs(event.timestamp - timeline.currentPosition) < 1}
                isSelected={isEventSelected(event.id, selectionState)}
                isFocused={isEventFocused(event.id, selectionState)}
                onSelect={handleEventSelect}
                onFeedbackExpand={handleFeedbackExpand}
                showThumbnail={props.showThumbnails}
                showFeedback={showFeedback}
                isFeedbackExpanded={isEventExpanded(event.id, selectionState)}
              />
            ))}
          </div>
          
          <ScrollBar orientation={orientation} />
        </ScrollArea>
      </div>

      {/* Timeline metadata */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {timeline.metadata.fileName} • Analyzed {new Date(timeline.metadata.analysisDate).toLocaleDateString()}
        {selectionState.expandedEventIds.size > 0 && (
          <span className="ml-2">
            • {selectionState.expandedEventIds.size} expanded
          </span>
        )}
      </div>
    </div>
  );
}

// Enhanced timeline event marker component
interface TimelineEventMarkerProps {
  event: TimelineEvent;
  index: number;
  orientation: 'horizontal' | 'vertical';
  isActive?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
  onSelect?: (event: TimelineEvent) => void;
  onFeedbackExpand?: (eventId: string, expanded: boolean) => void;
  showThumbnail?: boolean;
  showFeedback?: boolean;
  isFeedbackExpanded?: boolean;
}

function TimelineEventMarker({
  event,
  index,
  orientation,
  isActive = false,
  isSelected = false,
  isFocused = false,
  onSelect,
  onFeedbackExpand,
  showThumbnail = true,
  showFeedback = true,
  isFeedbackExpanded = false
}: TimelineEventMarkerProps) {
  const handleClick = () => {
    onSelect?.(event);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleClick();
    }
  };

  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'slide': return '🖼️';
      case 'transcript_segment': return '💬';
      case 'recommendation': return '💡';
      case 'analysis_point': return '📊';
      default: return '📌';
    }
  };

  return (
    <div 
      className={cn(
        "flex cursor-pointer transition-all duration-200 rounded-lg",
        orientation === 'horizontal' ? "flex-col items-center min-w-[120px]" : "flex-row items-start space-x-3",
        // Active state (timeline position)
        isActive && "ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-950/20",
        // Selected state (user selection)
        isSelected && "ring-2 ring-blue-600 bg-blue-100 dark:bg-blue-900/30 shadow-lg",
        // Focused state (keyboard navigation)
        isFocused && "ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/20",
        // Combined states
        isSelected && isActive && "ring-2 ring-blue-600",
        "p-2"
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${event.title} at ${formatTimestamp(event.timestamp)}${isSelected ? ' (selected)' : ''}${isActive ? ' (current)' : ''}`}
      aria-pressed={isSelected}
      aria-describedby={`event-${event.id}-details`}
    >
      {/* Main event content */}
      <div className={cn(
        "flex items-center",
        orientation === 'horizontal' ? "flex-col" : "flex-row space-x-3"
      )}>
        {/* Enhanced thumbnail with selection indicators */}
        {showThumbnail && event.slide?.thumbnail && (
          <SlideThumbnail
            event={event}
            size="small"
            orientation={orientation}
            showSlideNumber={true}
            showTimestamp={false}
            isActive={isSelected || isActive}
            onClick={onSelect}
            className={cn(
              orientation === 'horizontal' ? "mb-2" : "",
              isSelected && "ring-2 ring-blue-500",
              isFocused && "ring-2 ring-purple-400"
            )}
          />
        )}

        {/* Event marker for non-slide events or when thumbnails are disabled */}
        {(!showThumbnail || !event.slide?.thumbnail) && (
          <div className={cn(
            "flex items-center justify-center rounded-full border-2 transition-colors",
            isSelected 
              ? "bg-blue-500 border-blue-500 text-white" 
              : isActive 
                ? "bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" 
                : isFocused
                  ? "bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400",
            orientation === 'horizontal' ? "w-8 h-8" : "w-6 h-6 text-sm"
          )}>
            {getEventIcon(event.type)}
          </div>
        )}

        {/* Event info with enhanced styling */}
        <div 
          id={`event-${event.id}-details`}
          className={cn(
            "text-center",
            orientation === 'horizontal' ? "mt-1" : "ml-2"
          )}
        >
          <div className={cn(
            "text-xs font-medium truncate max-w-[100px]",
            isSelected 
              ? "text-blue-800 dark:text-blue-200" 
              : "text-gray-900 dark:text-gray-100"
          )}>
            {event.title}
          </div>
          <div className={cn(
            "text-xs",
            isSelected 
              ? "text-blue-600 dark:text-blue-400" 
              : "text-gray-500 dark:text-gray-400"
          )}>
            {formatTimestamp(event.timestamp)}
          </div>
        </div>
      </div>

      {/* Enhanced feedback section */}
      {showFeedback && event.feedback && (
        <div className={cn(
          orientation === 'horizontal' ? "mt-2 w-full" : "ml-3 flex-1"
        )}>
          <TimelineFeedback
            event={event}
            isExpanded={isFeedbackExpanded}
            onToggleExpand={onFeedbackExpand}
            showCompact={true}
            className={cn(
              isSelected && "ring-1 ring-blue-300 dark:ring-blue-700"
            )}
          />
        </div>
      )}

      {/* Selection indicators */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm" />
      )}
      {isFocused && !isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white shadow-sm" />
      )}
    </div>
  );
} 
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { TimelineEvent, SlideTimeline } from '@/lib/timeline-types';
import { SlideThumbnail } from './slide-thumbnail';
import { TimelineFeedback } from './timeline-feedback';
import { usePerformanceMonitor, useScrollPerformance } from '@/lib/use-performance-monitor';

interface VirtualTimelineProps {
  timeline: SlideTimeline;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number; // Number of items to render outside visible area
  orientation?: 'horizontal' | 'vertical';
  onEventSelect?: (event: TimelineEvent) => void;
  selectedEventId?: string;
  className?: string;
}

interface VirtualItem {
  index: number;
  event: TimelineEvent;
  position: number;
  size: number;
}

export function VirtualTimeline({
  timeline,
  itemHeight = 120,
  containerHeight = 400,
  overscan = 5,
  orientation = 'horizontal',
  onEventSelect,
  selectedEventId,
  className,
}: VirtualTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Performance monitoring
  const performanceMetrics = usePerformanceMonitor('VirtualTimeline', {
    enabled: true,
    logToConsole: true,
    warningThreshold: 8, // Stricter threshold for virtual scrolling
  });
  
  const scrollMetrics = useScrollPerformance(containerRef as React.RefObject<HTMLDivElement>);

  // Calculate virtual items
  const virtualItems: VirtualItem[] = useMemo(() => {
    return timeline.events.map((event, index) => ({
      index,
      event,
      position: index * itemHeight,
      size: itemHeight,
    }));
  }, [timeline.events, itemHeight]);

  const totalSize = virtualItems.length * itemHeight;
  
  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      virtualItems.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, virtualItems.length, overscan]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return virtualItems.slice(visibleRange.start, visibleRange.end + 1);
  }, [virtualItems, visibleRange]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = orientation === 'horizontal' 
      ? e.currentTarget.scrollLeft 
      : e.currentTarget.scrollTop;
    setScrollTop(scrollTop);
  }, [orientation]);

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    
    return () => resizeObserver.disconnect();
  }, []);

  // Optimize event selection
  const handleEventSelect = useCallback((event: TimelineEvent) => {
    onEventSelect?.(event);
  }, [onEventSelect]);

  // Scroll to specific event
  const scrollToEvent = useCallback((eventId: string) => {
    const eventIndex = timeline.events.findIndex(event => event.id === eventId);
    if (eventIndex >= 0 && containerRef.current) {
      const position = eventIndex * itemHeight;
      containerRef.current.scrollTo({
        [orientation === 'horizontal' ? 'left' : 'top']: position,
        behavior: 'smooth',
      });
    }
  }, [timeline.events, itemHeight, orientation]);

  // Auto-scroll to selected event
  useEffect(() => {
    if (selectedEventId) {
      scrollToEvent(selectedEventId);
    }
  }, [selectedEventId, scrollToEvent]);

  const containerStyle = orientation === 'horizontal' 
    ? {
        width: '100%',
        height: containerHeight,
        overflowX: 'auto' as const,
        overflowY: 'hidden' as const,
      }
    : {
        width: '100%',
        height: containerHeight,
        overflowX: 'hidden' as const,
        overflowY: 'auto' as const,
      };

  const innerStyle = orientation === 'horizontal'
    ? {
        width: totalSize,
        height: '100%',
        position: 'relative' as const,
      }
    : {
        width: '100%',
        height: totalSize,
        position: 'relative' as const,
      };

  return (
    <div className={cn("virtual-timeline", className)}>
      {/* Performance metrics (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground mb-2 font-mono">
          Render: {performanceMetrics.lastRenderTime.toFixed(1)}ms | 
          Avg: {performanceMetrics.averageRenderTime.toFixed(1)}ms | 
          Visible: {visibleItems.length}/{timeline.events.length} | 
          Scroll: {scrollMetrics.isScrolling ? 'Active' : 'Idle'}
        </div>
      )}
      
      <div
        ref={containerRef}
        className="virtual-timeline-container"
        style={containerStyle}
        onScroll={handleScroll}
        role="region"
        aria-label={`Timeline with ${timeline.events.length} events`}
        tabIndex={0}
      >
        <div style={innerStyle}>
          {visibleItems.map((virtualItem) => {
            const { event, position, index } = virtualItem;
            const isSelected = selectedEventId === event.id;
            
            const itemStyle = orientation === 'horizontal'
              ? {
                  position: 'absolute' as const,
                  left: position,
                  top: 0,
                  width: itemHeight,
                  height: '100%',
                }
              : {
                  position: 'absolute' as const,
                  left: 0,
                  top: position,
                  width: '100%',
                  height: itemHeight,
                };

            return (
              <div
                key={event.id}
                style={itemStyle}
                className={cn(
                  "virtual-timeline-item flex items-center justify-center p-2",
                  orientation === 'horizontal' ? 'flex-col' : 'flex-row',
                  isSelected && "ring-2 ring-primary ring-offset-2"
                )}
              >
                <div className={cn(
                  "flex gap-2",
                  orientation === 'horizontal' ? 'flex-col items-center' : 'flex-row items-center'
                )}>
                  <SlideThumbnail
                    event={event}
                    size="small"
                    isSelected={isSelected}
                    showTimestamp
                    onClick={handleEventSelect}
                    orientation={orientation}
                  />
                  
                  {event.feedback && (
                    <TimelineFeedback
                      event={event}
                      isSelected={isSelected}
                      showCompact
                      className="max-w-[200px]"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualTimeline; 
import { useState, useCallback, useEffect } from 'react';
import { TimelineEvent } from './timeline-types';

export interface TimelineSelectionState {
  selectedEventId: string | null;
  expandedEventIds: Set<string>;
  focusedEventId: string | null;
}

export interface TimelineSelectionActions {
  selectEvent: (eventId: string) => void;
  deselectEvent: () => void;
  toggleEventExpansion: (eventId: string) => void;
  expandEvent: (eventId: string) => void;
  collapseEvent: (eventId: string) => void;
  setFocusedEvent: (eventId: string | null) => void;
  handleKeyboardNavigation: (key: string, events: TimelineEvent[]) => void;
}

export interface UseTimelineSelectionOptions {
  onEventSelect?: (event: TimelineEvent) => void;
  onEventExpand?: (eventId: string, expanded: boolean) => void;
  autoExpand?: boolean; // Auto-expand feedback when selecting
  multiSelect?: boolean; // Allow multiple events to be expanded
}

export function useTimelineSelection(
  options: UseTimelineSelectionOptions = {}
): [TimelineSelectionState, TimelineSelectionActions] {
  const {
    onEventSelect,
    onEventExpand,
    autoExpand = true,
    multiSelect = true
  } = options;

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

  // Select an event
  const selectEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setFocusedEventId(eventId);
    
    // Auto-expand feedback if enabled
    if (autoExpand) {
      setExpandedEventIds(prev => new Set(prev).add(eventId));
    }
  }, [autoExpand]);

  // Deselect current event
  const deselectEvent = useCallback(() => {
    setSelectedEventId(null);
    setFocusedEventId(null);
  }, []);

  // Toggle event expansion
  const toggleEventExpansion = useCallback((eventId: string) => {
    setExpandedEventIds(prev => {
      const newSet = new Set(prev);
      const isExpanding = !newSet.has(eventId);
      
      if (isExpanding) {
        newSet.add(eventId);
      } else {
        newSet.delete(eventId);
      }
      
      // Call external handler
      onEventExpand?.(eventId, isExpanding);
      
      return newSet;
    });
  }, [onEventExpand]);

  // Expand specific event
  const expandEvent = useCallback((eventId: string) => {
    setExpandedEventIds(prev => {
      const newSet = new Set(prev);
      if (!newSet.has(eventId)) {
        newSet.add(eventId);
        onEventExpand?.(eventId, true);
      }
      return newSet;
    });
  }, [onEventExpand]);

  // Collapse specific event
  const collapseEvent = useCallback((eventId: string) => {
    setExpandedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
        onEventExpand?.(eventId, false);
      }
      return newSet;
    });
  }, [onEventExpand]);

  // Handle keyboard navigation
  const handleKeyboardNavigation = useCallback((key: string, events: TimelineEvent[]) => {
    if (events.length === 0) return;

    const currentIndex = focusedEventId 
      ? events.findIndex(event => event.id === focusedEventId)
      : -1;

    switch (key) {
      case 'ArrowLeft':
      case 'ArrowUp': {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : events.length - 1;
        const prevEvent = events[prevIndex];
        setFocusedEventId(prevEvent.id);
        break;
      }
      case 'ArrowRight':
      case 'ArrowDown': {
        const nextIndex = currentIndex < events.length - 1 ? currentIndex + 1 : 0;
        const nextEvent = events[nextIndex];
        setFocusedEventId(nextEvent.id);
        break;
      }
      case 'Enter':
      case ' ': {
        if (focusedEventId) {
          selectEvent(focusedEventId);
          const focusedEvent = events.find(event => event.id === focusedEventId);
          if (focusedEvent && onEventSelect) {
            onEventSelect(focusedEvent);
          }
        }
        break;
      }
      case 'Escape': {
        deselectEvent();
        break;
      }
      case 'e':
      case 'E': {
        if (focusedEventId) {
          toggleEventExpansion(focusedEventId);
        }
        break;
      }
      case 'Home': {
        if (events.length > 0) {
          setFocusedEventId(events[0].id);
        }
        break;
      }
      case 'End': {
        if (events.length > 0) {
          setFocusedEventId(events[events.length - 1].id);
        }
        break;
      }
    }
  }, [focusedEventId, selectEvent, deselectEvent, toggleEventExpansion, onEventSelect]);

  // Create state object
  const state: TimelineSelectionState = {
    selectedEventId,
    expandedEventIds,
    focusedEventId
  };

  // Create actions object
  const actions: TimelineSelectionActions = {
    selectEvent,
    deselectEvent,
    toggleEventExpansion,
    expandEvent,
    collapseEvent,
    setFocusedEvent: setFocusedEventId,
    handleKeyboardNavigation
  };

  return [state, actions];
}

// Helper function to check if an event is selected
export function isEventSelected(eventId: string, state: TimelineSelectionState): boolean {
  return state.selectedEventId === eventId;
}

// Helper function to check if an event is expanded
export function isEventExpanded(eventId: string, state: TimelineSelectionState): boolean {
  return state.expandedEventIds.has(eventId);
}

// Helper function to check if an event is focused
export function isEventFocused(eventId: string, state: TimelineSelectionState): boolean {
  return state.focusedEventId === eventId;
} 
import { TimelineEvent } from './timeline-types';
import { TranscriptionSegment } from './whisper-service';
import { TranscriptSegmentData } from '@/components/transcript-display';

// Synchronization state interface
export interface TimelineTranscriptSyncState {
  selectedTimelineEventId: string | null;
  selectedTranscriptSegmentId: string | null;
  highlightedTimelineEventIds: string[];
  highlightedTranscriptSegmentIds: string[];
  currentTimestamp: number;
  isPlaying: boolean;
  syncEnabled: boolean;
}

// Synchronization events
export interface SyncEvents {
  onTimelineEventSelect: (eventId: string, event: TimelineEvent) => void;
  onTranscriptSegmentSelect: (segmentId: string, segment: TranscriptSegmentData) => void;
  onTimestampSeek: (timestamp: number) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onSyncToggle: (enabled: boolean) => void;
}

// Tolerance for timestamp matching (in seconds)
const TIMESTAMP_TOLERANCE = 0.5;

/**
 * Find timeline events that correspond to a transcript segment timestamp
 */
export function findTimelineEventsForTimestamp(
  events: TimelineEvent[],
  timestamp: number,
  tolerance: number = TIMESTAMP_TOLERANCE
): TimelineEvent[] {
  return events.filter(event => {
    const eventTimestamp = event.timestamp;
    return Math.abs(eventTimestamp - timestamp) <= tolerance;
  });
}

/**
 * Find transcript segments that correspond to a timeline event timestamp
 */
export function findTranscriptSegmentsForTimestamp(
  segments: TranscriptSegmentData[],
  timestamp: number,
  tolerance: number = TIMESTAMP_TOLERANCE
): TranscriptSegmentData[] {
  return segments.filter(segment => {
    // Check if timestamp falls within segment range
    return timestamp >= segment.start - tolerance && 
           timestamp <= segment.end + tolerance;
  });
}

/**
 * Find the closest timeline event to a given timestamp
 */
export function findClosestTimelineEvent(
  events: TimelineEvent[],
  timestamp: number
): TimelineEvent | null {
  if (events.length === 0) return null;

  return events.reduce((closest, event) => {
    const currentDistance = Math.abs(event.timestamp - timestamp);
    const closestDistance = Math.abs(closest.timestamp - timestamp);
    return currentDistance < closestDistance ? event : closest;
  });
}

/**
 * Find the closest transcript segment to a given timestamp
 */
export function findClosestTranscriptSegment(
  segments: TranscriptSegmentData[],
  timestamp: number
): TranscriptSegmentData | null {
  if (segments.length === 0) return null;

  return segments.reduce((closest, segment) => {
    // Calculate distance to segment center
    const segmentCenter = (segment.start + segment.end) / 2;
    const currentDistance = Math.abs(segmentCenter - timestamp);
    
    const closestCenter = (closest.start + closest.end) / 2;
    const closestDistance = Math.abs(closestCenter - timestamp);
    
    return currentDistance < closestDistance ? segment : closest;
  });
}

/**
 * Get the transcript segment that contains a specific timestamp
 */
export function getActiveTranscriptSegment(
  segments: TranscriptSegmentData[],
  timestamp: number
): TranscriptSegmentData | null {
  return segments.find(segment => 
    timestamp >= segment.start && timestamp <= segment.end
  ) || null;
}

/**
 * Get timeline events that are active at a specific timestamp
 */
export function getActiveTimelineEvents(
  events: TimelineEvent[],
  timestamp: number,
  tolerance: number = TIMESTAMP_TOLERANCE
): TimelineEvent[] {
  return events.filter(event => 
    Math.abs(event.timestamp - timestamp) <= tolerance
  );
}

/**
 * Convert timeline event to transcript-compatible format
 */
export function timelineEventToTranscriptData(event: TimelineEvent): TranscriptSegmentData | null {
  if (!event.transcript) return null;
  
  return {
    id: `timeline-${event.id}`,
    index: parseInt(event.id) || 0,
    text: event.transcript.text,
    start: event.timestamp,
    end: event.timestamp + (event.transcript.segment.end - event.transcript.segment.start),
    confidence: event.transcript.confidence,
    isSelected: event.isSelected,
    isHighlighted: false,
  };
}

/**
 * Convert transcript segment to timeline-compatible format
 */
export function transcriptSegmentToTimelineEvent(
  segment: TranscriptSegmentData,
  index: number
): TimelineEvent {
  return {
    id: `transcript-${segment.id}`,
    timestamp: segment.start,
    title: `Transcript Segment ${segment.index + 1}`,
    type: 'transcript_segment',
    transcript: {
      text: segment.text,
      segment: {
        id: segment.index,
        seek: 0,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        tokens: [],
        temperature: 0,
        avg_logprob: segment.confidence ? Math.log(segment.confidence) : 0,
        compression_ratio: 0,
        no_speech_prob: 0,
      },
      confidence: segment.confidence || 0.5,
    },
    isExpanded: false,
    isSelected: segment.isSelected || false,
  };
}

/**
 * Sync timeline selection with transcript
 */
export function syncTimelineToTranscript(
  selectedEventId: string | null,
  events: TimelineEvent[],
  segments: TranscriptSegmentData[]
): {
  selectedSegmentId: string | null;
  highlightedSegmentIds: string[];
} {
  if (!selectedEventId) {
    return {
      selectedSegmentId: null,
      highlightedSegmentIds: [],
    };
  }

  const selectedEvent = events.find(e => e.id === selectedEventId);
  if (!selectedEvent) {
    return {
      selectedSegmentId: null,
      highlightedSegmentIds: [],
    };
  }

  // Find corresponding transcript segments
  const correspondingSegments = findTranscriptSegmentsForTimestamp(
    segments,
    selectedEvent.timestamp
  );

  const closestSegment = findClosestTranscriptSegment(segments, selectedEvent.timestamp);

  return {
    selectedSegmentId: closestSegment?.id || null,
    highlightedSegmentIds: correspondingSegments.map(s => s.id),
  };
}

/**
 * Sync transcript selection with timeline
 */
export function syncTranscriptToTimeline(
  selectedSegmentId: string | null,
  segments: TranscriptSegmentData[],
  events: TimelineEvent[]
): {
  selectedEventId: string | null;
  highlightedEventIds: string[];
} {
  if (!selectedSegmentId) {
    return {
      selectedEventId: null,
      highlightedEventIds: [],
    };
  }

  const selectedSegment = segments.find(s => s.id === selectedSegmentId);
  if (!selectedSegment) {
    return {
      selectedEventId: null,
      highlightedEventIds: [],
    };
  }

  // Find corresponding timeline events
  const correspondingEvents = findTimelineEventsForTimestamp(
    events,
    selectedSegment.start
  );

  const closestEvent = findClosestTimelineEvent(events, selectedSegment.start);

  return {
    selectedEventId: closestEvent?.id || null,
    highlightedEventIds: correspondingEvents.map(e => e.id),
  };
}

/**
 * Create a unified sync state manager
 */
export function createTimelineTranscriptSync() {
  let state: TimelineTranscriptSyncState = {
    selectedTimelineEventId: null,
    selectedTranscriptSegmentId: null,
    highlightedTimelineEventIds: [],
    highlightedTranscriptSegmentIds: [],
    currentTimestamp: 0,
    isPlaying: false,
    syncEnabled: true,
  };

  const listeners: Partial<SyncEvents>[] = [];

  const addListener = (events: Partial<SyncEvents>) => {
    listeners.push(events);
  };

  const removeListener = (events: Partial<SyncEvents>) => {
    const index = listeners.indexOf(events);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };

  const emit = <K extends keyof SyncEvents>(event: K, ...args: Parameters<SyncEvents[K]>) => {
    listeners.forEach(listener => {
      const handler = listener[event];
      if (handler) {
        (handler as any)(...args);
      }
    });
  };

  const updateState = (updates: Partial<TimelineTranscriptSyncState>) => {
    state = { ...state, ...updates };
  };

  const getState = () => ({ ...state });

  const selectTimelineEvent = (
    eventId: string,
    event: TimelineEvent,
    events: TimelineEvent[],
    segments: TranscriptSegmentData[]
  ) => {
    updateState({ selectedTimelineEventId: eventId });
    emit('onTimelineEventSelect', eventId, event);

    if (state.syncEnabled) {
      const sync = syncTimelineToTranscript(eventId, events, segments);
      updateState({
        selectedTranscriptSegmentId: sync.selectedSegmentId,
        highlightedTranscriptSegmentIds: sync.highlightedSegmentIds,
      });
    }
  };

  const selectTranscriptSegment = (
    segmentId: string,
    segment: TranscriptSegmentData,
    segments: TranscriptSegmentData[],
    events: TimelineEvent[]
  ) => {
    updateState({ selectedTranscriptSegmentId: segmentId });
    emit('onTranscriptSegmentSelect', segmentId, segment);

    if (state.syncEnabled) {
      const sync = syncTranscriptToTimeline(segmentId, segments, events);
      updateState({
        selectedTimelineEventId: sync.selectedEventId,
        highlightedTimelineEventIds: sync.highlightedEventIds,
      });
    }
  };

  const seekToTimestamp = (timestamp: number) => {
    updateState({ currentTimestamp: timestamp });
    emit('onTimestampSeek', timestamp);
  };

  const setPlayState = (isPlaying: boolean) => {
    updateState({ isPlaying });
    emit('onPlayStateChange', isPlaying);
  };

  const toggleSync = (enabled: boolean) => {
    updateState({ syncEnabled: enabled });
    emit('onSyncToggle', enabled);
  };

  return {
    getState,
    addListener,
    removeListener,
    selectTimelineEvent,
    selectTranscriptSegment,
    seekToTimestamp,
    setPlayState,
    toggleSync,
  };
}

export type TimelineTranscriptSyncManager = ReturnType<typeof createTimelineTranscriptSync>; 
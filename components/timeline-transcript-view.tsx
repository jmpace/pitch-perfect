'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { TimelineEvent, SlideTimeline } from '@/lib/timeline-types';
import { TranscriptionSegment, VerboseTranscriptionResult } from '@/lib/whisper-service';
import { StoredTranscriptionResult } from '@/lib/transcription-results';
import { TimelineScrollArea } from './timeline-scroll-area';
import { TranscriptDisplay, TranscriptSegmentData } from './transcript-display';
import { 
  createTimelineTranscriptSync, 
  TimelineTranscriptSyncManager,
  syncTimelineToTranscript,
  syncTranscriptToTimeline 
} from '@/lib/timeline-transcript-sync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Clock, 
  Link, 
  Unlink,
  Settings,
  Columns2,
  Rows2 
} from 'lucide-react';

export interface TimelineTranscriptViewProps {
  // Data sources
  timeline: SlideTimeline;
  transcriptSegments?: TranscriptionSegment[];
  storedTranscriptResult?: StoredTranscriptionResult;
  verboseTranscriptResult?: VerboseTranscriptionResult;
  
  // Playback state
  currentTimestamp?: number;
  isPlaying?: boolean;
  duration?: number;
  
  // Initial selections
  initialSelectedEventId?: string;
  initialSelectedSegmentId?: string;
  
  // Synchronization settings
  syncEnabled?: boolean;
  autoScroll?: boolean;
  
  // Layout options
  layout?: 'horizontal' | 'vertical';
  timelineSize?: number; // percentage 0-100
  transcriptSize?: number; // percentage 0-100
  
  // Display options
  showTimelineControls?: boolean;
  showTranscriptControls?: boolean;
  showSyncControls?: boolean;
  showTimestamps?: boolean;
  showConfidence?: boolean;
  
  // Event handlers
  onEventSelect?: (eventId: string, event: TimelineEvent) => void;
  onSegmentSelect?: (segmentId: string, segment: TranscriptSegmentData) => void;
  onTimestampSeek?: (timestamp: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onSyncToggle?: (enabled: boolean) => void;
  
  // Styling
  className?: string;
  timelineClassName?: string;
  transcriptClassName?: string;
}

export function TimelineTranscriptView({
  timeline,
  transcriptSegments,
  storedTranscriptResult,
  verboseTranscriptResult,
  currentTimestamp = 0,
  isPlaying = false,
  duration,
  initialSelectedEventId,
  initialSelectedSegmentId,
  syncEnabled = true,
  autoScroll = true,
  layout = 'horizontal',
  timelineSize = 50,
  transcriptSize = 50,
  showTimelineControls = true,
  showTranscriptControls = true,
  showSyncControls = true,
  showTimestamps = true,
  showConfidence = false,
  onEventSelect,
  onSegmentSelect,
  onTimestampSeek,
  onPlayStateChange,
  onSyncToggle,
  className,
  timelineClassName,
  transcriptClassName,
}: TimelineTranscriptViewProps) {
  // Sync manager
  const syncManagerRef = useRef<TimelineTranscriptSyncManager | null>(null);
  const [isSyncEnabled, setIsSyncEnabled] = useState(syncEnabled);
  const [currentLayout, setCurrentLayout] = useState(layout);
  const [localCurrentTimestamp, setLocalCurrentTimestamp] = useState(currentTimestamp);
  const [localIsPlaying, setLocalIsPlaying] = useState(isPlaying);

  // Selection states
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialSelectedEventId || null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(initialSelectedSegmentId || null);
  const [highlightedEventIds, setHighlightedEventIds] = useState<string[]>([]);
  const [highlightedSegmentIds, setHighlightedSegmentIds] = useState<string[]>([]);

  // Initialize sync manager
  useEffect(() => {
    if (!syncManagerRef.current) {
      syncManagerRef.current = createTimelineTranscriptSync();
      
      // Add listeners for external communication
      syncManagerRef.current.addListener({
        onTimelineEventSelect: (eventId, event) => {
          onEventSelect?.(eventId, event);
        },
        onTranscriptSegmentSelect: (segmentId, segment) => {
          onSegmentSelect?.(segmentId, segment);
        },
        onTimestampSeek: (timestamp) => {
          setLocalCurrentTimestamp(timestamp);
          onTimestampSeek?.(timestamp);
        },
        onPlayStateChange: (playing) => {
          setLocalIsPlaying(playing);
          onPlayStateChange?.(playing);
        },
        onSyncToggle: (enabled) => {
          setIsSyncEnabled(enabled);
          onSyncToggle?.(enabled);
        },
      });
    }
  }, [onEventSelect, onSegmentSelect, onTimestampSeek, onPlayStateChange, onSyncToggle]);

  // Update sync manager state when props change
  useEffect(() => {
    syncManagerRef.current?.toggleSync(isSyncEnabled);
  }, [isSyncEnabled]);

  useEffect(() => {
    setLocalCurrentTimestamp(currentTimestamp);
  }, [currentTimestamp]);

  useEffect(() => {
    setLocalIsPlaying(isPlaying);
  }, [isPlaying]);

  // Convert transcript data to standardized format
  const transcriptData: TranscriptSegmentData[] = React.useMemo(() => {
    let sourceSegments: TranscriptionSegment[] = [];
    
    if (transcriptSegments) {
      sourceSegments = transcriptSegments;
    } else if (storedTranscriptResult) {
      sourceSegments = storedTranscriptResult.segments;
    } else if (verboseTranscriptResult) {
      sourceSegments = verboseTranscriptResult.segments;
    }

    return sourceSegments.map((segment, index) => ({
      id: `segment-${index}`,
      index,
      text: segment.text.trim(),
      start: segment.start,
      end: segment.end,
      confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : undefined,
      isSelected: selectedSegmentId === `segment-${index}`,
      isHighlighted: highlightedSegmentIds.includes(`segment-${index}`),
    }));
  }, [transcriptSegments, storedTranscriptResult, verboseTranscriptResult, selectedSegmentId, highlightedSegmentIds]);

  // Handle timeline event selection
  const handleTimelineEventSelect = useCallback((event: TimelineEvent) => {
    setSelectedEventId(event.id);
    
    if (isSyncEnabled && syncManagerRef.current) {
      const sync = syncTimelineToTranscript(event.id, timeline.events, transcriptData);
      setSelectedSegmentId(sync.selectedSegmentId);
      setHighlightedSegmentIds(sync.highlightedSegmentIds);
      
      syncManagerRef.current.selectTimelineEvent(event.id, event, timeline.events, transcriptData);
    } else {
      onEventSelect?.(event.id, event);
    }
  }, [timeline.events, transcriptData, isSyncEnabled, onEventSelect]);

  // Handle transcript segment selection  
  const handleTranscriptSegmentSelect = useCallback((segmentId: string, segment: TranscriptSegmentData) => {
    setSelectedSegmentId(segmentId);
    
    if (isSyncEnabled && syncManagerRef.current) {
      const sync = syncTranscriptToTimeline(segmentId, transcriptData, timeline.events);
      setSelectedEventId(sync.selectedEventId);
      setHighlightedEventIds(sync.highlightedEventIds);
      
      syncManagerRef.current.selectTranscriptSegment(segmentId, segment, transcriptData, timeline.events);
    } else {
      onSegmentSelect?.(segmentId, segment);
    }
  }, [transcriptData, timeline.events, isSyncEnabled, onSegmentSelect]);

  // Handle timestamp seeking
  const handleTimestampSeek = useCallback((timestamp: number) => {
    setLocalCurrentTimestamp(timestamp);
    syncManagerRef.current?.seekToTimestamp(timestamp);
  }, []);

  // Handle play/pause toggle
  const handlePlayToggle = useCallback(() => {
    const newPlayState = !localIsPlaying;
    setLocalIsPlaying(newPlayState);
    syncManagerRef.current?.setPlayState(newPlayState);
  }, [localIsPlaying]);

  // Handle sync toggle
  const handleSyncToggle = useCallback((enabled: boolean) => {
    setIsSyncEnabled(enabled);
    syncManagerRef.current?.toggleSync(enabled);
    
    // Clear highlights when disabling sync
    if (!enabled) {
      setHighlightedEventIds([]);
      setHighlightedSegmentIds([]);
    }
  }, []);

  // Format timestamp for display
  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Controls component
  const Controls = () => (
    <div className="flex items-center gap-4 p-4 border-b">
      {/* Playback controls */}
      {showTimelineControls && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTimestampSeek(Math.max(0, localCurrentTimestamp - 10))}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayToggle}
          >
            {localIsPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTimestampSeek(localCurrentTimestamp + 10)}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatTimestamp(localCurrentTimestamp)}</span>
            {duration && <span>/ {formatTimestamp(duration)}</span>}
          </div>
        </div>
      )}
      
      <Separator orientation="vertical" className="h-6" />
      
      {/* Sync controls */}
      {showSyncControls && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {isSyncEnabled ? <Link className="h-4 w-4" /> : <Unlink className="h-4 w-4" />}
            <span className="text-sm">Sync</span>
            <Switch
              checked={isSyncEnabled}
              onCheckedChange={handleSyncToggle}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>
      )}
      
      <Separator orientation="vertical" className="h-6" />
      
      {/* Layout controls */}
      <div className="flex items-center gap-2">
        <Button
          variant={currentLayout === 'horizontal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCurrentLayout('horizontal')}
        >
          <Columns2 className="h-4 w-4" />
        </Button>
        <Button
          variant={currentLayout === 'vertical' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCurrentLayout('vertical')}
        >
          <Rows2 className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="ml-auto flex items-center gap-2">
        <Badge variant="secondary">
          {timeline.events.length} events
        </Badge>
        <Badge variant="secondary">
          {transcriptData.length} segments
        </Badge>
      </div>
    </div>
  );

  const timelineProps = {
    timeline: {
      ...timeline,
      events: timeline.events.map(event => ({
        ...event,
        isSelected: selectedEventId === event.id,
        isExpanded: highlightedEventIds.includes(event.id) ? true : event.isExpanded,
      })),
    },
    onEventSelect: handleTimelineEventSelect,
    currentTimestamp: localCurrentTimestamp,
    autoScroll,
    className: timelineClassName,
    orientation: currentLayout as 'horizontal' | 'vertical',
  };

  const transcriptProps = {
    storedResult: storedTranscriptResult,
    verboseResult: verboseTranscriptResult,
    segments: transcriptSegments,
    selectedSegmentId: selectedSegmentId || undefined,
    highlightedSegmentIds,
    onSegmentSelect: handleTranscriptSegmentSelect,
    onTimestampSeek: handleTimestampSeek,
    currentTimestamp: localCurrentTimestamp,
    showTimestamps,
    showConfidence,
    autoScroll,
    className: transcriptClassName,
  };

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <Controls />
      
      <CardContent className="flex-1 p-0">
        <ResizablePanelGroup 
          direction={currentLayout === 'horizontal' ? 'horizontal' : 'vertical'}
          className="h-full"
        >
          <ResizablePanel defaultSize={timelineSize} minSize={20}>
            <div className="h-full p-4">
              <TimelineScrollArea {...timelineProps} />
            </div>
          </ResizablePanel>
          
          <ResizableHandle />
          
          <ResizablePanel defaultSize={transcriptSize} minSize={20}>
            <div className="h-full p-4">
              <TranscriptDisplay {...transcriptProps} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </CardContent>
    </Card>
  );
}

export default TimelineTranscriptView; 
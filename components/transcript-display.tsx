'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { TranscriptionSegment, VerboseTranscriptionResult } from '@/lib/whisper-service';
import { StoredTranscriptionResult } from '@/lib/transcription-results';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Clock, Volume2, ChevronDown, ChevronUp } from 'lucide-react';

export interface TranscriptSegmentData {
  id: string;
  index: number;
  text: string;
  start: number;
  end: number;
  confidence?: number;
  isSelected?: boolean;
  isHighlighted?: boolean;
}

export interface TranscriptDisplayProps {
  // Data source options
  segments?: TranscriptionSegment[];
  storedResult?: StoredTranscriptionResult;
  verboseResult?: VerboseTranscriptionResult;
  
  // Selection and interaction
  selectedSegmentId?: string;
  highlightedSegmentIds?: string[];
  onSegmentSelect?: (segmentId: string, segment: TranscriptSegmentData) => void;
  onSegmentHover?: (segmentId: string | null) => void;
  
  // Timeline synchronization
  currentTimestamp?: number;
  onTimestampSeek?: (timestamp: number) => void;
  
  // Display options
  showTimestamps?: boolean;
  showConfidence?: boolean;
  showLineNumbers?: boolean;
  showSpeakerLabels?: boolean;
  compactMode?: boolean;
  autoScroll?: boolean;
  
  // Styling
  className?: string;
  segmentClassName?: string;
  selectedSegmentClassName?: string;
  highlightedSegmentClassName?: string;
}

const CONFIDENCE_COLORS = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-red-100 text-red-800 border-red-200',
} as const;

export function TranscriptDisplay({
  segments,
  storedResult,
  verboseResult,
  selectedSegmentId,
  highlightedSegmentIds = [],
  onSegmentSelect,
  onSegmentHover,
  currentTimestamp,
  onTimestampSeek,
  showTimestamps = true,
  showConfidence = false,
  showLineNumbers = false,
  showSpeakerLabels = false,
  compactMode = false,
  autoScroll = true,
  className,
  segmentClassName,
  selectedSegmentClassName,
  highlightedSegmentClassName,
}: TranscriptDisplayProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const selectedSegmentRef = useRef<HTMLDivElement>(null);

  // Determine data source and normalize segments
  const transcriptSegments: TranscriptSegmentData[] = React.useMemo(() => {
    let sourceSegments: TranscriptionSegment[] = [];
    
    if (segments) {
      sourceSegments = segments;
    } else if (storedResult) {
      sourceSegments = storedResult.segments;
    } else if (verboseResult) {
      sourceSegments = verboseResult.segments;
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
  }, [segments, storedResult, verboseResult, selectedSegmentId, highlightedSegmentIds]);

  // Auto-scroll to selected segment
  useEffect(() => {
    if (autoScroll && selectedSegmentRef.current) {
      selectedSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedSegmentId, autoScroll]);

  // Format timestamp for display
  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    if (compactMode) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Get confidence level for styling
  const getConfidenceLevel = (confidence?: number): keyof typeof CONFIDENCE_COLORS => {
    if (!confidence) return 'medium';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  // Handle segment selection
  const handleSegmentClick = (segment: TranscriptSegmentData) => {
    onSegmentSelect?.(segment.id, segment);
    onTimestampSeek?.(segment.start);
  };

  // Handle segment hover
  const handleSegmentHover = (segmentId: string | null) => {
    onSegmentHover?.(segmentId);
  };

  // Handle timestamp click
  const handleTimestampClick = (timestamp: number, event: React.MouseEvent) => {
    event.stopPropagation();
    onTimestampSeek?.(timestamp);
  };

  if (transcriptSegments.length === 0) {
    return (
      <Card className={cn("h-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>No transcript available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Transcript
          <Badge variant="secondary" className="ml-auto">
            {transcriptSegments.length} segments
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea ref={scrollAreaRef} className="h-full max-h-[600px] px-4 pb-4">
          <div className="space-y-2">
            {transcriptSegments.map((segment) => {
              const isSelected = segment.isSelected;
              const isHighlighted = segment.isHighlighted;
              const confidenceLevel = getConfidenceLevel(segment.confidence);
              
              return (
                <div
                  key={segment.id}
                  ref={isSelected ? selectedSegmentRef : undefined}
                  className={cn(
                    "group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                    "hover:bg-muted/50 hover:border-border/80",
                    isSelected && "border-primary bg-primary/5 shadow-sm",
                    isHighlighted && "border-orange-200 bg-orange-50",
                    compactMode && "p-2",
                    segmentClassName,
                    isSelected && selectedSegmentClassName,
                    isHighlighted && highlightedSegmentClassName
                  )}
                  onClick={() => handleSegmentClick(segment)}
                  onMouseEnter={() => handleSegmentHover(segment.id)}
                  onMouseLeave={() => handleSegmentHover(null)}
                >
                  {/* Header with timestamp and line number */}
                  <div className="flex items-center gap-2 mb-2">
                    {showLineNumbers && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {segment.index + 1}
                      </Badge>
                    )}
                    
                    {showTimestamps && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-auto p-1 text-xs font-mono text-muted-foreground hover:text-primary",
                          compactMode && "text-xs"
                        )}
                        onClick={(e) => handleTimestampClick(segment.start, e)}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimestamp(segment.start)}
                        {!compactMode && ` - ${formatTimestamp(segment.end)}`}
                      </Button>
                    )}
                    
                    {showConfidence && segment.confidence && (
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", CONFIDENCE_COLORS[confidenceLevel])}
                      >
                        {Math.round(segment.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                  
                  {/* Transcript text */}
                  <p className={cn(
                    "text-sm leading-relaxed select-text",
                    compactMode && "text-xs leading-normal",
                    isSelected && "font-medium"
                  )}>
                    {segment.text}
                  </p>
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default TranscriptDisplay; 
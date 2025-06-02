import { FrameMetadata } from './video-processor';
import { TranscriptionSegment, VerboseTranscriptionResult } from './whisper-service';

// Core timeline event interface
export interface TimelineEvent {
  id: string;
  timestamp: number; // seconds from start
  title: string;
  type: 'slide' | 'transcript_segment' | 'recommendation' | 'analysis_point';
  
  // Slide-specific data
  slide?: {
    index: number;
    thumbnail?: {
      url: string;
      width: number;
      height: number;
    };
    frameMetadata?: FrameMetadata; // from video processor
  };
  
  // Transcript data
  transcript?: {
    text: string;
    segment: TranscriptionSegment; // from whisper service
    confidence: number;
  };
  
  // Analysis feedback
  feedback?: {
    category: string;
    score?: number;
    recommendations: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  
  // UI state
  isExpanded: boolean;
  isSelected: boolean;
}

// Main timeline data structure
export interface SlideTimeline {
  events: TimelineEvent[];
  duration: number; // total duration in seconds
  currentPosition: number; // current playback position
  syncedTranscript?: VerboseTranscriptionResult;
  metadata: {
    totalSlides: number;
    fileName: string;
    analysisDate: string;
  };
}

// Timeline component props
export interface TimelineProps {
  timeline: SlideTimeline;
  onEventSelect?: (event: TimelineEvent) => void;
  onEventExpand?: (eventId: string, expanded: boolean) => void;
  onPositionChange?: (position: number) => void;
  className?: string;
  showThumbnails?: boolean;
  showTranscript?: boolean;
  enableSync?: boolean;
}

// Timeline event card props
export interface TimelineEventCardProps {
  event: TimelineEvent;
  isActive?: boolean;
  onSelect?: (event: TimelineEvent) => void;
  onExpand?: (eventId: string, expanded: boolean) => void;
  showThumbnail?: boolean;
  className?: string;
} 
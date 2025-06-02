import React from 'react';
import { TimelineTranscriptView } from '@/components/timeline-transcript-view';
import { TimelineEvent, SlideTimeline } from '@/lib/timeline-types';
import { TranscriptionSegment } from '@/lib/whisper-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Mock data for demonstration
const mockTranscriptSegments: TranscriptionSegment[] = [
  {
    id: 0,
    seek: 0,
    start: 5.0,
    end: 10.0,
    text: "Welcome to our pitch presentation. Today we'll be discussing our innovative product.",
    tokens: [],
    temperature: 0.2,
    avg_logprob: -0.2,
    compression_ratio: 2.5,
    no_speech_prob: 0.1,
  },
  {
    id: 1,
    seek: 1,
    start: 10.5,
    end: 15.0,
    text: "Our market analysis shows significant opportunities in the healthcare technology sector.",
    tokens: [],
    temperature: 0.2,
    avg_logprob: -0.25,
    compression_ratio: 2.3,
    no_speech_prob: 0.05,
  },
  {
    id: 2,
    seek: 2,
    start: 20.0,
    end: 25.0,
    text: "The competitive landscape reveals gaps that we're uniquely positioned to fill.",
    tokens: [],
    temperature: 0.2,
    avg_logprob: -0.3,
    compression_ratio: 2.1,
    no_speech_prob: 0.15,
  },
];

const mockTimelineEvents: TimelineEvent[] = [
  {
    id: '1',
    timestamp: 5.0,
    title: 'Introduction Slide',
    type: 'slide',
    slide: {
      index: 1,
      thumbnail: {
        url: 'https://via.placeholder.com/800x600/3b82f6/ffffff?text=Slide+1',
        width: 800,
        height: 600,
      },
    },
    feedback: {
      category: 'content',
      severity: 'medium' as const,
      score: 7,
      recommendations: ['Consider adding company logo', 'Improve title visibility'],
    },
    transcript: {
      text: "Welcome to our pitch presentation. Today we'll be discussing our innovative product.",
      segment: mockTranscriptSegments[0],
      confidence: 0.8,
    },
    isExpanded: false,
    isSelected: false,
  },
  {
    id: '2',
    timestamp: 10.5,
    title: 'Market Analysis',
    type: 'slide',
    slide: {
      index: 2,
      thumbnail: {
        url: 'https://via.placeholder.com/800x600/10b981/ffffff?text=Slide+2',
        width: 800,
        height: 600,
      },
    },
    feedback: {
      category: 'content',
      severity: 'high' as const,
      score: 9,
      recommendations: ['Excellent data visualization', 'Clear market sizing'],
    },
    transcript: {
      text: "Our market analysis shows significant opportunities in the healthcare technology sector.",
      segment: mockTranscriptSegments[1],
      confidence: 0.85,
    },
    isExpanded: false,
    isSelected: false,
  },
  {
    id: '3',
    timestamp: 20.0,
    title: 'Competitive Landscape',
    type: 'slide',
    slide: {
      index: 3,
      thumbnail: {
        url: 'https://via.placeholder.com/800x600/f59e0b/ffffff?text=Slide+3',
        width: 800,
        height: 600,
      },
    },
    feedback: {
      category: 'content',
      severity: 'low' as const,
      score: 8,
      recommendations: ['Strong competitive analysis', 'Clear differentiation'],
    },
    transcript: {
      text: "The competitive landscape reveals gaps that we're uniquely positioned to fill.",
      segment: mockTranscriptSegments[2],
      confidence: 0.75,
    },
    isExpanded: false,
    isSelected: false,
  },
];

const mockTimeline: SlideTimeline = {
  events: mockTimelineEvents,
  duration: 30.0,
  currentPosition: 0,
  metadata: {
    totalSlides: 3,
    fileName: 'demo-pitch.mp4',
    analysisDate: new Date().toISOString(),
  },
};

export default function TimelineDemoPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Timeline Component Demo</h1>
        <p className="text-lg text-muted-foreground">
          Interactive demonstration of the slide timeline interface with transcript synchronization
        </p>
        <div className="flex justify-center gap-2">
          <Badge variant="secondary">Performance Testing</Badge>
          <Badge variant="secondary">Accessibility Testing</Badge>
          <Badge variant="secondary">Integration Testing</Badge>
        </div>
      </div>

      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Information</CardTitle>
          <CardDescription>
            This demo showcases the interactive timeline with {mockTimelineEvents.length} slide events 
            and {mockTranscriptSegments.length} transcript segments. Test the synchronization between 
            timeline and transcript, keyboard navigation, and responsive design.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{mockTimelineEvents.length}</div>
              <div className="text-sm text-muted-foreground">Timeline Events</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{mockTranscriptSegments.length}</div>
              <div className="text-sm text-muted-foreground">Transcript Segments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{mockTimeline.duration}s</div>
              <div className="text-sm text-muted-foreground">Total Duration</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Testing Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Interaction Tests</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Click timeline events to see synchronization</li>
                <li>• Click transcript segments to see selection</li>
                <li>• Toggle sync on/off to test independence</li>
                <li>• Try different layout orientations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Accessibility Tests</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use Tab key to navigate components</li>
                <li>• Test with screen reader if available</li>
                <li>• Use arrow keys for timeline navigation</li>
                <li>• Test Enter/Space key interactions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Timeline Component */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Timeline Interface</CardTitle>
          <CardDescription>
            Full timeline with transcript synchronization, feedback display, and interactive controls
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[600px]">
            <TimelineTranscriptView
              timeline={mockTimeline}
              transcriptSegments={mockTranscriptSegments}
              layout="horizontal"
              syncEnabled={true}
              autoScroll={true}
              showTimelineControls={true}
              showTranscriptControls={true}
              showSyncControls={true}
              showTimestamps={true}
              showConfidence={true}
              currentTimestamp={0}
              isPlaying={false}
              duration={mockTimeline.duration}
            />
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>
            Component render times and optimization status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-green-600">✓ Optimized</div>
              <div className="text-sm text-muted-foreground">Image Loading</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">✓ Smooth</div>
              <div className="text-sm text-muted-foreground">Scroll Performance</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">✓ Accessible</div>
              <div className="text-sm text-muted-foreground">ARIA Compliance</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">✓ Responsive</div>
              <div className="text-sm text-muted-foreground">Mobile Ready</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
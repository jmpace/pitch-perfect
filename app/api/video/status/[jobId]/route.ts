// GET /api/video/status/[jobId] - Get video processing status from queue
import { NextRequest, NextResponse } from 'next/server';
import { VideoProcessorQueue } from '@/lib/video-processor-queue';
import { generateRequestId } from '@/lib/errors/handlers';

export interface VideoStatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStage?: string;
  error?: string;
  results?: any;
  estimatedTimeRemaining?: number;
  processingService?: string;
  message?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_JOB_ID',
          message: 'Job ID is required',
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Get job status from queue
    const job = await VideoProcessorQueue.getJob(jobId);

    if (!job) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${jobId} not found`,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    // Calculate estimated time remaining based on progress
    let estimatedTimeRemaining: number | undefined;
    if (job.status === 'processing' && job.progress > 0 && job.progress < 100) {
      const elapsed = job.startedAt ? Date.now() - job.startedAt.getTime() : 0;
      const progressRate = job.progress / Math.max(elapsed, 1);
      const remainingProgress = 100 - job.progress;
      estimatedTimeRemaining = Math.round(remainingProgress / progressRate);
    }

    // Log status check for debugging
    console.log(`[video-status] Job ${jobId} - Status: ${job.status}, Progress: ${job.progress}%, Stage: ${job.currentStage}, ETA: ${estimatedTimeRemaining || 'undefined'}ms`);

    const response: VideoStatusResponse = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      error: job.error,
      results: job.results,
      estimatedTimeRemaining,
      processingService: job.processingService,
      message: getStatusMessage(job.status, job.currentStage)
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    const requestId = generateRequestId();
    console.error('Video status check error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve job status',
        requestId,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }, { status: 500 });
  }
}

// POST method for compatibility with existing polling implementation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  return GET(request, { params });
}

/**
 * Get user-friendly status message
 */
function getStatusMessage(status: string, stage?: string): string {
  switch (status) {
    case 'queued':
      return 'Your video is queued for processing';
    case 'processing':
      switch (stage) {
        case 'initializing':
          return 'Initializing video processing...';
        case 'metadata_extraction':
          return 'Analyzing video properties...';
        case 'frame_extraction':
          return 'Extracting and analyzing frames...';
        case 'audio_extraction':
          return 'Processing audio and generating transcription...';
        case 'finalizing':
          return 'Generating final analysis...';
        default:
          return 'Processing your video...';
      }
    case 'completed':
      return 'Video processing completed successfully';
    case 'failed':
      return 'Video processing failed';
    default:
      return 'Unknown status';
  }
} 
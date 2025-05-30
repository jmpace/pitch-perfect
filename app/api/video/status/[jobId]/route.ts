// GET /api/video/status/[jobId] - Get processing status
import { NextRequest, NextResponse } from 'next/server';
import { VideoProcessor } from '@/lib/video-processor';
import { 
  ProcessingJobNotFoundError,
  MissingParameterError,
  BaseStorageError
} from '@/lib/errors/types';
import { createErrorResponse, generateRequestId } from '@/lib/errors/handlers';

export interface VideoStatusResponse {
  jobId: string;
  status: string;
  progress: number;
  currentStage?: string;
  framesProcessed?: number;
  totalFrames?: number;
  audioProgress?: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  try {
    const { jobId } = await params;

    if (!jobId) {
      throw new MissingParameterError(
        'jobId is required',
        { field: 'jobId' }
      );
    }

    const job = VideoProcessor.getJob(jobId);
    if (!job) {
      throw new ProcessingJobNotFoundError(
        `Processing job ${jobId} not found`,
        { jobId }
      );
    }

    // Determine current stage based on progress
    let currentStage = 'queued';
    if (job.status === 'processing') {
      if (job.progress <= 10) {
        currentStage = 'metadata_extraction';
      } else if (job.progress <= 70) {
        currentStage = 'frame_extraction';
      } else if (job.progress <= 90) {
        currentStage = 'audio_extraction';
      } else {
        currentStage = 'finalizing';
      }
    } else if (job.status === 'completed') {
      currentStage = 'completed';
    } else if (job.status === 'failed') {
      currentStage = 'failed';
    }

    // Estimate remaining time (rough calculation)
    let estimatedTimeRemaining: number | undefined;
    if (job.status === 'processing' && job.startedAt) {
      const elapsed = Date.now() - job.startedAt.getTime();
      const estimatedTotal = elapsed / (job.progress / 100);
      estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);
    }

    const response: VideoStatusResponse = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage,
      estimatedTimeRemaining,
      error: job.error
    };

    // Add processing-specific details if available
    if (job.results) {
      response.framesProcessed = job.results.frames.length;
      response.totalFrames = Math.floor(job.results.videoMetadata.duration / 10); // assuming 10s interval
      response.audioProgress = job.results.audio.url ? 100 : 0;
    }

    return NextResponse.json(response);

  } catch (error: unknown) {
    if (error instanceof Error && 'statusCode' in error) {
      return createErrorResponse(error as BaseStorageError);
    }
    
    // Handle unexpected errors
    const requestId = generateRequestId();
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        requestId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
} 
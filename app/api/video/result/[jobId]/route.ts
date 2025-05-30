// GET /api/video/result/[jobId] - Get processing results
import { NextRequest, NextResponse } from 'next/server';
import { VideoProcessor, ProcessingResults } from '@/lib/video-processor';
import { 
  ProcessingJobNotFoundError,
  MissingParameterError,
  ValidationError
} from '@/lib/errors/types';
import { createErrorResponse, generateRequestId } from '@/lib/errors/handlers';

export interface VideoResultResponse {
  jobId: string;
  status: string;
  results: ProcessingResults;
  completedAt: string;
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

    // Check if job is completed
    if (job.status !== 'completed') {
      throw new ValidationError(
        `Job ${jobId} is not completed yet. Current status: ${job.status}`,
        { 
          jobId, 
          currentStatus: job.status,
          progress: job.progress 
        }
      );
    }

    if (!job.results) {
      throw new ValidationError(
        'Processing results are not available',
        { jobId }
      );
    }

    const response: VideoResultResponse = {
      jobId: job.id,
      status: job.status,
      results: job.results,
      completedAt: job.completedAt?.toISOString() || ''
    };

    return NextResponse.json(response);

  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error);
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
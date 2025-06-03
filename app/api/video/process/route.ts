// POST /api/video/process - Start video processing with queue support
import { NextRequest, NextResponse } from 'next/server';
import { VideoProcessorQueue, VideoProcessingOptions } from '@/lib/video-processor-queue';
import { 
  ValidationError,
  VideoProcessingError,
  MissingParameterError
} from '@/lib/errors/types';
import { createErrorResponse, generateRequestId } from '@/lib/errors/handlers';

export interface ProcessVideoRequest {
  videoUrl: string;
  options?: VideoProcessingOptions;
}

export interface ProcessVideoResponse {
  jobId: string;
  status: string;
  estimatedTime: number;
  message: string;
  processingService: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ProcessVideoRequest = await request.json();

    // Validate required fields
    if (!body.videoUrl) {
      throw new MissingParameterError(
        'videoUrl is required',
        { field: 'videoUrl' }
      );
    }

    // Validate URL format (allow local file paths for testing)
    const isLocalFile = body.videoUrl.startsWith('/') || body.videoUrl.match(/^[A-Z]:/); // Unix or Windows absolute paths
    if (!isLocalFile) {
      try {
        new URL(body.videoUrl);
      } catch {
        throw new ValidationError(
          'Invalid video URL format',
          { videoUrl: body.videoUrl }
        );
      }
    }

    // Start processing with queue using enhanced processor
    const job = await VideoProcessorQueue.startProcessing(
      body.videoUrl,
      body.options || {}
    );

    // Calculate realistic processing time estimate based on video URL
    // For now, use a reasonable default - would calculate based on actual video metadata
    const estimatedTime = 300; // 5 minutes for demo purposes

    const response: ProcessVideoResponse = {
      jobId: job.id,
      status: job.status,
      estimatedTime,
      message: 'Video processing queued successfully',
      processingService: job.processingService
    };

    return NextResponse.json(response, { status: 202 });

  } catch (error: any) {
    if (error.statusCode) {
      return createErrorResponse(error);
    }
    
    // Handle unexpected errors
    const requestId = generateRequestId();
    console.error('Video processing error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while starting video processing',
        requestId,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }, { status: 500 });
  }
} 
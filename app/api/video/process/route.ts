// POST /api/video/process - Start video processing
import { NextRequest, NextResponse } from 'next/server';
import { VideoProcessor, VideoProcessingOptions } from '@/lib/video-processor';
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

    // Start processing
    const job = await VideoProcessor.startProcessing(
      body.videoUrl,
      body.options || {}
    );

    // Estimate processing time (2:1 ratio as per architecture)
    const estimatedTime = 600; // 10 minutes default, would calculate based on video metadata

    const response: ProcessVideoResponse = {
      jobId: job.id,
      status: job.status,
      estimatedTime,
      message: 'Video processing started'
    };

    return NextResponse.json(response, { status: 202 });

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
// API endpoint for optimized video processing with performance monitoring
import { NextRequest } from 'next/server';
import { OptimizedVideoProcessor } from '@/lib/optimized-video-processor';
import { createSuccessResponse, createErrorResponse, normalizeError, generateRequestId } from '@/lib/errors/handlers';
import { ValidationError } from '@/lib/errors/types';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const body = await request.json();
    const { videoUrl, options = {} } = body;

    if (!videoUrl) {
      throw new ValidationError(
        'Video URL is required',
        { field: 'videoUrl' },
        requestId
      );
    }

    // Validate URL format
    try {
      new URL(videoUrl);
    } catch {
      throw new ValidationError(
        'Invalid video URL format',
        { videoUrl },
        requestId
      );
    }

    const job = await OptimizedVideoProcessor.startProcessing(videoUrl, options);
    
    return createSuccessResponse({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      requestId: job.requestId,
      message: 'Optimized video processing started successfully'
    }, requestId);

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'queued' | 'processing' | 'completed' | 'failed' | null;

    const jobs = OptimizedVideoProcessor.getJobs(status || undefined);
    const performanceMetrics = OptimizedVideoProcessor.getPerformanceMetrics();

    return createSuccessResponse({
      jobs: jobs.map(job => ({
        id: job.id,
        videoUrl: job.videoUrl,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        requestId: job.requestId,
        subtasks: job.subtasks,
        hasResults: !!job.results
      })),
      performance: {
        current: performanceMetrics.current,
        workerPool: performanceMetrics.workerPool,
        recommendations: performanceMetrics.recommendations
      },
      totalJobs: jobs.length
    }, requestId);

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
} 
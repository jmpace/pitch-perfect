// API endpoint for individual optimized video processing job status
import { NextRequest } from 'next/server';
import { OptimizedVideoProcessor } from '@/lib/optimized-video-processor';
import { createSuccessResponse, createErrorResponse, normalizeError, generateRequestId } from '@/lib/errors/handlers';
import { ProcessingJobNotFoundError } from '@/lib/errors/types';

export async function GET(
  request: NextRequest, 
  props: { params: Promise<{ jobId: string }> }
) {
  const requestId = generateRequestId();
  
  try {
    const { jobId } = await props.params;

    const job = OptimizedVideoProcessor.getJob(jobId);
    
    if (!job) {
      throw new ProcessingJobNotFoundError(
        `Processing job ${jobId} not found`,
        { jobId },
        requestId
      );
    }

    const response = {
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
      results: job.results ? {
        frames: job.results.frames,
        audio: job.results.audio,
        videoMetadata: job.results.videoMetadata,
        processingStats: job.results.processingStats,
        performanceMetrics: job.results.performanceMetrics
      } : undefined,
      performance: job.performance
    };

    return createSuccessResponse(response, requestId);

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
} 
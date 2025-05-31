// Example of business logic service using the new exception handling patterns
import { 
  withBusinessLogicExceptionHandling,
  withExternalServiceExceptionHandling,
  withDataAccessExceptionHandling,
  BusinessLogicExceptionHandling,
  type ExceptionContext 
} from '@/lib/errors/exception-handlers';
import { ValidationError, ProcessingError, ConfigurationError } from '@/lib/errors/types';

export interface VideoProcessingOptions {
  quality: 'low' | 'medium' | 'high';
  format: 'mp4' | 'webm' | 'avi';
  compression: boolean;
}

export interface ProcessingResult {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  progress: number;
  estimatedCompletion?: Date;
}

/**
 * Business Logic Service demonstrating exception handling patterns
 * Uses class decorator for automatic exception handling
 */
@BusinessLogicExceptionHandling
export class VideoProcessingService {
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  private readonly supportedFormats = ['mp4', 'webm', 'avi'];

  /**
   * Validate video processing request
   * Demonstrates validation error handling
   */
  async validateProcessingRequest(
    videoUrl: string, 
    options: VideoProcessingOptions,
    requestId?: string
  ): Promise<void> {
    const context: Partial<ExceptionContext> = {
      requestId,
      operation: 'validateProcessingRequest',
      metadata: { videoUrl, options }
    };

    // URL validation
    try {
      new URL(videoUrl);
    } catch {
      throw new ValidationError(
        'Invalid video URL format',
        { videoUrl, field: 'videoUrl' }
      );
    }

    // Format validation
    if (!this.supportedFormats.includes(options.format)) {
      throw new ValidationError(
        `Unsupported video format: ${options.format}`,
        { 
          format: options.format, 
          supportedFormats: this.supportedFormats,
          field: 'format' 
        }
      );
    }

    // File size check (simulated external service call)
    const fileSizeCheck = withExternalServiceExceptionHandling(
      async () => {
        const response = await fetch(videoUrl, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        return contentLength ? parseInt(contentLength) : 0;
      },
      'FileSizeService',
      context
    );

    const fileSize = await fileSizeCheck();
    if (fileSize > this.maxFileSize) {
      throw new ValidationError(
        'File size exceeds maximum allowed limit',
        { 
          fileSize,
          maxFileSize: this.maxFileSize,
          field: 'fileSize' 
        }
      );
    }
  }

  /**
   * Process video with comprehensive error handling
   * Demonstrates business logic, data access, and external service error handling
   */
  async processVideo(
    videoUrl: string,
    options: VideoProcessingOptions,
    requestId?: string
  ): Promise<ProcessingResult> {
    // Validation layer
    await this.validateProcessingRequest(videoUrl, options, requestId);

    const context: Partial<ExceptionContext> = {
      requestId,
      operation: 'processVideo',
      metadata: { videoUrl, options }
    };

    // Data access layer - save job to database
    const saveJob = withDataAccessExceptionHandling(
      async (jobData: any) => {
        // Simulated database operation
        console.log('Saving job to database:', jobData);
        return { jobId: `job_${Date.now()}`, saved: true };
      },
      context
    );

    const jobRecord = await saveJob({
      videoUrl,
      options,
      status: 'pending',
      createdAt: new Date()
    });

    // External service layer - call video processing API
    const processVideo = withExternalServiceExceptionHandling(
      async () => {
        // Simulated external video processing service
        const processingResponse = await fetch('/api/external/video-processor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl,
            options,
            jobId: jobRecord.jobId
          })
        });

        if (!processingResponse.ok) {
          throw new ProcessingError(
            'Video processing service failed',
            { 
              statusCode: processingResponse.status,
              statusText: processingResponse.statusText,
              jobId: jobRecord.jobId 
            }
          );
        }

        return await processingResponse.json();
      },
      'VideoProcessingAPI',
      context
    );

    const processingResult = await processVideo();

    // Data access layer - update job status
    const updateJob = withDataAccessExceptionHandling(
      async (jobId: string, updateData: any) => {
        // Simulated database update
        console.log('Updating job status:', jobId, updateData);
        return { updated: true };
      },
      context
    );

    await updateJob(jobRecord.jobId, {
      status: 'processing',
      externalJobId: processingResult.id,
      updatedAt: new Date()
    });

    return {
      jobId: jobRecord.jobId,
      status: 'processing',
      progress: 0,
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    };
  }

  /**
   * Get processing status
   * Demonstrates data access error handling
   */
  async getProcessingStatus(jobId: string, requestId?: string): Promise<ProcessingResult> {
    const context: Partial<ExceptionContext> = {
      requestId,
      operation: 'getProcessingStatus',
      metadata: { jobId }
    };

    const getJobFromDatabase = withDataAccessExceptionHandling(
      async (id: string) => {
        // Simulated database query
        console.log('Fetching job from database:', id);
        
        // Simulate job not found
        if (id === 'invalid_job') {
          return null;
        }

        return {
          jobId: id,
          status: 'completed',
          progress: 100,
          outputUrl: `https://storage.example.com/processed/${id}.mp4`,
          completedAt: new Date()
        };
      },
      context
    );

    const job = await getJobFromDatabase(jobId);
    
    if (!job) {
      throw new ValidationError(
        `Processing job not found: ${jobId}`,
        { jobId, field: 'jobId' }
      );
    }

    return {
      jobId: job.jobId,
      status: job.status as any,
      progress: job.progress,
      outputUrl: job.outputUrl,
      estimatedCompletion: job.completedAt
    };
  }

  /**
   * Cancel processing job
   * Demonstrates configuration and external service error handling
   */
  async cancelProcessing(jobId: string, requestId?: string): Promise<{ cancelled: boolean }> {
    // Check if cancellation is enabled
    const cancellationEnabled = process.env.ENABLE_JOB_CANCELLATION === 'true';
    if (!cancellationEnabled) {
      throw new ConfigurationError(
        'Job cancellation is not enabled in the current environment',
        { 
          feature: 'job_cancellation',
          environment: process.env.NODE_ENV 
        }
      );
    }

    const context: Partial<ExceptionContext> = {
      requestId,
      operation: 'cancelProcessing',
      metadata: { jobId }
    };

    // External service call to cancel the job
    const cancelExternalJob = withExternalServiceExceptionHandling(
      async () => {
        const response = await fetch(`/api/external/video-processor/${jobId}/cancel`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new ProcessingError(
            'Failed to cancel external processing job',
            { 
              jobId,
              statusCode: response.status,
              statusText: response.statusText 
            }
          );
        }

        return await response.json();
      },
      'VideoProcessingAPI',
      context
    );

    await cancelExternalJob();

    // Update job status in database
    const updateJobStatus = withDataAccessExceptionHandling(
      async () => {
        console.log('Updating job status to cancelled:', jobId);
        return { updated: true };
      },
      context
    );

    await updateJobStatus();

    return { cancelled: true };
  }
}

// Example of manual exception handling for standalone functions
export const videoProcessingService = new VideoProcessingService();

/**
 * Standalone function using manual exception handling
 */
export async function getVideoMetadata(videoUrl: string, requestId?: string) {
  const context: Partial<ExceptionContext> = {
    requestId,
    operation: 'getVideoMetadata',
    component: 'VideoProcessingService',
    metadata: { videoUrl }
  };

  return withExternalServiceExceptionHandling(
    async () => {
      const response = await fetch(`/api/external/video-analyzer/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });

      if (!response.ok) {
        throw new ProcessingError(
          'Failed to analyze video metadata',
          { 
            videoUrl,
            statusCode: response.status,
            statusText: response.statusText 
          }
        );
      }

      return await response.json();
    },
    'VideoAnalyzerAPI',
    context
  )();
} 
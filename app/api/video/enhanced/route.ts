// API endpoints for enhanced video processing with storage integration
import { NextRequest, NextResponse } from 'next/server';
import { 
  EnhancedVideoProcessor, 
  EnhancedVideoProcessingOptions 
} from '@/lib/enhanced-video-processor';
import { 
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
  normalizeError,
  withErrorHandling
} from '@/lib/errors/handlers';
import { 
  isStorageError,
  ValidationError
} from '@/lib/errors/types';

// POST /api/video/enhanced - Start enhanced video processing
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const body = await withErrorHandling(
      () => request.json(),
      'parsing_request_body',
      requestId
    );

    const { videoUrl, options = {} } = body;

    if (!videoUrl || typeof videoUrl !== 'string') {
      throw new ValidationError(
        'Missing or invalid videoUrl',
        { provided: typeof videoUrl },
        requestId
      );
    }

    // Validate and sanitize options
    const processingOptions: EnhancedVideoProcessingOptions = {
      frameInterval: options.frameInterval || 10,
      frameQuality: options.frameQuality || 85,
      frameResolution: options.frameResolution || { width: 1280, height: 720 },
      audioFormat: options.audioFormat || 'mp3',
      audioQuality: options.audioQuality || 128,
      extractAudio: options.extractAudio !== false,
      timeout: options.timeout || 900000,
      storageOptions: {
        enableCompression: options.storageOptions?.enableCompression !== false,
        enableCDN: options.storageOptions?.enableCDN !== false,
        generateSignedUrls: options.storageOptions?.generateSignedUrls !== false,
        enableStreaming: options.storageOptions?.enableStreaming || false,
        retentionHours: options.storageOptions?.retentionHours || 24
      }
    };

    // Initialize enhanced video processor if not already done
    EnhancedVideoProcessor.initialize();

    // Start processing
    const job = await EnhancedVideoProcessor.startProcessing(videoUrl, processingOptions);

    return createSuccessResponse({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      estimatedCompletion: new Date(Date.now() + (processingOptions.timeout || 900000)),
      storageConfig: job.storageConfig,
      apiEndpoints: {
        status: `/api/video/enhanced/${job.id}`,
        delivery: `/api/video/enhanced/${job.id}/delivery`,
        content: `/api/storage/video/${job.id}`
      }
    }, requestId);

  } catch (error) {
    const processingError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(processingError);
  }
}

// GET /api/video/enhanced - List all enhanced processing jobs
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const includeStats = searchParams.get('stats') === 'true';

    // Get jobs (filtered by status if provided)
    const jobs = EnhancedVideoProcessor.getJobs(status);

    // Get system statistics if requested
    let stats;
    if (includeStats) {
      stats = EnhancedVideoProcessor.getStats();
    }

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
        storageConfig: job.storageConfig,
        hasResults: !!job.results,
        apiEndpoints: {
          status: `/api/video/enhanced/${job.id}`,
          delivery: `/api/video/enhanced/${job.id}/delivery`,
          content: `/api/storage/video/${job.id}`
        }
      })),
      summary: {
        total: jobs.length,
        byStatus: jobs.reduce((acc: any, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {}),
        filter: status || 'all'
      },
      stats
    }, requestId);

  } catch (error) {
    const processingError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(processingError);
  }
} 
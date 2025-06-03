// GET /api/video/jobs - Query and filter video processing jobs with pagination
import { NextRequest, NextResponse } from 'next/server';
import { videoStatusTracker, JobQuery, JobStage } from '@/lib/video-status-tracker';
import { createErrorResponse, generateRequestId } from '@/lib/errors/handlers';
import { VideoProcessor } from '@/lib/video-processor';
import { CleanupService } from '@/lib/cleanup-service';

export interface VideoJobsResponse {
  jobs: Array<{
    id: string;
    videoUrl: string;
    status: string;
    progress: number;
    currentStage: JobStage;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    queuedAt: string;
    totalQueueTime?: number;
    totalProcessingTime?: number;
    retryCount: number;
    maxRetries: number;
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    lastError?: {
      timestamp: string;
      error: string;
      errorCode: string;
      retryable: boolean;
    };
    stageHistory: Array<{
      stage: JobStage;
      timestamp: string;
      progress: number;
      message?: string;
      metadata?: Record<string, any>;
    }>;
    resourceStats?: {
      peakMemoryUsage: number;
      avgMemoryUsage: number;
      cpuUsage?: number;
      diskUsage?: number;
    };
    results?: {
      framesExtracted: number;
      audioExtracted: boolean;
      processingTime: number;
      memoryUsed: number;
    };
  }>;
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  filters: {
    status?: string | string[];
    stage?: JobStage | JobStage[];
    dateRange?: {
      start: string;
      end: string;
    };
    sortBy: string;
    sortOrder: string;
  };
  timestamp: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const query: JobQuery = {};
    
    // Status filter
    const statusParam = searchParams.get('status');
    if (statusParam) {
      query.status = statusParam.includes(',') 
        ? statusParam.split(',').map(s => s.trim())
        : statusParam;
    }
    
    // Stage filter
    const stageParam = searchParams.get('stage');
    if (stageParam) {
      const stages = stageParam.includes(',') 
        ? stageParam.split(',').map(s => s.trim()) as JobStage[]
        : [stageParam as JobStage];
      query.stage = stages;
    }
    
    // Date range filter
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    if (startParam && endParam) {
      const start = new Date(startParam);
      const end = new Date(endParam);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Invalid date format in start or end parameter',
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      
      if (start >= end) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date must be before end date',
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      
      query.dateRange = { start, end };
    }
    
    // Pagination
    const offsetParam = searchParams.get('offset');
    const limitParam = searchParams.get('limit');
    
    query.offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    query.limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50; // Max 100 per request
    
    if (query.offset < 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Offset must be non-negative',
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    
    if (query.limit <= 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Limit must be positive',
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    
    // Sorting
    const sortByParam = searchParams.get('sortBy');
    const sortOrderParam = searchParams.get('sortOrder');
    
    if (sortByParam && ['createdAt', 'completedAt', 'processingTime'].includes(sortByParam)) {
      query.sortBy = sortByParam as 'createdAt' | 'completedAt' | 'processingTime';
    } else {
      query.sortBy = 'createdAt';
    }
    
    if (sortOrderParam && ['asc', 'desc'].includes(sortOrderParam)) {
      query.sortOrder = sortOrderParam as 'asc' | 'desc';
    } else {
      query.sortOrder = 'desc';
    }

    // Query jobs using the enhanced tracker
    const result = videoStatusTracker.queryJobs(query);

    // Transform jobs for response
    const transformedJobs = result.jobs.map(job => ({
      id: job.id,
      videoUrl: job.videoUrl,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      queuedAt: job.queuedAt.toISOString(),
      totalQueueTime: job.totalQueueTime,
      totalProcessingTime: job.totalProcessingTime,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      userAgent: job.userAgent,
      ipAddress: job.ipAddress,
      sessionId: job.sessionId,
      lastError: job.lastError ? {
        timestamp: job.lastError.timestamp.toISOString(),
        error: job.lastError.error,
        errorCode: job.lastError.errorCode,
        retryable: job.lastError.retryable
      } : undefined,
      stageHistory: job.stageHistory.map(stage => ({
        stage: stage.stage,
        timestamp: stage.timestamp.toISOString(),
        progress: stage.progress,
        message: stage.message,
        metadata: stage.metadata
      })),
      resourceStats: job.resourceStats,
      results: job.results ? {
        framesExtracted: job.results.processingStats.framesExtracted,
        audioExtracted: job.results.processingStats.audioExtracted,
        processingTime: job.results.processingStats.processingTime,
        memoryUsed: job.results.processingStats.memoryUsed
      } : undefined
    }));

    const response: VideoJobsResponse = {
      jobs: transformedJobs,
      pagination: {
        total: result.total,
        offset: query.offset,
        limit: query.limit,
        hasMore: result.hasMore
      },
      filters: {
        status: query.status,
        stage: query.stage,
        dateRange: query.dateRange ? {
          start: query.dateRange.start.toISOString(),
          end: query.dateRange.end.toISOString()
        } : undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder
      },
      timestamp: new Date().toISOString()
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

// POST /api/video/jobs - Manage jobs (stop, cleanup, etc.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobIds, cleanupOldJobs = true, force = false } = body;

    const requestId = generateRequestId();
    let result: any = {};

    switch (action) {
      case 'stop-all':
        // This doesn't actually stop server processing (which is fast anyway)
        // But provides info for users to refresh browsers to stop client polling
        const currentJobs = await VideoProcessor.getJobs('processing');
        result = {
          message: 'Server-side processing jobs cannot be stopped mid-execution, but they complete quickly (30-60s).',
          currentlyProcessing: currentJobs.length,
          activeJobs: currentJobs.map(job => ({
            id: job.id,
            progress: job.progress,
            startedAt: job.startedAt
          })),
          recommendation: 'Users with active browser polling should refresh their pages to stop client-side requests.'
        };
        break;

      case 'cleanup-old':
        const maxAge = body.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
        const cleanedJobs = await VideoProcessor.cleanupOldJobs(maxAge);
        result = {
          message: `Cleaned up ${cleanedJobs} old jobs`,
          cleanedCount: cleanedJobs
        };
        break;

      case 'cleanup-storage':
        // Clean up associated blob storage
        const cleanupReport = await CleanupService.performCleanup({
          dryRun: !force,
          force,
          includeOrphaned: true,
          maxFiles: 1000
        });
        result = {
          message: force ? 'Storage cleanup completed' : 'Storage cleanup preview (use force=true to execute)',
          cleanup: cleanupReport
        };
        break;

      case 'emergency-stop':
        if (!force) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Emergency stop requires force=true parameter',
              requestId 
            },
            { status: 400 }
          );
        }

        // Emergency cleanup: remove all jobs and clean storage
        const allJobs = await VideoProcessor.getJobs();
        const emergencyCleanedJobs = await VideoProcessor.cleanupOldJobs(0); // Clean all jobs
        const emergencyCleanupReport = await CleanupService.emergencyCleanup(false);

        result = {
          message: 'Emergency stop completed - all jobs cleared and storage cleaned',
          jobsCleared: emergencyCleanedJobs,
          previousJobCount: allJobs.length,
          storageCleanup: emergencyCleanupReport,
          warning: 'Users with active browser polling should refresh their pages to stop client-side requests.'
        };
        break;

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action. Supported actions: stop-all, cleanup-old, cleanup-storage, emergency-stop',
            requestId 
          },
          { status: 400 }
        );
    }

    const stats = await VideoProcessor.getStats();

    return NextResponse.json({
      success: true,
      action,
      result,
      currentStats: stats,
      timestamp: new Date().toISOString(),
      requestId
    });

  } catch (error) {
    console.error('Failed to manage video jobs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to manage video jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: generateRequestId()
      },
      { status: 500 }
    );
  }
}

// DELETE /api/video/jobs - Clean up all jobs (alias for emergency-stop)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    if (!force) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'DELETE requires force=true parameter',
          requestId: generateRequestId()
        },
        { status: 400 }
      );
    }

    // Perform emergency cleanup
    const allJobs = await VideoProcessor.getJobs();
    const cleanedJobs = await VideoProcessor.cleanupOldJobs(0);
    const cleanupReport = await CleanupService.emergencyCleanup(false);

    return NextResponse.json({
      success: true,
      message: 'All jobs and storage cleaned up',
      jobsCleared: cleanedJobs,
      previousJobCount: allJobs.length,
      storageCleanup: cleanupReport,
      warning: 'Users with active browser polling should refresh their pages.',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    });

  } catch (error) {
    console.error('Failed to delete video jobs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete video jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: generateRequestId()
      },
      { status: 500 }
    );
  }
} 
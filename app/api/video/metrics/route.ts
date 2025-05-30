// GET /api/video/metrics - Get comprehensive video processing metrics
import { NextRequest, NextResponse } from 'next/server';
import { videoStatusTracker } from '@/lib/video-status-tracker';
import { createErrorResponse, generateRequestId } from '@/lib/errors/handlers';

export interface VideoMetricsResponse {
  summary: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgProcessingTime: number;
    avgQueueTime: number;
    successRate: number;
    throughput: number;
    currentLoad: number;
    resourceUtilization: {
      memory: number;
      cpu: number;
    };
  };
  stageDistribution: Record<string, number>;
  errorAnalysis: {
    topErrors: Array<{ error: string; count: number; lastOccurrence: string }>;
    retryAnalysis: { totalRetries: number; successAfterRetry: number };
  };
  performanceAnalysis: {
    processingTimePercentiles: { p50: number; p90: number; p95: number; p99: number };
    queueTimePercentiles: { p50: number; p90: number; p95: number; p99: number };
  };
  timestamp: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse optional time range
    let timeRange: { start: Date; end: Date } | undefined;
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    if (startParam && endParam) {
      timeRange = {
        start: new Date(startParam),
        end: new Date(endParam)
      };
      
      // Validate date range
      if (isNaN(timeRange.start.getTime()) || isNaN(timeRange.end.getTime())) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Invalid date format in start or end parameter',
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      
      if (timeRange.start >= timeRange.end) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date must be before end date',
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
    }

    const statistics = videoStatusTracker.getJobStatistics(timeRange);

    const response: VideoMetricsResponse = {
      summary: statistics.summary,
      stageDistribution: statistics.stageDistribution,
      errorAnalysis: {
        topErrors: statistics.errorAnalysis.topErrors.map(error => ({
          ...error,
          lastOccurrence: error.lastOccurrence.toISOString()
        })),
        retryAnalysis: statistics.errorAnalysis.retryAnalysis
      },
      performanceAnalysis: statistics.performanceAnalysis,
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
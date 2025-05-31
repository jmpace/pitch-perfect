// GET /api/video/metrics - Get comprehensive video processing metrics
import { NextRequest, NextResponse } from 'next/server';
import { videoStatusTracker } from '@/lib/video-status-tracker';
import { createErrorResponse, generateRequestId } from '@/lib/errors/handlers';
import { withApiExceptionHandling } from '@/lib/errors/exception-handlers';
import { ValidationError } from '@/lib/errors/types';

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

async function handleGetMetrics(request: NextRequest): Promise<NextResponse> {
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
    
    // Validate date range using standardized error handling
    if (isNaN(timeRange.start.getTime()) || isNaN(timeRange.end.getTime())) {
      throw new ValidationError(
        'Invalid date format in start or end parameter',
        { startParam, endParam, field: 'dateRange' }
      );
    }
    
    if (timeRange.start >= timeRange.end) {
      throw new ValidationError(
        'Start date must be before end date',
        { 
          startParam, 
          endParam, 
          field: 'dateRange',
          validation: 'chronological_order' 
        }
      );
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
}

// Export the API handler wrapped with standardized exception handling
export const GET = withApiExceptionHandling(handleGetMetrics); 
// GET /api/health - System health check with enhanced error monitoring
import { NextResponse } from 'next/server';
import { enhancedErrorHandler } from '@/lib/enhanced-error-handling';
import { VideoProcessor } from '@/lib/video-processor';
import { generateRequestId } from '@/lib/errors/handlers';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  requestId: string;
  services: {
    videoProcessor: ServiceHealth;
    errorHandling: ServiceHealth;
    circuitBreakers: Record<string, CircuitBreakerHealth>;
  };
  metrics: {
    errorStats: Record<string, { count: number; rate: number }>;
    processingStats: {
      totalJobs: number;
      activeJobs: number;
      completedJobs: number;
      failedJobs: number;
      successRate: number;
    };
  };
  uptime: number;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: string;
}

interface CircuitBreakerHealth {
  state: string;
  failureCount: number;
  successRate: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

const startTime = Date.now();

export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();
  
  try {
    // Check video processor health
    const videoProcessorHealth = await checkVideoProcessorHealth();
    
    // Check error handling system health
    const errorHandlingHealth = checkErrorHandlingHealth();
    
    // Get system metrics
    const systemHealth = enhancedErrorHandler.getSystemHealth();
    const processingStats = VideoProcessor.getStats();
    
    // Determine overall system status
    const services = {
      videoProcessor: videoProcessorHealth,
      errorHandling: errorHandlingHealth,
      circuitBreakers: transformCircuitBreakerMetrics(systemHealth.circuitBreakers)
    };
    
    const overallStatus = determineOverallStatus(services);
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp,
      requestId,
      services,
      metrics: {
        errorStats: systemHealth.errorStats,
        processingStats: {
          totalJobs: processingStats.totalJobs,
          activeJobs: processingStats.currentJobs,
          completedJobs: processingStats.byStatus.completed,
          failedJobs: processingStats.byStatus.failed,
          successRate: processingStats.totalJobs > 0 ? 
            ((processingStats.byStatus.completed / processingStats.totalJobs) * 100) : 100
        }
      },
      uptime: Date.now() - startTime
    };
    
    // Set appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(response, { status: httpStatus });
    
  } catch (_error) {
    // Health check itself failed
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp,
      requestId,
      services: {
        videoProcessor: {
          status: 'unhealthy',
          message: 'Health check failed',
          lastCheck: timestamp
        },
        errorHandling: {
          status: 'unhealthy',
          message: 'Health check failed',
          lastCheck: timestamp
        },
        circuitBreakers: {}
      },
      metrics: {
        errorStats: {},
        processingStats: {
          totalJobs: 0,
          activeJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          successRate: 0
        }
      },
      uptime: Date.now() - startTime
    };
    
    return NextResponse.json(response, { status: 503 });
  }
}

async function checkVideoProcessorHealth(): Promise<ServiceHealth> {
  try {
    const stats = VideoProcessor.getStats();
    
    // Check if there are too many failed jobs
    const failureRate = stats.totalJobs > 0 ? 
      (stats.byStatus.failed / stats.totalJobs) * 100 : 0;
    
    if (failureRate > 50) {
      return {
        status: 'unhealthy',
        message: `High failure rate: ${failureRate.toFixed(1)}%`,
        lastCheck: new Date().toISOString()
      };
    } else if (failureRate > 20) {
      return {
        status: 'degraded',
        message: `Elevated failure rate: ${failureRate.toFixed(1)}%`,
        lastCheck: new Date().toISOString()
      };
    }
    
    // Check if we're at capacity
    if (stats.currentJobs >= stats.maxConcurrent) {
      return {
        status: 'degraded',
        message: 'At maximum capacity',
        lastCheck: new Date().toISOString()
      };
    }
    
    return {
      status: 'healthy',
      lastCheck: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString()
    };
  }
}

function checkErrorHandlingHealth(): ServiceHealth {
  try {
    const systemHealth = enhancedErrorHandler.getSystemHealth();
    
    // Check error rates
    const errorStats = systemHealth.errorStats;
    const highErrorRates = Object.entries(errorStats).filter(
      ([, stats]) => stats.rate > 5 // More than 5 errors per minute
    );
    
    if (highErrorRates.length > 0) {
      return {
        status: 'degraded',
        message: `High error rates detected: ${highErrorRates.map(([key]) => key).join(', ')}`,
        lastCheck: new Date().toISOString()
      };
    }
    
    // Check circuit breaker states
    const openCircuitBreakers = Object.entries(systemHealth.circuitBreakers).filter(
      ([, metrics]) => metrics.state === 'OPEN'
    );
    
    if (openCircuitBreakers.length > 0) {
      return {
        status: 'degraded',
        message: `Circuit breakers open: ${openCircuitBreakers.map(([name]) => name).join(', ')}`,
        lastCheck: new Date().toISOString()
      };
    }
    
    return {
      status: 'healthy',
      lastCheck: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString()
    };
  }
}

function transformCircuitBreakerMetrics(
  metrics: Record<string, ReturnType<import('@/lib/enhanced-error-handling').CircuitBreaker['getMetrics']>>
): Record<string, CircuitBreakerHealth> {
  const result: Record<string, CircuitBreakerHealth> = {};
  
  for (const [name, metric] of Object.entries(metrics)) {
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (metric.state === 'OPEN') {
      status = 'unhealthy';
    } else if (metric.state === 'HALF_OPEN' || metric.successRate < 90) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    
    result[name] = {
      state: metric.state,
      failureCount: metric.failureCount,
      successRate: metric.successRate,
      status
    };
  }
  
  return result;
}

function determineOverallStatus(services: HealthCheckResponse['services']): 'healthy' | 'degraded' | 'unhealthy' {
  const allStatuses = [
    services.videoProcessor.status,
    services.errorHandling.status,
    ...Object.values(services.circuitBreakers).map(cb => cb.status)
  ];
  
  if (allStatuses.some(status => status === 'unhealthy')) {
    return 'unhealthy';
  } else if (allStatuses.some(status => status === 'degraded')) {
    return 'degraded';
  } else {
    return 'healthy';
  }
} 
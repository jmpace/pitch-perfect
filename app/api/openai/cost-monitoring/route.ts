import { NextRequest } from 'next/server';
import { costTracker } from '@/lib/openai-cost-tracker';
import { OpenAIUsageStore } from '@/lib/openai-usage-store';
import { createSuccessResponse, createErrorResponse, generateRequestId, normalizeError } from '@/lib/errors/handlers';
import { checkAuthentication } from '@/lib/openai-auth';

interface CostAnalytics {
  overview: {
    timeRange: string;
    startDate: string;
    endDate: string;
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    successRate: number;
    averageCostPerRequest: number;
    averageTokensPerRequest: number;
  };
  costs: {
    total: number;
    breakdown: {
      byModel: Array<{ model: string; cost: number; percentage: number; }>;
      byEndpoint: Array<{ endpoint: string; cost: number; percentage: number; }>;
    };
    monthly: {
      totalCost: number;
      totalRequests: number;
      totalTokens: number;
      byModel: Record<string, { cost: number; tokens: number; requests: number; }>;
      byEndpoint: Record<string, { cost: number; tokens: number; requests: number; }>;
    };
    trends: {
      direction: 'up' | 'down' | 'stable';
      changePercentage: number;
      averageDailyCost: number;
      peakDay: { date: string; cost: number; };
      lowestDay: { date: string; cost: number; };
    };
  };
  usage: {
    recent: {
      last24Hours: { cost: number; requests: number; tokens: number; };
      last7Days: { cost: number; requests: number; tokens: number; };
    };
    aggregation: {
      totalRequests: number;
      totalTokens: number;
      totalCost: number;
      successRate: number;
      averageDuration: number;
      byModel: Record<string, { requests: number; tokens: number; cost: number; successRate: number; }>;
      byEndpoint: Record<string, { requests: number; tokens: number; cost: number; successRate: number; }>;
      byHour: Record<string, { requests: number; tokens: number; cost: number; }>;
    };
    distribution: {
      byModel: Array<{ model: string; requests: number; percentage: number; }>;
      byEndpoint: Array<{ endpoint: string; requests: number; percentage: number; }>;
    };
  };
  performance: {
    averageDuration: number;
    successRate: number;
    modelPerformance: Array<{
      model: string;
      requests: number;
      successRate: number;
      averageCost: number;
      averageTokens: number;
    }>;
    endpointPerformance: Array<{
      endpoint: string;
      requests: number;
      successRate: number;
      averageCost: number;
      averageTokens: number;
    }>;
  };
  alerts: {
    costThresholds: {
      daily: number;
      monthly: number;
      perRequest: number;
    };
    currentStatus: {
      dailyUsage: number;
      monthlyUsage: number;
      isOverDailyThreshold: boolean;
      isOverMonthlyThreshold: boolean;
      recommendationsActive: boolean;
    };
  };
  health: {
    dataQuality: {
      totalRecords: number;
      oldestRecord?: string;
      newestRecord?: string;
      trackingAccuracy: number;
    };
    costEfficiency: {
      averageCostPerToken: number;
      costPerSuccessfulRequest: number;
      tokenEfficiency: number;
    };
  };
  details?: {
    recentRecords: Array<{
      id: string;
      timestamp: string;
      endpoint: string;
      model: string;
      operation: string;
      totalCost: number;
      totalTokens: number;
      duration: number;
      success: boolean;
      errorType?: string;
    }>;
    totalRecordsInRange: number;
  };
}

/**
 * GET /api/openai/cost-monitoring
 * Get comprehensive OpenAI cost analytics and monitoring data
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Check OpenAI authentication
    const authStatus = await checkAuthentication();
    if (!authStatus.isAuthenticated) {
      const authError = normalizeError(new Error(authStatus.error || 'OpenAI authentication failed'), requestId);
      return createErrorResponse(authError);
    }

    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';
    const timeRange = searchParams.get('range') || '7d'; // 1h, 24h, 7d, 30d
    const groupBy = searchParams.get('groupBy') || 'day'; // hour, day, model, endpoint

    // Parse time range
    const timeRangeHours = parseTimeRange(timeRange);
    const startDate = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    const endDate = new Date();

    // Get usage statistics
    const usageStats = costTracker.getCostStatistics();
    
    // Get cost breakdown
    const costBreakdown = costTracker.getCostBreakdown(Math.ceil(timeRangeHours / 24));
    
    // Get usage aggregation for the specified time range
    const usageAggregation = costTracker.getUsageAggregation(startDate, endDate);
    
    // Get current month costs
    const monthlyStats = costTracker.getCurrentMonthCosts();

    // Calculate cost trends
    const costTrends = calculateCostTrends(costBreakdown.daily);

    const analytics: CostAnalytics = {
      overview: {
        timeRange,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalCost: usageStats.totalCost,
        totalRequests: usageStats.totalRequests,
        totalTokens: usageStats.totalTokens,
        successRate: usageStats.successRate,
        averageCostPerRequest: usageStats.averageCostPerRequest,
        averageTokensPerRequest: usageStats.averageTokensPerRequest
      },
      
      costs: {
        total: costBreakdown.total,
        breakdown: {
          byModel: costBreakdown.byModel,
          byEndpoint: costBreakdown.byEndpoint
        },
        monthly: {
          totalCost: monthlyStats.totalCost,
          totalRequests: monthlyStats.totalRequests,
          totalTokens: monthlyStats.totalTokens,
          byModel: monthlyStats.byModel,
          byEndpoint: monthlyStats.byEndpoint
        },
        trends: costTrends
      },

      usage: {
        recent: {
          last24Hours: usageStats.last24Hours,
          last7Days: usageStats.last7Days
        },
        aggregation: usageAggregation,
        distribution: {
          byModel: Object.entries(usageStats.byModel).map(([model, count]) => ({
            model,
            requests: count,
            percentage: calculatePercentage(count, usageStats.totalRequests)
          })),
          byEndpoint: Object.entries(usageStats.byEndpoint).map(([endpoint, count]) => ({
            endpoint,
            requests: count,
            percentage: calculatePercentage(count, usageStats.totalRequests)
          }))
        }
      },

      performance: {
        averageDuration: usageAggregation.averageDuration,
        successRate: usageAggregation.successRate,
        modelPerformance: Object.entries(usageAggregation.byModel).map(([model, stats]) => ({
          model,
          requests: stats.requests,
          successRate: stats.successRate,
          averageCost: stats.requests > 0 ? stats.cost / stats.requests : 0,
          averageTokens: stats.requests > 0 ? stats.tokens / stats.requests : 0
        })),
        endpointPerformance: Object.entries(usageAggregation.byEndpoint).map(([endpoint, stats]) => ({
          endpoint,
          requests: stats.requests,
          successRate: stats.successRate,
          averageCost: stats.requests > 0 ? stats.cost / stats.requests : 0,
          averageTokens: stats.requests > 0 ? stats.tokens / stats.requests : 0
        }))
      },

      alerts: {
        costThresholds: {
          daily: 5.00, // $5 daily threshold
          monthly: 100.00, // $100 monthly threshold
          perRequest: 0.50 // $0.50 per request threshold
        },
        currentStatus: {
          dailyUsage: usageStats.last24Hours.cost,
          monthlyUsage: monthlyStats.totalCost,
          isOverDailyThreshold: usageStats.last24Hours.cost > 5.00,
          isOverMonthlyThreshold: monthlyStats.totalCost > 100.00,
          recommendationsActive: usageStats.last24Hours.cost > 2.50 || monthlyStats.totalCost > 50.00
        }
      },

      health: {
        dataQuality: {
          totalRecords: usageStats.totalRecords,
          oldestRecord: usageStats.oldestRecord?.toISOString(),
          newestRecord: usageStats.newestRecord?.toISOString(),
          trackingAccuracy: calculatePercentage(usageStats.totalRequests, usageStats.totalRecords)
        },
        costEfficiency: {
          averageCostPerToken: usageStats.totalTokens > 0 ? usageStats.totalCost / usageStats.totalTokens : 0,
          costPerSuccessfulRequest: usageAggregation.totalRequests > 0 && usageAggregation.successRate > 0 
            ? usageAggregation.totalCost / (usageAggregation.totalRequests * usageAggregation.successRate) 
            : 0,
          tokenEfficiency: usageAggregation.totalRequests > 0 
            ? usageAggregation.totalTokens / usageAggregation.totalRequests 
            : 0
        }
      }
    };

    // Add detailed records if requested
    if (includeDetails) {
      const recentRecords = OpenAIUsageStore.getUsageRecords({
        startDate,
        endDate,
        limit: 100
      });

      analytics.details = {
        recentRecords: recentRecords.map(record => ({
          id: record.id,
          timestamp: record.timestamp.toISOString(),
          endpoint: record.endpoint,
          model: record.model,
          operation: record.operation,
          totalCost: record.totalCost,
          totalTokens: record.totalTokens,
          duration: record.duration,
          success: record.success,
          errorType: record.errorType
        })),
        totalRecordsInRange: recentRecords.length
      };
    }

    return createSuccessResponse(analytics, requestId);

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
}

/**
 * POST /api/openai/cost-monitoring
 * Record a new cost tracking event or update thresholds
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Check OpenAI authentication
    const authStatus = await checkAuthentication();
    if (!authStatus.isAuthenticated) {
      const authError = normalizeError(new Error(authStatus.error || 'OpenAI authentication failed'), requestId);
      return createErrorResponse(authError);
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'updateThresholds':
        const thresholds = costTracker.setupCostAlerts(data);
        return createSuccessResponse({
          message: 'Cost alert thresholds updated',
          thresholds
        }, requestId);

      case 'recordUsage':
        // Manual usage recording (for testing or external integrations)
        const usageRecord = await costTracker.trackApiCall(
          data.endpoint,
          data.model,
          data.operation,
          {
            inputTokens: data.inputTokens,
            outputTokens: data.outputTokens,
            totalTokens: data.inputTokens + data.outputTokens
          },
          data.duration,
          data.success,
          requestId,
          data.errorType,
          data.options
        );
        
        return createSuccessResponse({
          message: 'Usage recorded successfully',
          usageRecord: {
            id: usageRecord.id,
            totalCost: usageRecord.totalCost,
            timestamp: usageRecord.timestamp
          }
        }, requestId);

      case 'exportData':
        const startDate = data.startDate ? new Date(data.startDate) : undefined;
        const endDate = data.endDate ? new Date(data.endDate) : undefined;
        const exportData = costTracker.exportCostData(startDate, endDate);
        
        return createSuccessResponse({
          message: 'Cost data exported',
          totalRecords: exportData.length,
          data: exportData
        }, requestId);

      case 'clearData':
        // Clear all usage data (for testing)
        const clearedCount = OpenAIUsageStore.clearAll();
        
        return createSuccessResponse({
          message: 'Usage data cleared',
          recordsCleared: clearedCount
        }, requestId);

      default:
        return createErrorResponse(
          normalizeError(new Error(`Unknown action: ${action}`), requestId)
        );
    }

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
}

/**
 * Parse time range string to hours
 */
function parseTimeRange(range: string): number {
  const timeRanges: Record<string, number> = {
    '1h': 1,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30
  };

  return timeRanges[range] || 24 * 7; // Default to 7 days
}

/**
 * Calculate percentage with safety check
 */
function calculatePercentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100 * 100) / 100 : 0;
}

/**
 * Calculate cost trends from daily data
 */
function calculateCostTrends(dailyData: Array<{ date: string; cost: number; requests: number; }>): {
  direction: 'up' | 'down' | 'stable';
  changePercentage: number;
  averageDailyCost: number;
  peakDay: { date: string; cost: number; };
  lowestDay: { date: string; cost: number; };
} {
  if (dailyData.length === 0) {
    return {
      direction: 'stable',
      changePercentage: 0,
      averageDailyCost: 0,
      peakDay: { date: '', cost: 0 },
      lowestDay: { date: '', cost: 0 }
    };
  }

  const totalCost = dailyData.reduce((sum, day) => sum + day.cost, 0);
  const averageDailyCost = totalCost / dailyData.length;

  // Find peak and lowest days
  const peakDay = dailyData.reduce((max, day) => day.cost > max.cost ? day : max);
  const lowestDay = dailyData.reduce((min, day) => day.cost < min.cost ? day : min);

  // Calculate trend (compare first half vs second half)
  if (dailyData.length < 2) {
    return {
      direction: 'stable',
      changePercentage: 0,
      averageDailyCost,
      peakDay,
      lowestDay
    };
  }

  const midPoint = Math.floor(dailyData.length / 2);
  const firstHalf = dailyData.slice(0, midPoint);
  const secondHalf = dailyData.slice(midPoint);

  const firstHalfAvg = firstHalf.reduce((sum, day) => sum + day.cost, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, day) => sum + day.cost, 0) / secondHalf.length;

  const changePercentage = firstHalfAvg > 0 
    ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 
    : 0;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(changePercentage) > 5) { // Consider changes > 5% significant
    direction = changePercentage > 0 ? 'up' : 'down';
  }

  return {
    direction,
    changePercentage: Math.round(changePercentage * 100) / 100,
    averageDailyCost: Math.round(averageDailyCost * 100) / 100,
    peakDay,
    lowestDay
  };
} 
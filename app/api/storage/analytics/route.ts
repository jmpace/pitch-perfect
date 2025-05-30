// API endpoint for storage and delivery analytics
import { NextRequest, NextResponse } from 'next/server';
import { StorageDeliveryManager } from '@/lib/storage-delivery-manager';
import { BlobManager } from '@/lib/blob-manager';
import { FileTracker } from '@/lib/file-tracking';
import { 
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
  normalizeError
} from '@/lib/errors/handlers';
import { 
  isStorageError
} from '@/lib/errors/types';

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to calculate percentage
function calculatePercentage(value: number, total: number): number {
  return total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;
}

// GET /api/storage/analytics - Get comprehensive storage and delivery analytics
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';
    const timeRange = searchParams.get('range') || '24h'; // 1h, 24h, 7d, 30d

    // Get storage analytics from StorageDeliveryManager
    const storageAnalytics = StorageDeliveryManager.getAnalytics();

    // Get blob storage statistics
    let blobStats;
    try {
      blobStats = await BlobManager.getStorageStats();
    } catch (error) {
      console.warn('Failed to get blob storage stats:', error);
      blobStats = {
        totalBlobs: 0,
        totalSize: 0,
        trackedFiles: 0,
        orphanedBlobs: 0
      };
    }

    // Get file tracking statistics
    const trackingStats = FileTracker.getStats();

    // Calculate derived metrics
    const analytics = {
      overview: {
        totalFiles: blobStats.totalBlobs,
        totalSize: blobStats.totalSize,
        formattedSize: formatBytes(blobStats.totalSize),
        trackedFiles: blobStats.trackedFiles,
        orphanedBlobs: blobStats.orphanedBlobs,
        trackingAccuracy: calculatePercentage(blobStats.trackedFiles, blobStats.totalBlobs)
      },
      storage: {
        byContentType: storageAnalytics.usage.byContentType,
        distribution: Object.entries(storageAnalytics.usage.byContentType).map(([type, data]) => ({
          type,
          count: data.count,
          size: data.size,
          formattedSize: formatBytes(data.size),
          percentage: calculatePercentage(data.size, storageAnalytics.usage.totalSize)
        }))
      },
      performance: {
        upload: {
          averageTime: storageAnalytics.performance.averageUploadTime,
          formattedTime: `${storageAnalytics.performance.averageUploadTime}ms`
        },
        download: {
          averageTime: storageAnalytics.performance.averageDownloadTime,
          formattedTime: `${storageAnalytics.performance.averageDownloadTime}ms`
        },
        caching: {
          hitRate: storageAnalytics.performance.cacheHitRate,
          cdnHitRate: storageAnalytics.performance.cdnHitRate,
          formattedHitRate: `${(storageAnalytics.performance.cacheHitRate * 100).toFixed(1)}%`,
          formattedCdnHitRate: `${(storageAnalytics.performance.cdnHitRate * 100).toFixed(1)}%`
        }
      },
      costs: {
        storage: storageAnalytics.costs.storageUsage,
        bandwidth: storageAnalytics.costs.bandwidth,
        operations: storageAnalytics.costs.operations,
        total: storageAnalytics.costs.total,
        breakdown: [
          {
            category: 'Storage',
            amount: storageAnalytics.costs.storageUsage,
            percentage: calculatePercentage(storageAnalytics.costs.storageUsage, storageAnalytics.costs.total)
          },
          {
            category: 'Bandwidth',
            amount: storageAnalytics.costs.bandwidth,
            percentage: calculatePercentage(storageAnalytics.costs.bandwidth, storageAnalytics.costs.total)
          },
          {
            category: 'Operations',
            amount: storageAnalytics.costs.operations,
            percentage: calculatePercentage(storageAnalytics.costs.operations, storageAnalytics.costs.total)
          }
        ]
      },
      tracking: {
        totalFiles: trackingStats.totalFiles,
        totalSize: trackingStats.totalSize,
        formattedSize: formatBytes(trackingStats.totalSize),
        byStatus: trackingStats.byStatus,
        oldestFile: trackingStats.oldestFile?.toISOString(),
        newestFile: trackingStats.newestFile?.toISOString(),
        statusDistribution: Object.entries(trackingStats.byStatus).map(([status, count]) => ({
          status,
          count,
          percentage: calculatePercentage(count, trackingStats.totalFiles)
        }))
      },
      health: {
        storageQuotaUsed: calculatePercentage(blobStats.totalSize, 1024 * 1024 * 1024 * 100), // Assume 100GB quota
        orphanedBlobsPercentage: calculatePercentage(blobStats.orphanedBlobs, blobStats.totalBlobs),
        trackingAccuracy: calculatePercentage(blobStats.trackedFiles, blobStats.totalBlobs),
        issues: [] as Array<{ type: string; message: string; recommendation: string }>
      }
    };

    // Add health issues
    if (analytics.health.orphanedBlobsPercentage > 10) {
      analytics.health.issues.push({
        type: 'warning',
        message: `High percentage of orphaned blobs: ${analytics.health.orphanedBlobsPercentage}%`,
        recommendation: 'Run cleanup to remove orphaned blobs'
      });
    }

    if (analytics.health.trackingAccuracy < 90) {
      analytics.health.issues.push({
        type: 'warning',
        message: `Low tracking accuracy: ${analytics.health.trackingAccuracy}%`,
        recommendation: 'Review file tracking system integrity'
      });
    }

    if (analytics.health.storageQuotaUsed > 80) {
      analytics.health.issues.push({
        type: 'critical',
        message: `High storage usage: ${analytics.health.storageQuotaUsed}%`,
        recommendation: 'Consider implementing storage tiering or cleanup policies'
      });
    }

    // Add detailed breakdowns if requested
    const responseData: any = {
      timeRange,
      analytics,
      generated: new Date().toISOString(),
      requestId
    };

    if (includeDetails) {
      responseData.details = {
        rawBlobStats: blobStats,
        rawTrackingStats: trackingStats,
        rawStorageAnalytics: storageAnalytics
      };
    }

    return createSuccessResponse(responseData, requestId);

  } catch (error) {
    const analyticsError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(analyticsError);
  }
}

// POST /api/storage/analytics - Generate custom analytics report
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();
    const { 
      metrics = [], 
      timeRange = '24h', 
      contentTypes = [], 
      includeForecasting = false 
    } = body;

    // Generate custom analytics based on requested metrics
    const customAnalytics = {
      query: {
        metrics,
        timeRange,
        contentTypes,
        includeForecasting
      },
      results: {
        // Placeholder for custom analytics results
        message: 'Custom analytics generation not yet implemented',
        availableMetrics: [
          'storage_usage',
          'delivery_performance',
          'cost_analysis',
          'usage_trends',
          'error_rates'
        ]
      },
      generated: new Date().toISOString(),
      requestId
    };

    return createSuccessResponse(customAnalytics, requestId);

  } catch (error) {
    const analyticsError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(analyticsError);
  }
} 
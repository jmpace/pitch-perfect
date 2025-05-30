// API endpoint for blob storage cleanup operations
import { NextRequest, NextResponse } from 'next/server';
import { CleanupService, CleanupOptions } from '@/lib/cleanup-service';
import { BlobManager } from '@/lib/blob-manager';
import { FileTracker } from '@/lib/file-tracking';

export async function POST(request: NextRequest) {
  console.log('Cleanup API endpoint called');
  
  try {
    const body = await request.json().catch(() => ({}));
    
    const {
      dryRun = false,
      force = false,
      includeOrphaned = true,
      maxFiles = 1000,
      type = 'full'
    } = body;

    // Validate request
    if (typeof dryRun !== 'boolean' || typeof force !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid parameters: dryRun and force must be boolean' },
        { status: 400 }
      );
    }

    console.log(`Cleanup request: type=${type}, dryRun=${dryRun}, force=${force}, includeOrphaned=${includeOrphaned}`);

    let report;

    // Determine cleanup type
    switch (type) {
      case 'expired':
        report = await CleanupService.cleanupExpiredFiles(dryRun);
        break;
        
      case 'failed':
        report = await CleanupService.cleanupFailedFiles(dryRun);
        break;
        
      case 'emergency':
        if (!force) {
          return NextResponse.json(
            { error: 'Emergency cleanup requires force=true parameter' },
            { status: 400 }
          );
        }
        report = await CleanupService.emergencyCleanup(dryRun);
        break;
        
      case 'full':
      default:
        const options: CleanupOptions = {
          dryRun,
          force,
          includeOrphaned,
          maxFiles
        };
        report = await CleanupService.performCleanup(options);
        break;
    }

    // Format response
    const response = {
      success: true,
      cleanup: {
        type,
        dryRun: report.dryRun,
        duration: `${report.duration}ms`,
        summary: {
          filesScanned: report.totalFilesScanned,
          filesDeleted: report.totalFilesDeleted,
          sizeFreed: formatBytes(report.totalSizeFreed),
          breakdown: {
            expired: report.expiredFiles,
            orphaned: report.orphanedFiles,
            failed: report.failedFiles
          }
        },
        errors: report.errors,
        startTime: report.startTime.toISOString(),
        endTime: report.endTime.toISOString()
      }
    };

    const statusCode = report.errors.length > 0 ? 207 : 200; // 207 Multi-Status for partial success
    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('Cleanup API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cleanup operation failed', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  console.log('Cleanup preview API endpoint called');
  
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'full';

    // Get cleanup preview
    const preview = await CleanupService.getCleanupPreview();
    
    // Get storage statistics
    const storageStats = await BlobManager.getStorageStats();
    
    // Get tracking statistics
    const trackingStats = FileTracker.getStats();

    const response = {
      success: true,
      preview: {
        type,
        totalTrackedFiles: preview.totalTrackedFiles,
        filesToCleanup: preview.filesToCleanup.length,
        orphanedBlobs: preview.orphanedBlobs.length,
        estimatedSizeFreed: formatBytes(preview.estimatedSizeFreed),
        breakdown: preview.breakdown
      },
      storage: {
        totalBlobs: storageStats.totalBlobs,
        totalSize: formatBytes(storageStats.totalSize),
        trackedFiles: storageStats.trackedFiles,
        orphanedBlobs: storageStats.orphanedBlobs
      },
      tracking: {
        totalFiles: trackingStats.totalFiles,
        totalSize: formatBytes(trackingStats.totalSize),
        byStatus: trackingStats.byStatus,
        oldestFile: trackingStats.oldestFile?.toISOString(),
        newestFile: trackingStats.newestFile?.toISOString()
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Cleanup preview API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate cleanup preview', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
} 
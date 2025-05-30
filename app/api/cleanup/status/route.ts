// API endpoint for monitoring cleanup system status
import { NextRequest, NextResponse } from 'next/server';
import { CleanupScheduler } from '@/lib/cleanup-scheduler';

export async function GET(_request: NextRequest) {
  try {
    console.log('Cleanup status API endpoint called');

    // Get comprehensive cleanup status
    const status = await CleanupScheduler.getCleanupStatus();
    const config = CleanupScheduler.getConfig();

    const response = {
      success: true,
      status: {
        scheduler: {
          enabled: status.enabled,
          isRunning: status.isRunning,
          lastCleanup: status.lastCleanup,
          nextCleanup: status.nextCleanup,
          configuration: config
        },
        files: {
          totalTracked: status.stats.totalFiles,
          oldestFile: status.stats.oldestFile,
          readyForCleanup: status.stats.filesReadyForCleanup
        },
        recommendations: status.recommendations,
        health: {
          status: status.stats.filesReadyForCleanup > 100 ? 'warning' : 'healthy',
          message: status.stats.filesReadyForCleanup > 100 
            ? 'Many files ready for cleanup' 
            : 'Cleanup system operating normally'
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Cleanup status API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get cleanup status', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, ...params } = body;

    console.log(`Cleanup control action: ${action}`, params);

    let result;

    switch (action) {
      case 'configure':
        CleanupScheduler.configure(params);
        result = { message: 'Scheduler configured', config: CleanupScheduler.getConfig() };
        break;

      case 'force-cleanup':
        const { dryRun = true } = params;
        await CleanupScheduler.forceCleanup(dryRun);
        result = { message: `Force cleanup ${dryRun ? '(dry run)' : ''} triggered` };
        break;

      case 'emergency-stop':
        CleanupScheduler.emergencyStop();
        result = { message: 'Emergency stop activated - auto cleanup disabled' };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cleanup control API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cleanup control operation failed', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 
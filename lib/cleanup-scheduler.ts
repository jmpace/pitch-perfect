// Cleanup scheduler for automatic triggering during workflow points
import { CleanupService } from './cleanup-service';
import { FileTracker } from './file-tracking';

export interface SchedulerConfig {
  enableAutoCleanup: boolean;
  cleanupInterval: number; // in milliseconds
  maxFilesPerCleanup: number;
  enableOrphanedCleanup: boolean;
  dryRunMode: boolean;
}

export class CleanupScheduler {
  private static config: SchedulerConfig = {
    enableAutoCleanup: true,
    cleanupInterval: 60 * 60 * 1000, // 1 hour
    maxFilesPerCleanup: 100,
    enableOrphanedCleanup: true,
    dryRunMode: false
  };

  private static lastCleanupTime = 0;
  private static isCleanupRunning = false;

  /**
   * Configure the cleanup scheduler
   */
  static configure(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Cleanup scheduler configured:', this.config);
  }

  /**
   * Check if cleanup should be triggered and run it if needed
   */
  static async maybeRunCleanup(force = false): Promise<boolean> {
    if (!this.config.enableAutoCleanup && !force) {
      return false;
    }

    if (this.isCleanupRunning) {
      console.log('Cleanup already running, skipping...');
      return false;
    }

    const now = Date.now();
    const timeSinceLastCleanup = now - this.lastCleanupTime;

    if (!force && timeSinceLastCleanup < this.config.cleanupInterval) {
      // Not time for cleanup yet
      return false;
    }

    // Check if we have files that might need cleanup
    const stats = FileTracker.getStats();
    if (stats.totalFiles === 0) {
      console.log('No files to cleanup');
      return false;
    }

    try {
      this.isCleanupRunning = true;
      this.lastCleanupTime = now;

      console.log('Auto-triggering cleanup...');
      
      const report = await CleanupService.performCleanup({
        dryRun: this.config.dryRunMode,
        includeOrphaned: this.config.enableOrphanedCleanup,
        maxFiles: this.config.maxFilesPerCleanup
      });

      console.log(`Auto-cleanup completed: ${report.totalFilesDeleted} files deleted, ${report.errors.length} errors`);
      
      return true;

    } catch (error) {
      console.error('Auto-cleanup failed:', error);
      return false;
    } finally {
      this.isCleanupRunning = false;
    }
  }

  /**
   * Trigger cleanup during file upload workflow
   */
  static async onFileUploaded(): Promise<void> {
    // Light cleanup check - only run if we have many files
    const stats = FileTracker.getStats();
    
    if (stats.totalFiles > 50) {
      console.log(`File count (${stats.totalFiles}) exceeds threshold, checking for cleanup...`);
      await this.maybeRunCleanup();
    }
  }

  /**
   * Trigger cleanup when processing starts
   */
  static async onProcessingStart(blobId: string): Promise<void> {
    // Update file status
    FileTracker.updateFileStatus(blobId, 'processing');
    
    // Maybe run cleanup
    await this.maybeRunCleanup();
  }

  /**
   * Trigger cleanup when processing completes
   */
  static async onProcessingComplete(blobId: string, success: boolean): Promise<void> {
    // Update file status
    const status = success ? 'completed' : 'failed';
    FileTracker.updateFileStatus(blobId, status);
    
    // Run cleanup for failed files immediately
    if (!success) {
      console.log('Processing failed, triggering cleanup of failed files...');
      await CleanupService.cleanupFailedFiles(this.config.dryRunMode);
    }
  }

  /**
   * Force an immediate cleanup (for manual triggering)
   */
  static async forceCleanup(dryRun = false): Promise<void> {
    const originalDryRun = this.config.dryRunMode;
    this.config.dryRunMode = dryRun;
    
    try {
      await this.maybeRunCleanup(true);
    } finally {
      this.config.dryRunMode = originalDryRun;
    }
  }

  /**
   * Get cleanup statistics and recommendations
   */
  static async getCleanupStatus(): Promise<{
    enabled: boolean;
    lastCleanup: Date | null;
    nextCleanup: Date | null;
    isRunning: boolean;
    stats: {
      totalFiles: number;
      oldestFile: Date | null;
      filesReadyForCleanup: number;
    };
    recommendations: string[];
  }> {
    const stats = FileTracker.getStats();
    const preview = await CleanupService.getCleanupPreview();
    
    const recommendations: string[] = [];
    
    if (preview.filesToCleanup.length > 10) {
      recommendations.push(`${preview.filesToCleanup.length} files are ready for cleanup`);
    }
    
    if (preview.orphanedBlobs.length > 0) {
      recommendations.push(`${preview.orphanedBlobs.length} orphaned blobs found`);
    }
    
    if (stats.totalFiles > 100) {
      recommendations.push('Consider running cleanup - file count is high');
    }

    const lastCleanup = this.lastCleanupTime > 0 ? new Date(this.lastCleanupTime) : null;
    const nextCleanup = this.config.enableAutoCleanup 
      ? new Date(this.lastCleanupTime + this.config.cleanupInterval)
      : null;

    return {
      enabled: this.config.enableAutoCleanup,
      lastCleanup,
      nextCleanup,
      isRunning: this.isCleanupRunning,
      stats: {
        totalFiles: stats.totalFiles,
        oldestFile: stats.oldestFile || null,
        filesReadyForCleanup: preview.filesToCleanup.length
      },
      recommendations
    };
  }

  /**
   * Emergency stop - disable all automatic cleanup
   */
  static emergencyStop(): void {
    this.config.enableAutoCleanup = false;
    this.isCleanupRunning = false;
    console.warn('🚨 Cleanup scheduler emergency stop activated');
  }

  /**
   * Get current configuration
   */
  static getConfig(): SchedulerConfig {
    return { ...this.config };
  }
} 
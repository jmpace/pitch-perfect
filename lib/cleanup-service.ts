// Core cleanup service implementing business logic for file cleanup
import { BlobManager, BatchOperationResult } from './blob-manager';
import { FileTracker, BlobFileMetadata, CleanupRule, DEFAULT_CLEANUP_RULES } from './file-tracking';

export interface CleanupOptions {
  rules?: CleanupRule[];
  dryRun?: boolean;
  force?: boolean;
  includeOrphaned?: boolean;
  maxFiles?: number;
}

export interface CleanupReport {
  startTime: Date;
  endTime: Date;
  duration: number;
  totalFilesScanned: number;
  expiredFiles: number;
  orphanedFiles: number;
  failedFiles: number;
  totalFilesDeleted: number;
  totalSizeFreed: number;
  errors: string[];
  dryRun: boolean;
  deletionResults?: BatchOperationResult;
  orphanedResults?: BatchOperationResult;
}

export class CleanupService {
  
  /**
   * Main cleanup operation - identifies and removes expired/orphaned files
   */
  static async performCleanup(options: CleanupOptions = {}): Promise<CleanupReport> {
    const startTime = new Date();
    const {
      rules = DEFAULT_CLEANUP_RULES,
      dryRun = false,
      force = false,
      includeOrphaned = true,
      maxFiles = 1000
    } = options;

    console.log(`Starting cleanup operation (${dryRun ? 'DRY RUN' : 'LIVE'})`);

    const report: CleanupReport = {
      startTime,
      endTime: new Date(),
      duration: 0,
      totalFilesScanned: 0,
      expiredFiles: 0,
      orphanedFiles: 0,
      failedFiles: 0,
      totalFilesDeleted: 0,
      totalSizeFreed: 0,
      errors: [],
      dryRun
    };

    try {
      // Step 1: Scan tracked files for cleanup candidates
      const trackedFiles = FileTracker.getFiles();
      report.totalFilesScanned = trackedFiles.length;

      console.log(`Scanning ${trackedFiles.length} tracked files against ${rules.length} cleanup rules`);

      // Step 2: Identify files for cleanup using rules
      const filesToCleanup = FileTracker.getFilesForCleanup(rules);
      
      // Categorize cleanup reasons
      filesToCleanup.forEach(file => {
        const age = Date.now() - file.uploadTimestamp.getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (age > twentyFourHours) {
          report.expiredFiles++;
        } else if (file.status === 'failed') {
          report.failedFiles++;
        }
      });

      // Limit the number of files to process
      const filesToProcess = filesToCleanup.slice(0, maxFiles);
      
      if (filesToProcess.length > 0) {
        console.log(`Found ${filesToProcess.length} files for cleanup:`);
        console.log(`- Expired (>24h): ${report.expiredFiles}`);
        console.log(`- Failed: ${report.failedFiles}`);

        if (!dryRun) {
          // Perform actual deletion
          console.log(`Deleting ${filesToProcess.length} tracked files...`);
          report.deletionResults = await BlobManager.deleteTrackedFiles(filesToProcess);
          report.totalFilesDeleted += report.deletionResults.successful;
          
          // Calculate size freed
          filesToProcess.forEach(file => {
            if (report.deletionResults?.results.find(r => r.blobUrl === file.blobUrl)?.success) {
              report.totalSizeFreed += file.fileSize;
            }
          });

          // Collect any errors
          if (report.deletionResults.errors.length > 0) {
            report.errors.push(...report.deletionResults.errors);
          }
        } else {
          console.log('DRY RUN: Would delete files:', filesToProcess.map(f => ({ 
            url: f.blobUrl, 
            age: this.formatAge(Date.now() - f.uploadTimestamp.getTime()),
            status: f.status,
            size: this.formatBytes(f.fileSize)
          })));
        }
      }

      // Step 3: Handle orphaned blobs (exist in storage but not tracked)
      if (includeOrphaned) {
        console.log('Scanning for orphaned blobs...');
        try {
          const orphanedBlobs = await BlobManager.findOrphanedBlobs();
          report.orphanedFiles = orphanedBlobs.length;

          if (orphanedBlobs.length > 0) {
            console.log(`Found ${orphanedBlobs.length} orphaned blobs`);

            if (!dryRun) {
              console.log('Cleaning up orphaned blobs...');
              report.orphanedResults = await BlobManager.cleanupOrphanedBlobs();
              report.totalFilesDeleted += report.orphanedResults.successful;

              if (report.orphanedResults.errors.length > 0) {
                report.errors.push(...report.orphanedResults.errors);
              }
            } else {
              console.log('DRY RUN: Would delete orphaned blobs:', orphanedBlobs);
            }
          }
        } catch (error) {
          const errorMsg = `Error handling orphaned blobs: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          report.errors.push(errorMsg);
        }
      }

      // Step 4: Verify cleanup was successful
      if (!dryRun && !force) {
        await this.verifyCleanupIntegrity(report);
      }

    } catch (error) {
      const errorMsg = `Cleanup operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      report.errors.push(errorMsg);
    }

    report.endTime = new Date();
    report.duration = report.endTime.getTime() - report.startTime.getTime();

    console.log(`Cleanup completed in ${report.duration}ms`);
    console.log(`Total files deleted: ${report.totalFilesDeleted}`);
    console.log(`Total size freed: ${this.formatBytes(report.totalSizeFreed)}`);
    console.log(`Errors: ${report.errors.length}`);

    return report;
  }

  /**
   * Cleanup only expired files (24+ hours old) as per PRD requirement
   */
  static async cleanupExpiredFiles(dryRun = false): Promise<CleanupReport> {
    const expiredRule: CleanupRule = {
      type: 'expiration',
      condition: (file) => {
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const ageInMs = Date.now() - file.uploadTimestamp.getTime();
        return ageInMs > twentyFourHours;
      },
      maxAge: 24 * 60 * 60 * 1000
    };

    return this.performCleanup({
      rules: [expiredRule],
      dryRun,
      includeOrphaned: false
    });
  }

  /**
   * Cleanup only failed uploads
   */
  static async cleanupFailedFiles(dryRun = false): Promise<CleanupReport> {
    const failedRule: CleanupRule = {
      type: 'failed',
      condition: (file) => file.status === 'failed'
    };

    return this.performCleanup({
      rules: [failedRule],
      dryRun,
      includeOrphaned: false
    });
  }

  /**
   * Emergency cleanup - removes ALL files regardless of age (use with caution)
   */
  static async emergencyCleanup(dryRun = true): Promise<CleanupReport> {
    console.warn('⚠️  EMERGENCY CLEANUP - This will delete ALL files!');
    
    const emergencyRule: CleanupRule = {
      type: 'expiration',
      condition: () => true // Delete everything
    };

    return this.performCleanup({
      rules: [emergencyRule],
      dryRun,
      force: true,
      includeOrphaned: true
    });
  }

  /**
   * Get cleanup preview without actually deleting anything
   */
  static async getCleanupPreview(rules: CleanupRule[] = DEFAULT_CLEANUP_RULES): Promise<{
    totalTrackedFiles: number;
    filesToCleanup: BlobFileMetadata[];
    orphanedBlobs: string[];
    estimatedSizeFreed: number;
    breakdown: {
      expired: number;
      failed: number;
      orphaned: number;
    };
  }> {
    const trackedFiles = FileTracker.getFiles();
    const filesToCleanup = FileTracker.getFilesForCleanup(rules);
    const orphanedBlobs = await BlobManager.findOrphanedBlobs();

    const estimatedSizeFreed = filesToCleanup.reduce((sum, file) => sum + file.fileSize, 0);

    const breakdown = {
      expired: 0,
      failed: 0,
      orphaned: orphanedBlobs.length
    };

    filesToCleanup.forEach(file => {
      const age = Date.now() - file.uploadTimestamp.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (age > twentyFourHours) {
        breakdown.expired++;
      } else if (file.status === 'failed') {
        breakdown.failed++;
      }
    });

    return {
      totalTrackedFiles: trackedFiles.length,
      filesToCleanup,
      orphanedBlobs,
      estimatedSizeFreed,
      breakdown
    };
  }

  /**
   * Verify that cleanup operations completed successfully
   */
  private static async verifyCleanupIntegrity(report: CleanupReport): Promise<void> {
    console.log('Verifying cleanup integrity...');

    try {
      // Check that deleted files are actually gone
      if (report.deletionResults) {
        const successfulDeletions = report.deletionResults.results.filter(r => r.success);
        
        for (const deletion of successfulDeletions) {
          try {
            const blobInfo = await BlobManager.getBlobInfo(deletion.blobUrl);
            if (blobInfo.exists) {
              const warning = `Warning: File still exists after deletion: ${deletion.blobUrl}`;
              console.warn(warning);
              report.errors.push(warning);
            }
          } catch (_error) {
            // Expected - file should not exist
          }
        }
      }

      // Verify tracking data is consistent
      const stats = FileTracker.getStats();
      console.log(`Post-cleanup tracking stats: ${stats.totalFiles} files, ${this.formatBytes(stats.totalSize)} total size`);

    } catch (error) {
      const warning = `Cleanup verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.warn(warning);
      report.errors.push(warning);
    }
  }

  /**
   * Format file age in human-readable format
   */
  private static formatAge(ageInMs: number): string {
    const hours = Math.floor(ageInMs / (1000 * 60 * 60));
    const minutes = Math.floor((ageInMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Format bytes in human-readable format
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
} 
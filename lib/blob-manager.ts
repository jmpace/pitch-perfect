// Centralized Vercel Blob management service for cleanup operations
import { list, del, head } from '@vercel/blob';
import { BlobFileMetadata, FileTracker } from './file-tracking';
import { 
  BlobAccessError,
  BlobNotFoundError,
  BlobOperationError,
  NetworkError,
  TimeoutError,
  isStorageError
} from './errors/types';
import { 
  handleBlobSDKError,
  withTimeout,
  generateRequestId,
  logError,
  normalizeError
} from './errors/handlers';

export interface BlobOperationResult {
  success: boolean;
  blobUrl: string;
  error?: string;
  deletedAt?: Date;
  requestId?: string;
}

export interface BatchOperationResult {
  totalRequested: number;
  successful: number;
  failed: number;
  results: BlobOperationResult[];
  errors: string[];
  requestId: string;
}

export interface BlobListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
}

export class BlobManager {
  private static readonly token = process.env.BLOB_READ_WRITE_TOKEN;

  /**
   * List all blobs in the storage with optional filtering
   */
  static async listBlobs(options: BlobListOptions = {}): Promise<{
    blobs: Array<{
      url: string;
      pathname: string;
      size: number;
      uploadedAt: Date;
    }>;
    cursor?: string;
    hasMore: boolean;
  }> {
    const requestId = generateRequestId();
    
    try {
      if (!this.token) {
        throw new BlobAccessError(
          'BLOB_READ_WRITE_TOKEN not configured',
          { operation: 'listBlobs' },
          requestId
        );
      }

      const result = await withTimeout(
        list({
          token: this.token,
          limit: options.limit || 1000,
          prefix: options.prefix,
          cursor: options.cursor
        }),
        15000, // 15 second timeout
        requestId
      );

      return {
        blobs: result.blobs.map(blob => ({
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt
        })),
        cursor: result.cursor,
        hasMore: result.hasMore
      };
    } catch (error) {
      const storageError = isStorageError(error) 
        ? error 
        : handleBlobSDKError(error, requestId);
      
      logError(storageError, { 
        operation: 'listBlobs', 
        options 
      });
      
      throw storageError;
    }
  }

  /**
   * Get blob metadata/info
   */
  static async getBlobInfo(blobUrl: string): Promise<{
    url: string;
    size: number;
    uploadedAt: Date;
    exists: boolean;
  }> {
    const requestId = generateRequestId();
    
    try {
      if (!this.token) {
        throw new BlobAccessError(
          'BLOB_READ_WRITE_TOKEN not configured',
          { operation: 'getBlobInfo', blobUrl },
          requestId
        );
      }

      const result = await withTimeout(
        head(blobUrl, { token: this.token }),
        10000, // 10 second timeout
        requestId
      );

      return {
        url: result.url,
        size: result.size,
        uploadedAt: result.uploadedAt,
        exists: true
      };
    } catch (error) {
      // If blob doesn't exist, head() throws an error - this is expected
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          return {
            url: blobUrl,
            size: 0,
            uploadedAt: new Date(0),
            exists: false
          };
        }
      }

      // For other errors, normalize and re-throw
      const storageError = isStorageError(error) 
        ? error 
        : handleBlobSDKError(error, requestId);
        
      logError(storageError, { 
        operation: 'getBlobInfo', 
        blobUrl 
      });
      
      throw storageError;
    }
  }

  /**
   * Delete a single blob
   */
  static async deleteBlob(blobUrl: string): Promise<BlobOperationResult> {
    const requestId = generateRequestId();
    const result: BlobOperationResult = {
      success: false,
      blobUrl,
      requestId
    };

    try {
      if (!this.token) {
        const error = new BlobAccessError(
          'BLOB_READ_WRITE_TOKEN not configured',
          { operation: 'deleteBlob', blobUrl },
          requestId
        );
        result.error = error.message;
        return result;
      }

      // Verify blob exists before attempting deletion
      let blobInfo;
      try {
        blobInfo = await this.getBlobInfo(blobUrl);
      } catch (error) {
        const storageError = isStorageError(error) 
          ? error 
          : normalizeError(error, requestId);
        result.error = `Failed to check blob existence: ${storageError.message}`;
        return result;
      }

      if (!blobInfo.exists) {
        result.error = 'Blob does not exist';
        return result;
      }

      // Perform deletion with timeout
      await withTimeout(
        del(blobUrl, { token: this.token }),
        15000, // 15 second timeout
        requestId
      );

      result.success = true;
      result.deletedAt = new Date();

      // Remove from file tracking system
      try {
        const blobId = this.extractBlobIdFromUrl(blobUrl);
        FileTracker.removeFile(blobId);
      } catch (error) {
        // Log but don't fail deletion if tracking removal fails
        const trackingError = normalizeError(error, requestId);
        logError(trackingError, { 
          operation: 'deleteBlob_tracking_cleanup', 
          blobUrl 
        });
      }

      return result;

    } catch (error) {
      const storageError = isStorageError(error) 
        ? error 
        : handleBlobSDKError(error, requestId);
        
      result.error = storageError.message;
      
      logError(storageError, { 
        operation: 'deleteBlob', 
        blobUrl 
      });
      
      return result;
    }
  }

  /**
   * Delete multiple blobs in batch with error handling
   */
  static async deleteBlobsBatch(blobUrls: string[]): Promise<BatchOperationResult> {
    const requestId = generateRequestId();
    const batchResult: BatchOperationResult = {
      totalRequested: blobUrls.length,
      successful: 0,
      failed: 0,
      results: [],
      errors: [],
      requestId
    };

    if (blobUrls.length === 0) {
      return batchResult;
    }

    for (const blobUrl of blobUrls) {
      try {
        const result = await this.deleteBlob(blobUrl);
        batchResult.results.push(result);

        if (result.success) {
          batchResult.successful++;
        } else {
          batchResult.failed++;
          if (result.error) {
            batchResult.errors.push(`${blobUrl}: ${result.error}`);
          }
        }

        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        batchResult.failed++;
        const storageError = isStorageError(error) 
          ? error 
          : normalizeError(error, requestId);
          
        batchResult.errors.push(`${blobUrl}: ${storageError.message}`);
        batchResult.results.push({
          success: false,
          blobUrl,
          error: storageError.message,
          requestId
        });

        logError(storageError, { 
          operation: 'deleteBlobsBatch_individual', 
          blobUrl 
        });
      }
    }

    return batchResult;
  }

  /**
   * Delete blobs based on file metadata from tracking system
   */
  static async deleteTrackedFiles(files: BlobFileMetadata[]): Promise<BatchOperationResult> {
    const blobUrls = files.map(file => file.blobUrl);
    
    // Update tracking status to 'expired' before deletion
    files.forEach(file => {
      FileTracker.updateFileStatus(file.blobId, 'expired');
    });

    return this.deleteBlobsBatch(blobUrls);
  }

  /**
   * Verify blob exists and matches tracking data
   */
  static async verifyBlobIntegrity(metadata: BlobFileMetadata): Promise<{
    isValid: boolean;
    issues: string[];
    blobExists: boolean;
    sizeMatches: boolean;
  }> {
    const issues: string[] = [];
    let blobExists = false;
    let sizeMatches = false;

    try {
      const blobInfo = await this.getBlobInfo(metadata.blobUrl);
      blobExists = blobInfo.exists;

      if (!blobExists) {
        issues.push('Blob file does not exist in storage');
      } else {
        sizeMatches = blobInfo.size === metadata.fileSize;
        if (!sizeMatches) {
          issues.push(`Size mismatch: expected ${metadata.fileSize}, actual ${blobInfo.size}`);
        }
      }
    } catch (error) {
      issues.push(`Error checking blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      blobExists,
      sizeMatches
    };
  }

  /**
   * Get all orphaned blobs (exist in storage but not in tracking)
   */
  static async findOrphanedBlobs(): Promise<string[]> {
    try {
      const { blobs } = await this.listBlobs();
      const trackedFiles = FileTracker.getFiles();
      const trackedUrls = new Set(trackedFiles.map(file => file.blobUrl));

      const orphanedBlobs = blobs
        .filter(blob => !trackedUrls.has(blob.url))
        .map(blob => blob.url);

      console.log(`Found ${orphanedBlobs.length} orphaned blobs out of ${blobs.length} total`);
      return orphanedBlobs;

    } catch (error) {
      console.error('Error finding orphaned blobs:', error);
      throw error;
    }
  }

  /**
   * Clean up orphaned blobs that exist in storage but not in tracking
   */
  static async cleanupOrphanedBlobs(): Promise<BatchOperationResult> {
    const orphanedBlobs = await this.findOrphanedBlobs();
    
    if (orphanedBlobs.length === 0) {
      return {
        totalRequested: 0,
        successful: 0,
        failed: 0,
        results: [],
        errors: [],
        requestId: ''
      };
    }

    console.log(`Cleaning up ${orphanedBlobs.length} orphaned blobs`);
    return this.deleteBlobsBatch(orphanedBlobs);
  }

  /**
   * Extract blob ID from Vercel Blob URL (matches FileTracker implementation)
   */
  private static extractBlobIdFromUrl(blobUrl: string): string {
    const urlParts = blobUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    const match = filename.match(/^(.+)-([a-zA-Z0-9]+)(\.[^.]+)?$/);
    return match ? match[2] : filename;
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{
    totalBlobs: number;
    totalSize: number;
    trackedFiles: number;
    orphanedBlobs: number;
  }> {
    try {
      const { blobs } = await this.listBlobs();
      const trackedFiles = FileTracker.getFiles();
      const orphanedBlobs = await this.findOrphanedBlobs();

      const totalSize = blobs.reduce((sum, blob) => sum + blob.size, 0);

      return {
        totalBlobs: blobs.length,
        totalSize,
        trackedFiles: trackedFiles.length,
        orphanedBlobs: orphanedBlobs.length
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }
} 
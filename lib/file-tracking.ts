// File metadata tracking system for Vercel Blob cleanup mechanisms
export interface BlobFileMetadata {
  blobUrl: string;
  blobId: string;
  uploadId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadTimestamp: Date;
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'expired';
  sessionId?: string;
  lastAccessed?: Date;
  processingStarted?: Date;
  processingCompleted?: Date;
}

export interface CleanupRule {
  type: 'expiration' | 'orphaned' | 'failed';
  condition: (file: BlobFileMetadata) => boolean;
  maxAge?: number; // in milliseconds
}

// In-memory store for file metadata (production should use Redis/database)
const fileRegistry = new Map<string, BlobFileMetadata>();

export class FileTracker {
  
  /**
   * Register a new uploaded file in the tracking system
   */
  static registerFile(
    blobUrl: string, 
    uploadId: string, 
    fileName: string, 
    fileSize: number, 
    fileType: string,
    sessionId?: string
  ): BlobFileMetadata {
    const blobId = this.extractBlobIdFromUrl(blobUrl);
    
    const metadata: BlobFileMetadata = {
      blobUrl,
      blobId,
      uploadId,
      fileName,
      fileSize,
      fileType,
      uploadTimestamp: new Date(),
      status: 'uploaded',
      sessionId,
      lastAccessed: new Date()
    };

    fileRegistry.set(blobId, metadata);
    return metadata;
  }

  /**
   * Update file status during processing lifecycle
   */
  static updateFileStatus(
    blobId: string, 
    status: BlobFileMetadata['status'],
    additionalData?: Partial<BlobFileMetadata>
  ): boolean {
    const existing = fileRegistry.get(blobId);
    if (!existing) {
      return false;
    }

    const updated: BlobFileMetadata = {
      ...existing,
      status,
      lastAccessed: new Date(),
      ...additionalData
    };

    // Set processing timestamps based on status
    if (status === 'processing' && !existing.processingStarted) {
      updated.processingStarted = new Date();
    } else if (status === 'completed' && !existing.processingCompleted) {
      updated.processingCompleted = new Date();
    }

    fileRegistry.set(blobId, updated);
    return true;
  }

  /**
   * Get file metadata by blob ID
   */
  static getFile(blobId: string): BlobFileMetadata | undefined {
    const file = fileRegistry.get(blobId);
    if (file) {
      // Update last accessed time
      file.lastAccessed = new Date();
      fileRegistry.set(blobId, file);
    }
    return file;
  }

  /**
   * Get file metadata by upload ID
   */
  static getFileByUploadId(uploadId: string): BlobFileMetadata | undefined {
    for (const file of fileRegistry.values()) {
      if (file.uploadId === uploadId) {
        file.lastAccessed = new Date();
        fileRegistry.set(file.blobId, file);
        return file;
      }
    }
    return undefined;
  }

  /**
   * Get all files matching specific criteria
   */
  static getFiles(filter?: (file: BlobFileMetadata) => boolean): BlobFileMetadata[] {
    const files = Array.from(fileRegistry.values());
    return filter ? files.filter(filter) : files;
  }

  /**
   * Get files eligible for cleanup based on rules
   */
  static getFilesForCleanup(rules: CleanupRule[]): BlobFileMetadata[] {
    const allFiles = Array.from(fileRegistry.values());
    const filesToCleanup: BlobFileMetadata[] = [];

    for (const file of allFiles) {
      for (const rule of rules) {
        if (rule.condition(file)) {
          filesToCleanup.push(file);
          break; // File matches at least one cleanup rule
        }
      }
    }

    return filesToCleanup;
  }

  /**
   * Remove file from tracking system
   */
  static removeFile(blobId: string): boolean {
    return fileRegistry.delete(blobId);
  }

  /**
   * Get registry statistics
   */
  static getStats(): {
    totalFiles: number;
    byStatus: Record<BlobFileMetadata['status'], number>;
    oldestFile?: Date;
    newestFile?: Date;
    totalSize: number;
  } {
    const files = Array.from(fileRegistry.values());
    const byStatus: Record<BlobFileMetadata['status'], number> = {
      uploaded: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      expired: 0
    };

    let oldestFile: Date | undefined;
    let newestFile: Date | undefined;
    let totalSize = 0;

    files.forEach(file => {
      byStatus[file.status]++;
      totalSize += file.fileSize;

      if (!oldestFile || file.uploadTimestamp < oldestFile) {
        oldestFile = file.uploadTimestamp;
      }
      if (!newestFile || file.uploadTimestamp > newestFile) {
        newestFile = file.uploadTimestamp;
      }
    });

    return {
      totalFiles: files.length,
      byStatus,
      oldestFile,
      newestFile,
      totalSize
    };
  }

  /**
   * Extract blob ID from Vercel Blob URL
   */
  private static extractBlobIdFromUrl(blobUrl: string): string {
    // Extract the blob ID from URLs like: https://example.vercel-storage.com/filename-abc123.ext
    const urlParts = blobUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // If URL contains a dash followed by ID, extract it; otherwise use full filename
    const match = filename.match(/^(.+)-([a-zA-Z0-9]+)(\.[^.]+)?$/);
    return match ? match[2] : filename;
  }

  /**
   * Clear all tracking data (for testing/development)
   */
  static clearAll(): void {
    fileRegistry.clear();
  }
}

// Default cleanup rules for 24-hour expiration as specified in PRD
export const DEFAULT_CLEANUP_RULES: CleanupRule[] = [
  {
    type: 'expiration',
    condition: (file) => {
      const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const ageInMs = Date.now() - file.uploadTimestamp.getTime();
      return ageInMs > twentyFourHours;
    },
    maxAge: 24 * 60 * 60 * 1000
  },
  {
    type: 'orphaned',
    condition: (file) => {
      // Files that have been stuck in 'processing' for more than 2 hours
      if (file.status !== 'processing' || !file.processingStarted) {
        return false;
      }
      const twoHours = 2 * 60 * 60 * 1000;
      const processingTime = Date.now() - file.processingStarted.getTime();
      return processingTime > twoHours;
    }
  },
  {
    type: 'failed',
    condition: (file) => {
      // Clean up failed uploads after 1 hour
      if (file.status !== 'failed') {
        return false;
      }
      const oneHour = 60 * 60 * 1000;
      const ageInMs = Date.now() - file.uploadTimestamp.getTime();
      return ageInMs > oneHour;
    }
  }
]; 
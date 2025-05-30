// Utility for managing upload progress
export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

// In-memory store for upload progress (in production, use Redis or similar)
const uploadProgressStore = new Map<string, UploadProgress>();

export class UploadProgressTracker {
  private uploadId: string;

  constructor(uploadId: string, totalBytes: number) {
    this.uploadId = uploadId;
    this.initProgress(totalBytes);
  }

  private initProgress(totalBytes: number) {
    uploadProgressStore.set(this.uploadId, {
      bytesUploaded: 0,
      totalBytes,
      status: 'uploading'
    });
  }

  updateProgress(bytesUploaded: number) {
    const current = uploadProgressStore.get(this.uploadId);
    if (current) {
      uploadProgressStore.set(this.uploadId, {
        ...current,
        bytesUploaded,
        status: 'uploading'
      });
    }
  }

  setCompleted() {
    const current = uploadProgressStore.get(this.uploadId);
    if (current) {
      uploadProgressStore.set(this.uploadId, {
        ...current,
        status: 'completed'
      });
    }
  }

  setFailed(error: string) {
    const current = uploadProgressStore.get(this.uploadId);
    if (current) {
      uploadProgressStore.set(this.uploadId, {
        ...current,
        status: 'failed',
        error
      });
    }
  }

  static getProgress(uploadId: string): UploadProgress | undefined {
    return uploadProgressStore.get(uploadId);
  }

  static deleteProgress(uploadId: string) {
    uploadProgressStore.delete(uploadId);
  }
}

// Generate unique upload ID
export function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
} 
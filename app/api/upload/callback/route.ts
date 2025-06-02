import { NextRequest } from 'next/server';
import { UploadProgressTracker } from '@/lib/upload-progress';
import { FileTracker } from '@/lib/file-tracking';
import { CleanupScheduler } from '@/lib/cleanup-scheduler';
import { 
  generateRequestId,
  createSuccessResponse,
  createErrorResponse,
  normalizeError,
  logError
} from '@/lib/errors/handlers';
import { isStorageError, ProcessingError } from '@/lib/errors/types';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();
    const { blob, clientPayload } = body;

    if (!blob || !clientPayload) {
      throw new ProcessingError(
        'Missing blob or clientPayload', 
        { hasBlob: !!blob, hasClientPayload: !!clientPayload }, 
        requestId
      );
    }

    // Parse the client payload we sent earlier
    const payload = JSON.parse(clientPayload);
    const { uploadId, originalFilename, sanitizedFilename, size, contentType } = payload;

    // Update progress tracker to completed
    const currentProgress = UploadProgressTracker.getProgress(uploadId);
    if (currentProgress) {
      const tracker = new UploadProgressTracker(uploadId, size);
      tracker.setCompleted();
    }

    // Register file in tracking system for cleanup management
    try {
      const sessionId = `session_${uploadId}`;
      const fileMetadata = FileTracker.registerFile(
        blob.url,
        uploadId,
        originalFilename,
        size,
        contentType,
        sessionId
      );

      console.log('✅ File uploaded successfully:', {
        url: blob.url,
        originalFilename,
        sanitizedFilename,
        size,
        uploadId
      });

      // Trigger cleanup scheduler after successful upload
      CleanupScheduler.onFileUploaded().catch(error => {
        const cleanupError = normalizeError(error, requestId);
        logError(cleanupError, { 
          endpoint: '/api/upload/callback', 
          action: 'cleanup_scheduling' 
        });
        // Don't fail the callback if cleanup scheduling fails
      });

      return createSuccessResponse({
        success: true,
        uploadId,
        url: blob.url,
        filename: sanitizedFilename,
        originalFilename,
        size,
        contentType,
        blobId: fileMetadata?.blobId,
        cleanupInfo: {
          registeredForCleanup: !!fileMetadata,
          expiresAfter: '24 hours',
          trackingId: fileMetadata?.blobId
        }
      }, requestId);

    } catch (error) {
      // Log but don't fail callback if tracking fails
      const trackingError = normalizeError(error, requestId);
      logError(trackingError, { 
        endpoint: '/api/upload/callback', 
        action: 'file_tracking',
        blobUrl: blob.url 
      });

      // Still return success since the upload itself succeeded
      return createSuccessResponse({
        success: true,
        uploadId,
        url: blob.url,
        filename: sanitizedFilename,
        originalFilename,
        size,
        contentType,
        cleanupInfo: {
          registeredForCleanup: false,
          warning: 'File tracking failed but upload succeeded'
        }
      }, requestId);
    }

  } catch (error) {
    const storageError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    logError(storageError, {
      endpoint: '/api/upload/callback',
      action: 'callback_processing'
    });

    return createErrorResponse(storageError);
  }
} 
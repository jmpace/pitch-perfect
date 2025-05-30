import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { UploadProgressTracker, generateUploadId } from '@/lib/upload-progress';
import { FileTracker } from '@/lib/file-tracking';
import { CleanupScheduler } from '@/lib/cleanup-scheduler';
import { 
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
  normalizeError,
  handleBlobSDKError,
  validateStorageConfig,
  withErrorHandling,
  withTimeout,
  checkRateLimit,
  logError
} from '@/lib/errors/handlers';
import { validateFile } from '@/lib/validation';
import { 
  isStorageError,
  BlobAccessError,
  UploadError,
  ProcessingError,
  ConfigurationError
} from '@/lib/errors/types';
import { createSanitizedHandler, SANITIZATION_CONFIGS, type SanitizedRequestData } from '@/lib/sanitization/middleware';
import { sanitize } from '@/lib/sanitization';

async function handleUpload(request: NextRequest, sanitizedData: SanitizedRequestData) {
  const requestId = generateRequestId();
  let progressTracker: UploadProgressTracker | null = null;
  let uploadId: string | null = null;

  try {
    // Validate storage configuration
    const configError = validateStorageConfig();
    if (configError) {
      logError(configError, { endpoint: '/api/upload', action: 'config_check' });
      return createErrorResponse(configError);
    }

    // Rate limiting check (based on IP) - use sanitized headers if available
    const clientIP = (sanitizedData.headers['x-forwarded-for'] || 
                     sanitizedData.headers['x-real-ip'] ||
                     request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown');
    checkRateLimit(`upload:${clientIP}`, 10, 60000, requestId); // 10 uploads per minute

    uploadId = generateUploadId();
    
    // Parse form data with error handling
    const formData = await withErrorHandling(
      () => request.formData(),
      'parsing_form_data',
      requestId
    );

    let file = formData.get('file') as File;

    // Sanitize the filename for security
    if (file) {
      const sanitizedFilename = sanitize.filename(file.name);
      // Create a new File object with the sanitized filename
      file = new File([file], sanitizedFilename, {
        type: file.type,
        lastModified: file.lastModified,
      });
      
      // Validate file with comprehensive error handling
      validateFile(file, requestId);
    } else {
      // Validate with original validation if no file
      validateFile(file, requestId);
    }

    // Initialize progress tracking
    progressTracker = new UploadProgressTracker(uploadId, file.size);

    // Create a progress-tracking stream with error handling
    const chunks: Uint8Array[] = [];
    const reader = file.stream().getReader();
    let bytesUploaded = 0;

    try {
      // Read file in chunks and track progress
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        bytesUploaded += value.length;
        progressTracker.updateProgress(bytesUploaded);
      }
    } catch (error) {
      progressTracker.setFailed('File reading failed');
      throw new ProcessingError(
        'Failed to read uploaded file',
        { 
          originalError: error instanceof Error ? error.message : String(error),
          bytesRead: bytesUploaded 
        },
        requestId
      );
    }

    // Combine chunks back into a Buffer for Vercel Blob
    let buffer: Buffer;
    try {
      const combinedChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combinedChunks.set(chunk, offset);
        offset += chunk.length;
      }
      buffer = Buffer.from(combinedChunks);
    } catch (error) {
      progressTracker.setFailed('File processing failed');
      throw new ProcessingError(
        'Failed to process uploaded file',
        { 
          originalError: error instanceof Error ? error.message : String(error),
          chunksCount: chunks.length 
        },
        requestId
      );
    }

    // Upload to Vercel Blob with timeout and specific error handling
    let blob;
    try {
      blob = await withTimeout(
        put(file.name, buffer, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }),
        30000, // 30 second timeout for upload
        requestId
      );
    } catch (error) {
      progressTracker.setFailed('Upload to storage failed');
      throw handleBlobSDKError(error, requestId);
    }

    // Mark upload as completed
    progressTracker.setCompleted();

    // Register file in tracking system for cleanup management
    let fileMetadata;
    try {
      const sessionId = `session_${uploadId}`;
      fileMetadata = FileTracker.registerFile(
        blob.url,
        uploadId,
        file.name,
        file.size,
        file.type,
        sessionId
      );
    } catch (error) {
      // Log but don't fail upload if tracking fails
      const trackingError = normalizeError(error, requestId);
      logError(trackingError, { 
        endpoint: '/api/upload', 
        action: 'file_tracking',
        blobUrl: blob.url 
      });
    }

    // Trigger cleanup scheduler after successful upload
    CleanupScheduler.onFileUploaded().catch(error => {
      const cleanupError = normalizeError(error, requestId);
      logError(cleanupError, { 
        endpoint: '/api/upload', 
        action: 'cleanup_scheduling' 
      });
      // Don't fail the upload if cleanup scheduling fails
    });

    const responseData = {
      uploadId,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      size: file.size,
      type: file.type,
      name: file.name, // This is now the sanitized filename
      sessionId: `session_${uploadId}`,
      blobId: fileMetadata?.blobId,
      // Include cleanup info for transparency
      cleanupInfo: {
        registeredForCleanup: !!fileMetadata,
        expiresAfter: '24 hours',
        trackingId: fileMetadata?.blobId
      }
    };

    return createSuccessResponse(responseData, requestId);

  } catch (error) {
    // Ensure progress tracker shows failure
    if (progressTracker) {
      progressTracker.setFailed(
        isStorageError(error) ? error.message : 'Upload failed'
      );
    }

    // Normalize error and create appropriate response
    const storageError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    // Enhanced logging with context - use sanitized headers where available
    const clientIP = (sanitizedData.headers['x-forwarded-for'] || 
                     sanitizedData.headers['x-real-ip'] ||
                     request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown');
    const userAgent = sanitizedData.headers['user-agent'] || request.headers.get('user-agent');
    logError(storageError, {
      endpoint: '/api/upload',
      uploadId,
      clientIP: clientIP,
      userAgent: userAgent,
      contentLength: request.headers.get('content-length'),
    });

    return createErrorResponse(storageError);
  }
}

// Export the sanitized handler using a custom UPLOAD configuration
export const POST = createSanitizedHandler(handleUpload, {
  sanitizeQuery: true,
  sanitizeBody: false, // Don't sanitize file content
  sanitizeHeaders: ['user-agent', 'x-forwarded-for', 'x-real-ip'],
  blockDangerous: true,
  maxBodySize: 100 * 1024 * 1024, // 100MB
}); 
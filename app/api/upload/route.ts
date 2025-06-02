import { NextRequest } from 'next/server';
import { UploadProgressTracker, generateUploadId } from '@/lib/upload-progress';
import { 
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
  normalizeError,
  logError
} from '@/lib/errors/handlers';
import { validateFile } from '@/lib/validation';
import { 
  isStorageError,
  ProcessingError,
  ConfigurationError
} from '@/lib/errors/types';
import { createSanitizedHandler, type SanitizedRequestData } from '@/lib/sanitization/middleware';
import { sanitize } from '@/lib/sanitization';
import { enforceRateLimit } from '@/lib/rate-limiter';

async function handleUploadRequest(request: NextRequest, sanitizedData: SanitizedRequestData) {
  const requestId = generateRequestId();

  try {
    // Rate limiting check
    enforceRateLimit(request, 'UPLOAD', requestId);

    const body = await request.json();
    const { filename, contentType, size } = body;

    // Validate the file parameters
    if (!filename || !contentType || !size) {
      throw new ProcessingError(
        'Missing required file parameters',
        { filename, contentType, size },
        requestId
      );
    }

    // Sanitize the filename for security
    const sanitizedFilename = sanitize.filename(filename);

    // Create a mock File object for validation
    const mockFile = {
      name: sanitizedFilename,
      type: contentType,
      size: size
    } as File;

    // Validate file with comprehensive error handling
    validateFile(mockFile, requestId);

    // Check if we have Blob token for Vercel Blob
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new ConfigurationError(
        'Blob storage not configured. Large file uploads require Vercel Blob storage.',
        { hasToken: false },
        requestId
      );
    }

    // Generate upload ID for tracking
    const uploadId = generateUploadId();

    // Generate a unique filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${sanitizedFilename}`;

    // Generate a client token for direct uploads to Vercel Blob
    // This allows the client to upload directly without going through our function
    const tokenResponse = await fetch('https://blob.vercel-storage.com/api/client-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pathname: uniqueFilename,
        contentType,
        callbackUrl: `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/upload/callback`,
        clientPayload: JSON.stringify({ 
          uploadId, 
          originalFilename: filename, 
          sanitizedFilename,
          size,
          contentType
        }),
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new ProcessingError(
        `Failed to generate client token: ${tokenResponse.status}`,
        { errorText, status: tokenResponse.status },
        requestId
      );
    }

    const tokenData = await tokenResponse.json();

    // Initialize progress tracking for this upload
    const progressTracker = new UploadProgressTracker(uploadId, size);
    progressTracker.updateProgress(0); // Start tracking

    return createSuccessResponse({
      uploadId,
      clientToken: tokenData.token,
      uploadUrl: `https://blob.vercel-storage.com/${uniqueFilename}`,
      filename: sanitizedFilename,
      originalFilename: filename,
      size,
      contentType,
      uniqueFilename
    }, requestId);

  } catch (error) {
    const storageError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    // Enhanced logging with context
    const clientIP = (sanitizedData.headers['x-forwarded-for'] || 
                     sanitizedData.headers['x-real-ip'] ||
                     request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown');
    const userAgent = sanitizedData.headers['user-agent'] || request.headers.get('user-agent');
    logError(storageError, {
      endpoint: '/api/upload',
      clientIP: clientIP,
      userAgent: userAgent,
    });

    return createErrorResponse(storageError);
  }
}

// Export the sanitized handler
export const POST = createSanitizedHandler(handleUploadRequest, {
  sanitizeQuery: true,
  sanitizeBody: true,
  sanitizeHeaders: ['user-agent', 'x-forwarded-for', 'x-real-ip'],
  blockDangerous: false,
  maxBodySize: 10 * 1024, // Small JSON payload only
}); 
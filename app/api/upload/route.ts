import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { UploadProgressTracker, generateUploadId } from '@/lib/upload-progress';
import { 
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
  normalizeError,
  logError
} from '@/lib/errors/handlers';
import { validateFileDetailed } from '@/lib/validation';
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
    // Rate limiting
    const rateLimitResult = enforceRateLimit(request, 'UPLOAD', requestId);
    if (!rateLimitResult.isAllowed) {
      throw new ProcessingError(
        'Rate limit exceeded',
        { rateLimitResult }
      );
    }

    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Parse client payload to get file metadata
        let uploadId: string;
        let fileMetadata: any;
        
        try {
          const payload = clientPayload ? JSON.parse(clientPayload) : {};
          uploadId = payload.uploadId || generateUploadId();
          fileMetadata = payload.metadata || {};
        } catch (error) {
          uploadId = generateUploadId();
          fileMetadata = {};
        }

        // Validate file metadata if provided
        if (fileMetadata.size || fileMetadata.type) {
          const mockFile = {
            name: pathname,
            size: fileMetadata.size || 0,
            type: fileMetadata.type || 'application/octet-stream'
          } as File;

          const validation = validateFileDetailed(mockFile);
          if (!validation.isValid) {
            throw new ProcessingError(
              'File validation failed',
              { errors: validation.errors }
            );
          }
        }

        // Initialize progress tracking
        const progressTracker = new UploadProgressTracker(uploadId, fileMetadata.size || 0);

        return {
          allowedContentTypes: [
            'video/mp4',
            'video/avi',
            'video/mov',
            'video/wmv',
            'video/webm',
            'video/quicktime',
            'application/octet-stream'
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB limit
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            uploadId,
            requestId,
            timestamp: Date.now()
          })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Parse token payload
        let uploadId: string;
        let requestId: string;
        
        try {
          const payload = JSON.parse(tokenPayload || '{}');
          uploadId = payload.uploadId;
          requestId = payload.requestId;
        } catch (error) {
          console.error('Failed to parse token payload:', error);
          uploadId = generateUploadId();
          requestId = generateRequestId();
        }

        try {
          // Update progress tracking
          const progressTracker = new UploadProgressTracker(uploadId, 0);
          progressTracker.setCompleted();

          console.log('Upload completed successfully:', {
            uploadId,
            requestId,
            blobUrl: blob.url,
            pathname: blob.pathname
          });

        } catch (error) {
          console.error('Error in upload completion handler:', error);
          
          // Update progress with error
          try {
            const progressTracker = new UploadProgressTracker(uploadId, 0);
            progressTracker.setFailed('Failed to process uploaded file');
          } catch (trackerError) {
            console.error('Failed to update progress tracker:', trackerError);
          }
        }
      },
    });

    return NextResponse.json(jsonResponse);

  } catch (error: any) {
    const normalizedError = normalizeError(error, requestId);
    logError(normalizedError);

    if (isStorageError(error)) {
      return createErrorResponse(
        new ConfigurationError(
          'Storage configuration error',
          { originalError: normalizedError },
          requestId
        )
      );
    }

    return createErrorResponse(normalizedError);
  }
}

// Apply sanitization middleware
export const POST = createSanitizedHandler(handleUploadRequest); 
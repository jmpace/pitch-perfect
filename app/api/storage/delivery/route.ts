// API endpoints for enhanced storage and delivery system
import { NextRequest, NextResponse } from 'next/server';
import { StorageDeliveryManager, ContentType, DeliveryOptions } from '@/lib/storage-delivery-manager';
import { 
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
  normalizeError,
  withErrorHandling
} from '@/lib/errors/handlers';
import { 
  isStorageError,
  BlobAccessError,
  ValidationError
} from '@/lib/errors/types';

// GET /api/storage/delivery - Retrieve content with delivery optimization
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const includeSignedUrl = searchParams.get('signed') === 'true';
    const streaming = searchParams.get('streaming') === 'true';
    const quality = searchParams.get('quality') as 'low' | 'medium' | 'high' | undefined;
    const cacheDuration = searchParams.get('cache') ? parseInt(searchParams.get('cache')!) : undefined;

    if (!url) {
      throw new ValidationError(
        'Missing required parameter: url',
        { parameter: 'url' },
        requestId
      );
    }

    const deliveryOptions: DeliveryOptions = {
      includeSignedUrl,
      streaming,
      quality,
      cacheDuration
    };

    const result = await StorageDeliveryManager.retrieveContent(url, deliveryOptions);

    if (!result.success) {
      return createErrorResponse(
        new BlobAccessError(result.error || 'Content retrieval failed', {}, requestId)
      );
    }

    return createSuccessResponse({
      content: result.content,
      alternatives: result.alternatives,
      deliveryOptions
    }, requestId);

  } catch (error) {
    const storageError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(storageError);
  }
}

// POST /api/storage/delivery - Batch content retrieval
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const body = await withErrorHandling(
      () => request.json(),
      'parsing_request_body',
      requestId
    );

    const { urls, options = {} } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      throw new ValidationError(
        'Invalid or empty urls array',
        { received: typeof urls, length: Array.isArray(urls) ? urls.length : 0 },
        requestId
      );
    }

    if (urls.length > 100) {
      throw new ValidationError(
        'Too many URLs requested - maximum 100 allowed',
        { requested: urls.length, limit: 100 },
        requestId
      );
    }

    const deliveryOptions: DeliveryOptions = {
      includeSignedUrl: options.includeSignedUrl || false,
      streaming: options.streaming || false,
      quality: options.quality,
      cacheDuration: options.cacheDuration
    };

    const batchResult = await StorageDeliveryManager.retrieveContentBatch(urls, deliveryOptions);

    return createSuccessResponse({
      results: batchResult.results,
      summary: batchResult.summary,
      deliveryOptions
    }, requestId);

  } catch (error) {
    const storageError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(storageError);
  }
}

// DELETE /api/storage/delivery - Delete content
export async function DELETE(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const cleanupMetadata = searchParams.get('cleanup') !== 'false';

    if (!url) {
      throw new ValidationError(
        'Missing required parameter: url',
        { parameter: 'url' },
        requestId
      );
    }

    const result = await StorageDeliveryManager.deleteContent(url, { cleanupMetadata });

    if (!result.success) {
      return createErrorResponse(
        new BlobAccessError(result.error || 'Content deletion failed', {}, requestId)
      );
    }

    return createSuccessResponse({
      deleted: true,
      url,
      cleanupMetadata
    }, requestId);

  } catch (error) {
    const storageError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(storageError);
  }
} 
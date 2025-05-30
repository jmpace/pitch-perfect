// API endpoints for video-specific storage operations
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
  ValidationError
} from '@/lib/errors/types';

// GET /api/storage/video/[videoId] - Get all content for a specific video
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ videoId: string }> }
) {
  const requestId = generateRequestId();

  try {
    const { videoId } = await props.params;
    const { searchParams } = new URL(request.url);
    
    const contentTypeParam = searchParams.get('type');
    const includeSignedUrl = searchParams.get('signed') === 'true';
    const streaming = searchParams.get('streaming') === 'true';
    const quality = searchParams.get('quality') as 'low' | 'medium' | 'high' | undefined;

    if (!videoId || videoId.trim() === '') {
      throw new ValidationError(
        'Invalid video ID',
        { videoId },
        requestId
      );
    }

    // Validate content type if provided
    let contentType: ContentType | undefined;
    if (contentTypeParam) {
      const validTypes = Object.values(ContentType);
      if (!validTypes.includes(contentTypeParam as ContentType)) {
        throw new ValidationError(
          'Invalid content type',
          { provided: contentTypeParam, valid: validTypes },
          requestId
        );
      }
      contentType = contentTypeParam as ContentType;
    }

    const deliveryOptions: DeliveryOptions = {
      includeSignedUrl,
      streaming,
      quality
    };

    const results: Record<string, any> = {};

    if (contentType) {
      // Get specific content type
      const content = await StorageDeliveryManager.getVideoContent(
        videoId, 
        contentType, 
        deliveryOptions
      );
      results[contentType] = content;
    } else {
      // Get all content types for this video
      const contentTypes = Object.values(ContentType);
      
      for (const type of contentTypes) {
        try {
          const content = await StorageDeliveryManager.getVideoContent(
            videoId, 
            type, 
            deliveryOptions
          );
          if (content.length > 0) {
            results[type] = content;
          }
        } catch (error) {
          // Log but don't fail the entire request for individual content type failures
          console.warn(`Failed to retrieve ${type} content for video ${videoId}:`, error);
        }
      }
    }

    // Calculate summary statistics
    const summary = {
      videoId,
      contentTypes: Object.keys(results),
      totalItems: Object.values(results).reduce((sum: number, items: any) => sum + items.length, 0),
      totalSize: Object.values(results).reduce((sum: number, items: any) => {
        return sum + items.reduce((itemSum: number, item: any) => {
          return itemSum + (item.content?.metadata?.size || 0);
        }, 0);
      }, 0)
    };

    return createSuccessResponse({
      videoId,
      content: results,
      summary,
      deliveryOptions
    }, requestId);

  } catch (error) {
    const storageError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(storageError);
  }
}

// DELETE /api/storage/video/[videoId] - Delete all content for a specific video
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ videoId: string }> }
) {
  const requestId = generateRequestId();

  try {
    const { videoId } = await props.params;
    const { searchParams } = new URL(request.url);
    
    const contentTypeParam = searchParams.get('type');
    const cleanupMetadata = searchParams.get('cleanup') !== 'false';

    if (!videoId || videoId.trim() === '') {
      throw new ValidationError(
        'Invalid video ID',
        { videoId },
        requestId
      );
    }

    // Validate content type if provided
    let contentType: ContentType | undefined;
    if (contentTypeParam) {
      const validTypes = Object.values(ContentType);
      if (!validTypes.includes(contentTypeParam as ContentType)) {
        throw new ValidationError(
          'Invalid content type',
          { provided: contentTypeParam, valid: validTypes },
          requestId
        );
      }
      contentType = contentTypeParam as ContentType;
    }

    const deletionResults: Record<string, any> = {};
    let totalDeleted = 0;
    let totalFailed = 0;

    const contentTypesToDelete = contentType 
      ? [contentType] 
      : Object.values(ContentType);

    for (const type of contentTypesToDelete) {
      try {
        // Get all content for this type
        const content = await StorageDeliveryManager.getVideoContent(videoId, type);
        
        const typeResults = {
          type,
          requested: content.length,
          deleted: 0,
          failed: 0,
          errors: [] as string[]
        };

        // Delete each item
        for (const item of content) {
          if (item.success && item.content.url) {
            try {
              const deleteResult = await StorageDeliveryManager.deleteContent(
                item.content.url,
                { cleanupMetadata }
              );
              
              if (deleteResult.success) {
                typeResults.deleted++;
                totalDeleted++;
              } else {
                typeResults.failed++;
                totalFailed++;
                if (deleteResult.error) {
                  typeResults.errors.push(deleteResult.error);
                }
              }
            } catch (error) {
              typeResults.failed++;
              totalFailed++;
              typeResults.errors.push(normalizeError(error, requestId).message);
            }
          }
        }

        deletionResults[type] = typeResults;

      } catch (error) {
        deletionResults[type] = {
          type,
          requested: 0,
          deleted: 0,
          failed: 0,
          errors: [normalizeError(error, requestId).message]
        };
      }
    }

    const summary = {
      videoId,
      contentType: contentType || 'all',
      totalDeleted,
      totalFailed,
      cleanupMetadata
    };

    return createSuccessResponse({
      videoId,
      deletionResults,
      summary
    }, requestId);

  } catch (error) {
    const storageError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    return createErrorResponse(storageError);
  }
} 
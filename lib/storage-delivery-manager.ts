// Enhanced Storage and Delivery Manager for Video Processing Content
import { put, list, del, head } from '@vercel/blob';
import { nanoid } from 'nanoid';
import { BlobManager } from './blob-manager';
import { FileTracker } from './file-tracking';
import { 
  VideoProcessingError,
  BlobAccessError,
  NetworkError,
  InternalServerError
} from './errors/types';
import { 
  generateRequestId, 
  logError, 
  normalizeError,
  withTimeout 
} from './errors/handlers';

// Storage configuration interface
export interface StorageConfig {
  enableCompression: boolean;
  enableCDN: boolean;
  defaultCacheTimeout: number;
  signedUrlExpiration: number;
  enableTiering: boolean;
  maxFileAge: number;
  compressionQuality: number;
}

// Content types for organized storage
export enum ContentType {
  VIDEO = 'videos',
  FRAMES = 'frames',
  AUDIO = 'audio',
  METADATA = 'metadata',
  THUMBNAILS = 'thumbnails'
}

// Delivery options for different use cases
export interface DeliveryOptions {
  includeSignedUrl?: boolean;
  cacheDuration?: number;
  enableCompression?: boolean;
  format?: 'original' | 'optimized';
  quality?: 'low' | 'medium' | 'high';
  streaming?: boolean;
}

// Storage result interface
export interface StorageResult {
  success: boolean;
  url: string;
  signedUrl?: string;
  metadata: {
    size: number;
    contentType: string;
    uploadedAt: Date;
    expiresAt?: Date;
    compressed: boolean;
    storageId: string;
  };
  error?: string;
  requestId: string;
}

// Delivery result interface
export interface DeliveryResult {
  success: boolean;
  content: {
    url: string;
    signedUrl?: string;
    streamingUrl?: string;
    metadata: {
      size: number;
      contentType: string;
      lastModified: Date;
      cacheControl: string;
      compressed: boolean;
    };
  };
  alternatives?: {
    quality: string;
    url: string;
    size: number;
  }[];
  error?: string;
  requestId: string;
}

// Batch delivery result
export interface BatchDeliveryResult {
  success: boolean;
  results: DeliveryResult[];
  summary: {
    totalRequested: number;
    successful: number;
    failed: number;
    totalSize: number;
  };
  requestId: string;
}

// Storage analytics interface
export interface StorageAnalytics {
  usage: {
    totalSize: number;
    totalFiles: number;
    byContentType: Record<ContentType, { count: number; size: number }>;
  };
  performance: {
    averageUploadTime: number;
    averageDownloadTime: number;
    cacheHitRate: number;
    cdnHitRate: number;
  };
  costs: {
    storageUsage: number;
    bandwidth: number;
    operations: number;
    total: number;
  };
}

export class StorageDeliveryManager {
  private static readonly DEFAULT_CONFIG: StorageConfig = {
    enableCompression: true,
    enableCDN: true,
    defaultCacheTimeout: 3600, // 1 hour
    signedUrlExpiration: 7200, // 2 hours
    enableTiering: true,
    maxFileAge: 24 * 60 * 60 * 1000, // 24 hours
    compressionQuality: 85
  };

  private static config: StorageConfig = this.DEFAULT_CONFIG;
  private static analytics = new Map<string, any>();

  /**
   * Initialize storage and delivery manager with configuration
   */
  static initialize(config: Partial<StorageConfig> = {}): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    console.log('StorageDeliveryManager initialized with config:', this.config);
  }

  /**
   * Store video processing content with enhanced organization
   */
  static async storeContent(
    contentType: ContentType,
    videoId: string,
    filename: string,
    content: Buffer | Uint8Array,
    options: {
      metadata?: Record<string, unknown>;
      compress?: boolean;
      generateThumbnail?: boolean;
    } = {}
  ): Promise<StorageResult> {
    const requestId = generateRequestId();
    const storageId = nanoid();

    try {
      // Generate organized storage path
      const storagePath = this.generateStoragePath(contentType, videoId, filename, storageId);
      
      // Process content if compression is enabled
      let processedContent = content;
      let compressed = false;
      
      if (options.compress !== false && this.config.enableCompression) {
        try {
          processedContent = await this.compressContent(content, contentType);
          compressed = true;
        } catch (error) {
          // Log compression error but continue with original content
          logError(normalizeError(error, requestId), { 
            operation: 'compression', 
            contentType, 
            videoId 
          });
        }
      }

      // Upload to Vercel Blob storage with enhanced metadata
      const blobResult = await withTimeout(
        put(storagePath, Buffer.from(processedContent), {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
          addRandomSuffix: false,
        }),
        30000, // 30 second timeout
        requestId
      );

      // Generate signed URL if requested
      let signedUrl: string | undefined;
      if (this.config.signedUrlExpiration > 0) {
        signedUrl = await this.generateSignedUrl(blobResult.url, this.config.signedUrlExpiration);
      }

      // Register with file tracker
      try {
        FileTracker.registerFile(
          blobResult.url,
          storageId,
          filename,
          processedContent.length,
          this.getContentTypeString(contentType),
          `video_${videoId}`
        );
      } catch (error) {
        logError(normalizeError(error, requestId), { 
          operation: 'file_tracking', 
          blobUrl: blobResult.url 
        });
      }

      // Update analytics
      this.updateStorageAnalytics(contentType, processedContent.length, Date.now());

      const result: StorageResult = {
        success: true,
        url: blobResult.url,
        signedUrl,
        metadata: {
          size: processedContent.length,
          contentType: this.getContentTypeString(contentType),
          uploadedAt: new Date(),
          compressed,
          storageId
        },
        requestId
      };

      return result;

    } catch (error) {
      const storageError = normalizeError(error, requestId);
      logError(storageError, { 
        operation: 'storeContent', 
        contentType, 
        videoId, 
        filename 
      });

      return {
        success: false,
        url: '',
        metadata: {
          size: 0,
          contentType: this.getContentTypeString(contentType),
          uploadedAt: new Date(),
          compressed: false,
          storageId
        },
        error: storageError.message,
        requestId
      };
    }
  }

  /**
   * Retrieve content with delivery optimization
   */
  static async retrieveContent(
    url: string,
    options: DeliveryOptions = {}
  ): Promise<DeliveryResult> {
    const requestId = generateRequestId();

    try {
      // Get blob information
      const blobInfo = await BlobManager.getBlobInfo(url);
      
      if (!blobInfo.exists) {
        throw new BlobAccessError('Content not found', { url }, requestId);
      }

      // Generate delivery URLs based on options
      let deliveryUrl = url;
      let signedUrl: string | undefined;
      let streamingUrl: string | undefined;

      if (options.includeSignedUrl) {
        signedUrl = await this.generateSignedUrl(
          url, 
          options.cacheDuration || this.config.signedUrlExpiration
        );
      }

      if (options.streaming && this.supportsStreaming(url)) {
        streamingUrl = this.generateStreamingUrl(url);
      }

      // Apply CDN optimization if enabled
      if (this.config.enableCDN) {
        deliveryUrl = this.applyCDNOptimization(url);
      }

      // Generate cache control headers
      const cacheControl = this.generateCacheControl(options.cacheDuration);

      // Update analytics
      this.updateDeliveryAnalytics(url, blobInfo.size, Date.now());

      const result: DeliveryResult = {
        success: true,
        content: {
          url: deliveryUrl,
          signedUrl,
          streamingUrl,
          metadata: {
            size: blobInfo.size,
            contentType: this.inferContentType(url),
            lastModified: blobInfo.uploadedAt,
            cacheControl,
            compressed: this.isCompressed(url)
          }
        },
        requestId
      };

      // Add quality alternatives if applicable
      if (this.hasQualityVariants(url)) {
        result.alternatives = await this.getQualityVariants(url);
      }

      return result;

    } catch (error) {
      const deliveryError = normalizeError(error, requestId);
      logError(deliveryError, { operation: 'retrieveContent', url });

      return {
        success: false,
        content: {
          url: '',
          metadata: {
            size: 0,
            contentType: 'application/octet-stream',
            lastModified: new Date(),
            cacheControl: 'no-cache',
            compressed: false
          }
        },
        error: deliveryError.message,
        requestId
      };
    }
  }

  /**
   * Retrieve multiple content items in batch
   */
  static async retrieveContentBatch(
    urls: string[],
    options: DeliveryOptions = {}
  ): Promise<BatchDeliveryResult> {
    const requestId = generateRequestId();
    const results: DeliveryResult[] = [];
    let totalSize = 0;
    let successful = 0;

    for (const url of urls) {
      try {
        const result = await this.retrieveContent(url, options);
        results.push(result);
        
        if (result.success) {
          successful++;
          totalSize += result.content.metadata.size;
        }

        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        results.push({
          success: false,
          content: {
            url: '',
            metadata: {
              size: 0,
              contentType: 'application/octet-stream',
              lastModified: new Date(),
              cacheControl: 'no-cache',
              compressed: false
            }
          },
          error: normalizeError(error, requestId).message,
          requestId
        });
      }
    }

    return {
      success: successful > 0,
      results,
      summary: {
        totalRequested: urls.length,
        successful,
        failed: urls.length - successful,
        totalSize
      },
      requestId
    };
  }

  /**
   * Get content by video ID and type
   */
  static async getVideoContent(
    videoId: string,
    contentType: ContentType,
    options: DeliveryOptions = {}
  ): Promise<DeliveryResult[]> {
    const requestId = generateRequestId();

    try {
      // List all blobs with the video ID prefix
      const listResult = await BlobManager.listBlobs({
        prefix: this.generateStoragePrefix(contentType, videoId),
        limit: 1000
      });

      const results: DeliveryResult[] = [];

      for (const blob of listResult.blobs) {
        const deliveryResult = await this.retrieveContent(blob.url, options);
        results.push(deliveryResult);
      }

      return results;

    } catch (error) {
      const storageError = normalizeError(error, requestId);
      logError(storageError, { operation: 'getVideoContent', videoId, contentType });
      return [];
    }
  }

  /**
   * Delete content and clean up storage
   */
  static async deleteContent(
    url: string,
    options: { cleanupMetadata?: boolean } = {}
  ): Promise<{ success: boolean; error?: string; requestId: string }> {
    const requestId = generateRequestId();

    try {
      const deleteResult = await BlobManager.deleteBlob(url);
      
      if (options.cleanupMetadata !== false) {
        // Clean up any associated metadata or variants
        await this.cleanupContentMetadata(url);
      }

      return {
        success: deleteResult.success,
        error: deleteResult.error,
        requestId
      };

    } catch (error) {
      const storageError = normalizeError(error, requestId);
      logError(storageError, { operation: 'deleteContent', url });

      return {
        success: false,
        error: storageError.message,
        requestId
      };
    }
  }

  /**
   * Get storage and delivery analytics
   */
  static getAnalytics(): StorageAnalytics {
    // Implementation would integrate with actual analytics data
    return {
      usage: {
        totalSize: 0,
        totalFiles: 0,
        byContentType: {
          [ContentType.VIDEO]: { count: 0, size: 0 },
          [ContentType.FRAMES]: { count: 0, size: 0 },
          [ContentType.AUDIO]: { count: 0, size: 0 },
          [ContentType.METADATA]: { count: 0, size: 0 },
          [ContentType.THUMBNAILS]: { count: 0, size: 0 }
        }
      },
      performance: {
        averageUploadTime: 0,
        averageDownloadTime: 0,
        cacheHitRate: 0,
        cdnHitRate: 0
      },
      costs: {
        storageUsage: 0,
        bandwidth: 0,
        operations: 0,
        total: 0
      }
    };
  }

  // Private helper methods

  private static generateStoragePath(
    contentType: ContentType,
    videoId: string,
    filename: string,
    storageId: string
  ): string {
    const timestamp = Date.now();
    const extension = this.extractFileExtension(filename);
    return `${videoId}/${contentType}/${timestamp}_${storageId}${extension}`;
  }

  private static generateStoragePrefix(contentType: ContentType, videoId: string): string {
    return `${videoId}/${contentType}/`;
  }

  private static getContentTypeString(contentType: ContentType): string {
    const mappings = {
      [ContentType.VIDEO]: 'video/mp4',
      [ContentType.FRAMES]: 'image/jpeg',
      [ContentType.AUDIO]: 'audio/mpeg',
      [ContentType.METADATA]: 'application/json',
      [ContentType.THUMBNAILS]: 'image/jpeg'
    };
    return mappings[contentType] || 'application/octet-stream';
  }

  private static extractFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  }

  private static async compressContent(
    content: Buffer | Uint8Array,
    contentType: ContentType
  ): Promise<Buffer | Uint8Array> {
    // Placeholder for compression logic
    // In production, this would use appropriate compression libraries
    // For images: sharp, imagemin
    // For audio: node-ffmpeg
    // For videos: ffmpeg
    return content;
  }

  private static async generateSignedUrl(url: string, expirationSeconds: number): Promise<string> {
    // Placeholder for signed URL generation
    // In production, this would integrate with Vercel Blob's signed URL API
    // or implement custom URL signing
    const expiry = Date.now() + (expirationSeconds * 1000);
    return `${url}?expires=${expiry}&signature=placeholder`;
  }

  private static supportsStreaming(url: string): boolean {
    // Check if content type supports streaming
    return url.includes('video/') || url.includes('.mp4') || url.includes('.webm');
  }

  private static generateStreamingUrl(url: string): string {
    // Generate HLS or DASH streaming URL
    return `${url.replace(/\.[^.]+$/, '')}/playlist.m3u8`;
  }

  private static applyCDNOptimization(url: string): string {
    // Apply CDN transformations and optimizations
    // This would integrate with a CDN provider like Cloudflare, AWS CloudFront, etc.
    return url;
  }

  private static generateCacheControl(cacheDuration?: number): string {
    const duration = cacheDuration || this.config.defaultCacheTimeout;
    return `public, max-age=${duration}, s-maxage=${duration}`;
  }

  private static inferContentType(url: string): string {
    const extension = this.extractFileExtension(url).toLowerCase();
    const mappings: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.json': 'application/json'
    };
    return mappings[extension] || 'application/octet-stream';
  }

  private static isCompressed(url: string): boolean {
    // Heuristic to determine if content is compressed
    return url.includes('compressed') || url.includes('_opt');
  }

  private static hasQualityVariants(url: string): boolean {
    // Check if quality variants exist for this content
    return url.includes('frames') || url.includes('video');
  }

  private static async getQualityVariants(url: string): Promise<{ quality: string; url: string; size: number }[]> {
    // Get different quality versions of the content
    return [
      { quality: 'high', url: url.replace('.jpg', '_high.jpg'), size: 1024000 },
      { quality: 'medium', url: url.replace('.jpg', '_medium.jpg'), size: 512000 },
      { quality: 'low', url: url.replace('.jpg', '_low.jpg'), size: 256000 }
    ];
  }

  private static async cleanupContentMetadata(url: string): Promise<void> {
    // Clean up any associated metadata, thumbnails, or variant files
    // This is a placeholder for cleanup logic
  }

  private static updateStorageAnalytics(contentType: ContentType, size: number, timestamp: number): void {
    // Update analytics tracking
    const key = `storage_${contentType}_${new Date().toISOString().split('T')[0]}`;
    if (!this.analytics.has(key)) {
      this.analytics.set(key, { count: 0, size: 0, timestamps: [] });
    }
    const data = this.analytics.get(key);
    data.count++;
    data.size += size;
    data.timestamps.push(timestamp);
  }

  private static updateDeliveryAnalytics(url: string, size: number, timestamp: number): void {
    // Update delivery analytics tracking
    const key = `delivery_${new Date().toISOString().split('T')[0]}`;
    if (!this.analytics.has(key)) {
      this.analytics.set(key, { requests: 0, bandwidth: 0, timestamps: [] });
    }
    const data = this.analytics.get(key);
    data.requests++;
    data.bandwidth += size;
    data.timestamps.push(timestamp);
  }
} 
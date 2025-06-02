// Enhanced Video Processing Service for serverless-compatible video metadata extraction
import { nanoid } from 'nanoid';
import * as videoMetadata from 'fast-video-metadata';
import { put } from '@vercel/blob';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  VideoProcessingError,
  VideoFormatError,
  VideoCorruptedError,
  FrameExtractionError,
  AudioExtractionError
} from './errors/types';
import { generateRequestId, logError, normalizeError } from './errors/handlers';
import { enhancedErrorHandler } from './enhanced-error-handling';

// Enhanced interfaces building on base video processor
export interface EnhancedVideoMetadata {
  duration: number;
  resolution: string;
  fps: number;
  codec: string;
  size: number;
  format: string;
  bitrate?: number;
  aspectRatio?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  thumbnailUrl?: string;
  processingComplexity: 'low' | 'medium' | 'high';
}

export interface VideoQualityAnalysis {
  overallScore: number; // 0-100
  videoQuality: number;
  audioQuality: number;
  stabilityScore: number;
  noiseLevel: number;
  colorAccuracy: number;
  recommendations: string[];
}

export interface AdvancedProcessingOptions {
  // Frame extraction options
  frameInterval?: number;
  frameQuality?: number;
  frameResolution?: { width: number; height: number };
  extractKeyFramesOnly?: boolean;
  frameFormat?: 'jpg' | 'png' | 'webp';
  
  // Audio options
  audioFormat?: 'mp3' | 'wav' | 'aac';
  audioQuality?: number;
  extractAudio?: boolean;
  audioNormalization?: boolean;
  
  // Video analysis
  performQualityAnalysis?: boolean;
  detectScenes?: boolean;
  extractThumbnail?: boolean;
  
  // Processing limits
  maxFrames?: number;
  maxDuration?: number;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface EnhancedFrameMetadata {
  timestamp: number;
  url: string;
  size: number;
  width: number;
  height: number;
  isKeyFrame?: boolean;
  sceneChange?: boolean;
  qualityScore?: number;
  motionLevel?: number;
}

export interface SceneDetectionResult {
  scenes: Array<{
    startTime: number;
    endTime: number;
    duration: number;
    frameCount: number;
    keyFrame: string; // URL to representative frame
    confidence: number;
  }>;
  totalScenes: number;
  averageSceneDuration: number;
}

export interface EnhancedAudioMetadata {
  url: string;
  duration: number;
  format: string;
  size: number;
  sampleRate: number;
  channels: number;
  isNormalized: boolean;
}

export interface EnhancedProcessingResults {
  videoMetadata: EnhancedVideoMetadata;
  frames: EnhancedFrameMetadata[];
  audio?: EnhancedAudioMetadata;
  qualityAnalysis?: VideoQualityAnalysis;
  sceneDetection?: SceneDetectionResult;
  thumbnail?: {
    url: string;
    timestamp: number;
    size: number;
  };
  processingStats: {
    processingTime: number;
    memoryUsed: number;
    complexity: 'low' | 'medium' | 'high';
    warnings: string[];
  };
}

export class EnhancedVideoProcessor {
  private static readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  private static readonly MAX_DURATION = 3600; // 1 hour
  private static readonly DEFAULT_OPTIONS: Required<AdvancedProcessingOptions> = {
    frameInterval: 10,
    frameQuality: 85,
    frameResolution: { width: 1280, height: 720 },
    extractKeyFramesOnly: false,
    frameFormat: 'jpg',
    audioFormat: 'mp3',
    audioQuality: 128,
    extractAudio: true,
    audioNormalization: false,
    performQualityAnalysis: false,
    detectScenes: false,
    extractThumbnail: true,
    maxFrames: 100,
    maxDuration: 3600,
    timeout: 1800000, // 30 minutes
    priority: 'normal'
  };

  /**
   * Process video with enhanced features (serverless-compatible)
   */
  static async processVideoAdvanced(
    videoUrl: string,
    options: AdvancedProcessingOptions = {}
  ): Promise<EnhancedProcessingResults> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const warnings: string[] = [];
    
    // Merge options with defaults
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    try {
      console.log(`Starting enhanced video processing for ${videoUrl}`);
      
      // Step 1: Enhanced metadata extraction and validation
      const videoMetadata = await this.extractEnhancedMetadata(videoUrl, requestId);
      
      // Validate file constraints
      this.validateVideoConstraints(videoMetadata, opts);
      
      // Note: Due to serverless limitations, advanced processing features are limited
      warnings.push('Advanced frame extraction not available in serverless environment');
      warnings.push('Audio extraction not available in serverless environment');
      warnings.push('Quality analysis not available in serverless environment');
      warnings.push('Scene detection not available in serverless environment');
      
      // Return basic results with warnings
      const processingTime = Date.now() - startTime;
      
      const results: EnhancedProcessingResults = {
        videoMetadata,
        frames: [],
        processingStats: {
          processingTime,
          memoryUsed: process.memoryUsage().heapUsed,
          complexity: videoMetadata.processingComplexity,
          warnings
        }
      };

      console.log(`Enhanced video processing completed in ${processingTime}ms with limitations`);
      return results;
      
    } catch (error) {
      const normalizedError = normalizeError(error, requestId);
      logError(normalizedError, {
        context: 'enhanced-video-processing',
        videoUrl,
        operation: 'processVideoAdvanced'
      });
      throw error;
    }
  }

  /**
   * Extract enhanced metadata using serverless-compatible methods
   */
  private static async extractEnhancedMetadata(
    videoUrl: string,
    requestId: string
  ): Promise<EnhancedVideoMetadata> {
    return enhancedErrorHandler.executeWithProtection(
      async () => {
        try {
          // Use fast-video-metadata for serverless compatibility
          const metadata = await videoMetadata.read(videoUrl);
          
          // Extract what we can from the metadata
          let duration = 0;
          if (metadata && typeof metadata === 'object' && 'creationTime' in metadata && 'modificationTime' in metadata) {
            duration = metadata.creationTime && metadata.modificationTime 
              ? (new Date(metadata.modificationTime).getTime() - new Date(metadata.creationTime).getTime()) / 1000
              : 0;
          }

          // Determine processing complexity based on basic factors
          const processingComplexity = this.estimateProcessingComplexity(duration, 'unknown');
          
          return {
            duration,
            resolution: 'unknown',
            fps: 30,
            codec: 'unknown',
            size: 0,
            format: 'mp4',
            processingComplexity,
            // Enhanced fields with fallbacks
            bitrate: undefined,
            aspectRatio: '16:9', // Common default
            audioCodec: undefined,
            audioChannels: undefined,
            audioSampleRate: undefined,
            thumbnailUrl: undefined
          };
        } catch (error: any) {
          console.warn('Enhanced metadata extraction failed, using fallback:', error.message);
          
          return {
            duration: 0,
            resolution: 'unknown',
            fps: 30,
            codec: 'unknown',
            size: 0,
            format: 'mp4',
            processingComplexity: 'low' as const
          };
        }
      },
      'enhanced-metadata',
      requestId,
      'enhanced-metadata-extraction'
    );
  }

  /**
   * Estimate processing complexity based on video characteristics
   */
  private static estimateProcessingComplexity(
    duration: number,
    resolution: string
  ): 'low' | 'medium' | 'high' {
    // Simple heuristic based on duration and resolution
    if (duration > 1800) return 'high'; // > 30 minutes
    if (duration > 600) return 'medium'; // > 10 minutes
    if (resolution.includes('4K') || resolution.includes('2160')) return 'high';
    if (resolution.includes('1080')) return 'medium';
    return 'low';
  }

  /**
   * Validate video constraints
   */
  private static validateVideoConstraints(
    metadata: EnhancedVideoMetadata,
    options: Required<AdvancedProcessingOptions>
  ): void {
    if (metadata.size > this.MAX_FILE_SIZE) {
      throw new VideoProcessingError(
        `Video file too large: ${metadata.size} bytes (max: ${this.MAX_FILE_SIZE})`,
        { size: metadata.size, limit: this.MAX_FILE_SIZE }
      );
    }

    if (metadata.duration > options.maxDuration) {
      throw new VideoProcessingError(
        `Video duration too long: ${metadata.duration}s (max: ${options.maxDuration}s)`,
        { duration: metadata.duration, limit: options.maxDuration }
      );
    }

    if (metadata.duration <= 0) {
      throw new VideoCorruptedError(
        'Video appears to have invalid duration',
        { duration: metadata.duration }
      );
    }
  }

  /**
   * Get processing cost estimate
   */
  static estimateProcessingCost(
    videoUrl: string,
    options: AdvancedProcessingOptions = {}
  ): Promise<{
    estimatedTime: number; // seconds
    estimatedCost: number; // arbitrary units
    complexity: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    // Simplified cost estimation for serverless environment
    return Promise.resolve({
      estimatedTime: 30, // Basic metadata extraction
      estimatedCost: 1,
      complexity: 'low',
      recommendations: [
        'Serverless environment has limited video processing capabilities',
        'Consider using dedicated video processing services for advanced features'
      ]
    });
  }

  /**
   * Get supported formats and capabilities
   */
  static getSupportedFormats(): {
    input: string[];
    outputFrames: string[];
    outputAudio: string[];
    maxResolution: string;
    limitations: string[];
  } {
    return {
      input: ['mp4', 'mov', 'avi', 'mkv', 'webm'], // Common formats that fast-video-metadata might support
      outputFrames: [], // Not supported in serverless
      outputAudio: [], // Not supported in serverless
      maxResolution: 'N/A',
      limitations: [
        'Frame extraction not available in serverless environment',
        'Audio extraction not available in serverless environment',
        'Quality analysis not available in serverless environment',
        'Scene detection not available in serverless environment',
        'Only basic metadata extraction is supported'
      ]
    };
  }
} 
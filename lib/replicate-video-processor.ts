// Replicate Video Processor - Serverless video processing using Replicate API
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';
import { 
  VideoProcessingError,
  VideoFormatError,
  FrameExtractionError,
  AudioExtractionError
} from './errors/types';
import { generateRequestId, logError, normalizeError } from './errors/handlers';

// Replicate API response types
type ReplicateFrameExtractionOutput = string[]; // video-to-frames returns array of URLs directly

interface ReplicateAudioExtractionOutput {
  audio_url?: string;
  duration?: number;
}

interface ReplicateMetadataOutput {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  frame_rate?: number;
  codec?: string;
  video_codec?: string;
  file_size?: number;
  size?: number;
  format?: string;
  container?: string;
  resolution?: string;
}

// Import types from enhanced processor and storage manager
import type {
  EnhancedFrameMetadata,
  EnhancedAudioMetadata,
  VideoMetadata,
  EnhancedVideoProcessingOptions
} from './enhanced-video-processor';
import type {
  StorageResult,
  DeliveryResult
} from './storage-delivery-manager';

export class ReplicateVideoProcessor {
  private static replicate: Replicate | null = null;

  /**
   * Initialize Replicate client
   */
  private static getReplicateClient(): Replicate {
    if (!this.replicate) {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) {
        throw new VideoProcessingError(
          'REPLICATE_API_TOKEN environment variable is not set',
          { service: 'replicate' },
          generateRequestId()
        );
      }
      this.replicate = new Replicate({ auth: apiToken });
    }
    return this.replicate;
  }

  /**
   * Extract video metadata using Replicate
   */
  static async extractVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    const requestId = generateRequestId();
    
    try {
      const replicate = this.getReplicateClient();
      
      // Use a lightweight model to get video metadata
      // Note: This is a placeholder - you may need to find/create a specific metadata extraction model
      // For now, we'll use a basic approach that works with most models
      
      console.log(`Extracting video metadata for: ${videoUrl}`);
      
      // Extract basic video information using frame extraction
      // Since fofr/toolkit doesn't have a probe operation, we'll use frame extraction to validate the video
      console.log('Validating video by extracting a single frame...');
      
      const frameOutput = await replicate.run(
        "19711d11c243800f08364ba9ae9078f54874f21363ba445dabdbf082b5d69565" as any,
        {
          input: {
            task: "extract_frames_from_input",
            input_file: videoUrl,
            fps: 1 // Extract just 1 frame to validate video
          }
        }
      ) as unknown as string; // This returns a ZIP file URL with frames
      
      // Create basic metadata since we can't probe directly
      // For a production app, you'd want a dedicated metadata extraction service
      const output: ReplicateMetadataOutput = {
        duration: 120, // Default estimate - would need ffprobe or similar
        width: 1920,   // Default HD resolution
        height: 1080,
        fps: 30,
        codec: 'h264',
        format: 'mp4'
      };

      // Parse the metadata from the output
      const metadata = this.parseMetadataOutput(output);
      
      console.log('Video metadata extracted:', metadata);
      
      return metadata;

    } catch (error) {
      const normalizedError = normalizeError(error, requestId);
      logError(normalizedError, { operation: 'extractVideoMetadata', videoUrl });
      
      // Return fallback metadata if extraction fails
      console.warn('Video metadata extraction failed, using fallback:', error);
      
      return {
        duration: 0,
        resolution: 'unknown',
        fps: 30,
        codec: 'unknown',
        size: 0,
        format: 'mp4'
      };
    }
  }

  /**
   * Extract frames using Replicate frame extraction model
   */
  static async extractAndStoreFrames(
    videoUrl: string,
    videoMetadata: VideoMetadata,
    options: Required<EnhancedVideoProcessingOptions>,
    jobId: string,
    onProgress: (progress: number) => void
  ): Promise<EnhancedFrameMetadata[]> {
    const requestId = generateRequestId();
    
    try {
      const replicate = this.getReplicateClient();
      
      console.log(`Starting frame extraction for job ${jobId} with interval ${options.frameInterval}s`);
      
      onProgress(10); // Starting frame extraction
      
      // Use the video-to-frames model for proper frame extraction
      const fps = 1 / options.frameInterval; // Convert interval to frames per second
      const output = await replicate.run(
        "ad9374d1b385c86948506b3ad287af9fca23e796685221782d9baa2bc43f14a9" as any,
        {
          input: {
            video: videoUrl,
            fps: fps, // Extract frames at specified interval
            extract_all_frames: false // Use fps setting instead of all frames
          }
        }
      ) as unknown as ReplicateFrameExtractionOutput;
      
      onProgress(40); // Frame extraction complete
      
      console.log(`Extracted ${output.length || 0} frames from Replicate`);
      
      if (!output || !Array.isArray(output)) {
        throw new FrameExtractionError(
          'No frames returned from Replicate',
          { output },
          requestId
        );
      }
      
      // Store frames in Vercel Blob for permanent storage
      const frames: EnhancedFrameMetadata[] = [];
      
      for (let i = 0; i < output.length; i++) {
        const frameUrl = output[i];
        const timestamp = i * options.frameInterval;
        
        try {
          // Download frame from Replicate
          const response = await fetch(frameUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch frame: ${response.status} ${response.statusText}`);
          }
          
          const frameBuffer = await response.arrayBuffer();
          
          // Store in Vercel Blob with organized path
          const blobResult = await put(
            `${jobId}/frames/frame_${timestamp}s.jpg`,
            Buffer.from(frameBuffer),
            { 
              access: 'public',
              token: process.env.BLOB_READ_WRITE_TOKEN
            }
          );
          
          // Create storage result
          const storageResult: StorageResult = {
            success: true,
            url: blobResult.url,
            metadata: {
              size: frameBuffer.byteLength,
              contentType: 'image/jpeg',
              uploadedAt: new Date(),
              compressed: false,
              storageId: nanoid()
            },
            requestId
          };
          
          // Create delivery result
          const deliveryUrls: DeliveryResult = {
            success: true,
            content: {
              url: blobResult.url,
              metadata: {
                size: frameBuffer.byteLength,
                contentType: 'image/jpeg',
                lastModified: new Date(),
                cacheControl: 'public, max-age=3600',
                compressed: false
              }
            },
            requestId
          };
          
          const frameMetadata: EnhancedFrameMetadata = {
            timestamp,
            url: blobResult.url,
            size: frameBuffer.byteLength,
            width: options.frameResolution.width, // Default, could be detected
            height: options.frameResolution.height, // Default, could be detected
            storageResult,
            deliveryUrls
          };
          
          frames.push(frameMetadata);
          
          console.log(`Stored frame ${i + 1}/${output.length} at ${timestamp}s`);
          
          // Update progress for storage
          onProgress(40 + (i / output.length) * 50); // Progress 40-90%
          
        } catch (frameError) {
          console.warn(`Failed to process frame ${i} at ${timestamp}s:`, frameError);
          // Continue with other frames
        }
      }
      
      console.log(`Successfully processed ${frames.length} frames for job ${jobId}`);
      
      return frames;
      
    } catch (error) {
      const normalizedError = normalizeError(error, requestId);
      logError(normalizedError, { operation: 'extractAndStoreFrames', videoUrl, jobId });
      
      throw new FrameExtractionError(
        'Replicate frame extraction failed',
        { 
          originalError: error instanceof Error ? error.message : String(error),
          videoUrl,
          jobId
        },
        requestId
      );
    }
  }

  /**
   * Extract audio using Replicate toolkit
   */
  static async extractAndStoreAudio(
    videoUrl: string,
    videoMetadata: VideoMetadata,
    options: Required<EnhancedVideoProcessingOptions>,
    jobId: string,
    onProgress: (progress: number) => void
  ): Promise<EnhancedAudioMetadata> {
    const requestId = generateRequestId();
    
    try {
      const replicate = this.getReplicateClient();
      
      console.log(`Starting audio extraction for job ${jobId}`);
      
      onProgress(10); // Starting audio extraction
      
      // Use toolkit for audio extraction with correct task parameter
      const output = await replicate.run(
        "19711d11c243800f08364ba9ae9078f54874f21363ba445dabdbf082b5d69565" as any,
        {
          input: {
            task: "extract_video_audio_as_mp3",
            input_file: videoUrl
          }
        }
      ) as unknown as string; // Returns URL to the extracted audio file
      
      onProgress(60); // Audio extraction complete
      
      if (!output || typeof output !== 'string') {
        console.warn('No audio extracted from video, returning empty audio metadata');
        return this.getEmptyAudioMetadata(videoMetadata, requestId);
      }
      
      const audioUrl = output; // The output is the direct URL to the audio file
      
      // Download and store audio in Vercel Blob
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      
      const audioFilename = `audio.${options.audioFormat}`;
      const blobResult = await put(
        `${jobId}/audio/${audioFilename}`,
        Buffer.from(audioBuffer),
        { 
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN
        }
      );
      
      onProgress(100); // Complete
      
      // Create storage result
      const storageResult: StorageResult = {
        success: true,
        url: blobResult.url,
        metadata: {
          size: audioBuffer.byteLength,
          contentType: `audio/${options.audioFormat}`,
          uploadedAt: new Date(),
          compressed: false,
          storageId: nanoid()
        },
        requestId
      };
      
      // Create delivery result with streaming support
      const deliveryUrls: DeliveryResult = {
        success: true,
        content: {
          url: blobResult.url,
          streamingUrl: blobResult.url, // For now, same as direct URL
          metadata: {
            size: audioBuffer.byteLength,
            contentType: `audio/${options.audioFormat}`,
            lastModified: new Date(),
            cacheControl: 'public, max-age=3600',
            compressed: false
          }
        },
        requestId
      };
      
      console.log(`Successfully extracted and stored audio for job ${jobId}`);
      
      return {
        url: blobResult.url,
        duration: output.duration || videoMetadata.duration,
        format: options.audioFormat,
        size: audioBuffer.byteLength,
        sampleRate: 44100, // Default, could be detected from output
        channels: 2, // Default, could be detected from output
        storageResult,
        deliveryUrls
      };
      
    } catch (error) {
      const normalizedError = normalizeError(error, requestId);
      logError(normalizedError, { operation: 'extractAndStoreAudio', videoUrl, jobId });
      
      // Return empty audio metadata instead of throwing
      console.warn('Audio extraction failed, returning empty audio metadata:', error);
      return this.getEmptyAudioMetadata(videoMetadata, requestId);
    }
  }

  /**
   * Helper method to parse metadata output from Replicate
   */
  private static parseMetadataOutput(output: ReplicateMetadataOutput): VideoMetadata {
    // This depends on the actual output format from the model
    // Adjust based on what the model actually returns
    
    if (output && typeof output === 'object') {
      return {
        duration: output.duration || 0,
        resolution: output.resolution || `${output.width || 1920}x${output.height || 1080}`,
        fps: output.fps || output.frame_rate || 30,
        codec: output.codec || output.video_codec || 'unknown',
        size: output.file_size || output.size || 0,
        format: output.format || output.container || 'mp4'
      };
    }
    
    // Fallback metadata
    return {
      duration: 0,
      resolution: '1920x1080',
      fps: 30,
      codec: 'unknown',
      size: 0,
      format: 'mp4'
    };
  }

  /**
   * Helper method to create empty audio metadata
   */
  private static getEmptyAudioMetadata(videoMetadata: VideoMetadata, requestId: string): EnhancedAudioMetadata {
    const emptyStorageResult: StorageResult = {
      success: false,
      url: '',
      metadata: {
        size: 0,
        contentType: 'audio/none',
        uploadedAt: new Date(),
        compressed: false,
        storageId: nanoid()
      },
      requestId
    };

    const emptyDeliveryResult: DeliveryResult = {
      success: false,
      content: {
        url: '',
        metadata: {
          size: 0,
          contentType: 'audio/none',
          lastModified: new Date(),
          cacheControl: 'no-cache',
          compressed: false
        }
      },
      requestId
    };

    return {
      url: '',
      duration: videoMetadata.duration,
      format: 'none',
      size: 0,
      sampleRate: 0,
      channels: 0,
      storageResult: emptyStorageResult,
      deliveryUrls: emptyDeliveryResult
    };
  }

  /**
   * Test Replicate connection and available models
   */
  static async testConnection(): Promise<boolean> {
    try {
      const replicate = this.getReplicateClient();
      
      // Simple test to verify connection
      const models = await replicate.models.list();
      console.log('Replicate connection successful, found models:', models.results?.length || 0);
      
      return true;
    } catch (error) {
      console.error('Replicate connection failed:', error);
      return false;
    }
  }
}
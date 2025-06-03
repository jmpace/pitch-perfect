// Enhanced Video Processor with Storage and Delivery Integration
import { nanoid } from 'nanoid';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  StorageDeliveryManager, 
  ContentType, 
  StorageResult,
  DeliveryResult 
} from './storage-delivery-manager';
import { 
  VideoProcessingError,
  VideoFormatError,
  VideoCorruptedError,
  FrameExtractionError,
  AudioExtractionError,
  ProcessingJobNotFoundError
} from './errors/types';
import { generateRequestId, logError, normalizeError } from './errors/handlers';
import { VisionAnalysisService, FrameAnalysisResult, AnalysisType } from './vision-analysis';

// Configure FFmpeg paths based on environment
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/homebrew/bin/ffprobe';

try {
  ffmpeg.setFfmpegPath(FFMPEG_PATH);
  ffmpeg.setFfprobePath(FFPROBE_PATH);
} catch (error) {
  console.warn('FFmpeg configuration failed, using system defaults:', error);
}

// Enhanced interfaces with storage integration
export interface EnhancedVideoProcessingJob {
  id: string;
  videoUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: EnhancedProcessingResults;
  requestId: string;
  storageConfig?: {
    enableCompression: boolean;
    enableCDN: boolean;
    generateSignedUrls: boolean;
    storageRetention: number;
  };
}

export interface EnhancedProcessingResults {
  frames: EnhancedFrameMetadata[];
  audio: EnhancedAudioMetadata;
  videoMetadata: VideoMetadata;
  processingStats: ProcessingStats;
  storage: {
    totalSize: number;
    compressionRatio: number;
    storageLocations: StorageLocation[];
    deliveryUrls: DeliveryUrls;
  };
}

export interface EnhancedFrameMetadata {
  timestamp: number;
  url: string;
  size: number;
  width: number;
  height: number;
  storageResult: StorageResult;
  deliveryUrls: DeliveryResult;
  visualAnalysis?: FrameAnalysisResult;
}

export interface EnhancedAudioMetadata {
  url: string;
  duration: number;
  format: string;
  size: number;
  sampleRate: number;
  channels: number;
  storageResult: StorageResult;
  deliveryUrls: DeliveryResult;
}

export interface VideoMetadata {
  duration: number;
  resolution: string;
  fps: number;
  codec: string;
  size: number;
  format: string;
}

export interface ProcessingStats {
  processingTime: number;
  memoryUsed: number;
  framesExtracted: number;
  audioExtracted: boolean;
  storageTime: number;
  compressionTime: number;
}

export interface StorageLocation {
  type: string;
  url: string;
  size: number;
}

export interface DeliveryUrls {
  direct: string;
  cdn?: string;
  signed?: string;
  streaming?: string;
}

export interface EnhancedVideoProcessingOptions {
  frameInterval?: number;
  frameQuality?: number;
  frameResolution?: { width: number; height: number };
  audioFormat?: 'mp3' | 'wav';
  audioQuality?: number;
  extractAudio?: boolean;
  timeout?: number;
  enableCompression?: boolean;
  enableCDN?: boolean;
  generateSignedUrls?: boolean;
  storageRetention?: number;
  visualAnalysis?: {
    enabled: boolean;
    analysisType: AnalysisType;
    context?: {
      presentationTitle?: string;
      targetAudience?: string;
      analysisGoals?: string[];
    };
  };
}

// In-memory job storage (production should use Redis/database)
const processingJobs = new Map<string, EnhancedVideoProcessingJob>();

export class EnhancedVideoProcessor {
  private static readonly DEFAULT_OPTIONS: Required<EnhancedVideoProcessingOptions> = {
    frameInterval: 10,
    frameQuality: 85,
    frameResolution: { width: 1280, height: 720 },
    audioFormat: 'mp3',
    audioQuality: 128,
    extractAudio: true,
    timeout: 900000, // 15 minutes
    enableCompression: true,
    enableCDN: false,
    generateSignedUrls: true,
    storageRetention: 2592000000, // 30 days
    visualAnalysis: {
      enabled: true,
      analysisType: 'slide_content',
      context: {}
    }
  };

  private static readonly MAX_CONCURRENT_JOBS = 3;
  private static currentJobs = 0;

  /**
   * Start enhanced video processing with storage and delivery integration
   */
  static async startProcessing(
    videoUrl: string,
    options: EnhancedVideoProcessingOptions = {}
  ): Promise<EnhancedVideoProcessingJob> {
    const requestId = generateRequestId();
    const jobId = nanoid();
    
    // Check concurrent job limit
    if (this.currentJobs >= this.MAX_CONCURRENT_JOBS) {
      throw new VideoProcessingError(
        'Maximum concurrent processing jobs reached',
        { limit: this.MAX_CONCURRENT_JOBS, current: this.currentJobs },
        requestId
      );
    }

    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };

    const job: EnhancedVideoProcessingJob = {
      id: jobId,
      videoUrl,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      requestId,
      storageConfig: {
        enableCompression: mergedOptions.enableCompression,
        enableCDN: mergedOptions.enableCDN,
        generateSignedUrls: mergedOptions.generateSignedUrls,
        storageRetention: mergedOptions.storageRetention
      }
    };

    // Store job in memory
    processingJobs.set(jobId, job);
    this.currentJobs++;

    // Start processing asynchronously
    this.processVideo(jobId, mergedOptions).catch(error => {
      this.handleProcessingError(jobId, error);
    });

    return job;
  }

  /**
   * Get enhanced job status and details
   */
  static async getJob(jobId: string): Promise<EnhancedVideoProcessingJob | null> {
    return processingJobs.get(jobId) || null;
  }

  /**
   * Get all enhanced jobs
   */
  static async getJobs(status?: EnhancedVideoProcessingJob['status']): Promise<EnhancedVideoProcessingJob[]> {
    let jobs = Array.from(processingJobs.values());
    
    if (status) {
      jobs = jobs.filter(job => job.status === status);
    }

    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Main enhanced video processing pipeline
   */
  private static async processVideo(
    jobId: string,
    options: Required<EnhancedVideoProcessingOptions>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.updateJobStatus(jobId, 'processing', { startedAt: new Date() });

      // Step 1: Extract video metadata (0-10% progress)
      this.updateJobProgress(jobId, 5);
      const videoMetadata = await this.extractVideoMetadata(processingJobs.get(jobId)!.videoUrl);
      this.updateJobProgress(jobId, 10);

      // Step 2: Extract and store frames (10-60% progress)
      const frames = await this.extractAndStoreFrames(
        processingJobs.get(jobId)!.videoUrl,
        videoMetadata,
        options,
        jobId,
        (progress) => this.updateJobProgress(jobId, 10 + progress * 50)
      );

      this.updateJobProgress(jobId, 60);

      // Step 3: Extract and store audio (60-80% progress)
      let audio: EnhancedAudioMetadata | null = null;
      if (options.extractAudio) {
        audio = await this.extractAndStoreAudio(
          processingJobs.get(jobId)!.videoUrl,
          videoMetadata,
          options,
          jobId,
          (progress) => this.updateJobProgress(jobId, 60 + progress * 20)
        );
      }

      this.updateJobProgress(jobId, 80);

      // Step 4: Visual analysis (if enabled) (80-95% progress)
      if (options.visualAnalysis.enabled && frames.length > 0) {
        await this.performVisualAnalysis(frames, options.visualAnalysis, jobId);
      }

      this.updateJobProgress(jobId, 95);

      // Step 5: Generate storage locations and delivery URLs
      const storageLocations = this.generateStorageLocations(frames, audio);
      const deliveryUrls = this.generateDeliveryUrls(frames, audio);

      // Finalize results
      const processingTime = Date.now() - startTime;
      const results: EnhancedProcessingResults = {
        frames,
        audio: audio || {
          url: '',
          duration: videoMetadata.duration,
          format: 'none',
          size: 0,
          sampleRate: 0,
          channels: 0,
          storageResult: { success: false, url: '', metadata: { size: 0, contentType: 'audio/none', uploadedAt: new Date(), compressed: false, storageId: '' }, requestId: generateRequestId() },
          deliveryUrls: { direct: '' }
        },
        videoMetadata,
        processingStats: {
          processingTime,
          memoryUsed: process.memoryUsage().heapUsed,
          framesExtracted: frames.length,
          audioExtracted: !!audio,
          storageTime: 0, // Would be tracked in real implementation
          compressionTime: 0 // Would be tracked in real implementation
        },
        storage: {
          totalSize: this.calculateTotalSize(frames, audio),
          compressionRatio: this.calculateCompressionRatio(frames, audio),
          storageLocations,
          deliveryUrls
        }
      };

      this.updateJobStatus(jobId, 'completed', { 
        completedAt: new Date(), 
        results 
      });

    } catch (error) {
      this.handleProcessingError(jobId, error);
    } finally {
      this.currentJobs--;
    }
  }

  /**
   * Extract frames and store with enhanced storage
   */
  private static async extractAndStoreFrames(
    videoUrl: string,
    videoMetadata: VideoMetadata,
    options: Required<EnhancedVideoProcessingOptions>,
    jobId: string,
    onProgress: (progress: number) => void
  ): Promise<EnhancedFrameMetadata[]> {
    const frames: EnhancedFrameMetadata[] = [];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-frames-'));

    try {
      return new Promise<EnhancedFrameMetadata[]>((resolve, reject) => {
        const command = ffmpeg(videoUrl)
          .outputOptions([
            `-vf fps=1/${options.frameInterval},scale=${options.frameResolution.width}:${options.frameResolution.height}`,
            '-q:v 2'
          ])
          .output(path.join(tempDir, 'frame_%d.jpg'))
          .on('start', (commandLine) => {
            console.log(`Starting enhanced frame extraction for job ${jobId}: ${commandLine}`);
          })
          .on('progress', (progress) => {
            const extractionProgress = Math.min(progress.percent || 0, 100) / 100;
            onProgress(extractionProgress * 0.6); // 60% for extraction
          })
          .on('end', async () => {
            try {
              const frameFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.jpg')).sort();
              console.log(`Extracted ${frameFiles.length} frames for job ${jobId}`);

              // Upload frames to storage with enhanced features
              for (let i = 0; i < frameFiles.length; i++) {
                const frameFile = frameFiles[i];
                const framePath = path.join(tempDir, frameFile);
                const frameBuffer = fs.readFileSync(framePath);
                const timestamp = (i + 1) * options.frameInterval;

                // Store frame with enhanced storage
                const storageResult = await StorageDeliveryManager.storeContent(
                  ContentType.FRAME,
                  jobId,
                  `frame_${timestamp}s.jpg`,
                  frameBuffer,
                  {
                    metadata: { 
                      timestamp, 
                      jobId, 
                      frameIndex: i,
                      extractionTime: new Date().toISOString()
                    },
                    compress: options.enableCompression
                  }
                );

                // Generate delivery URLs
                const deliveryUrls = await StorageDeliveryManager.generateDeliveryUrls(
                  storageResult.url,
                  {
                    includeSignedUrl: options.generateSignedUrls,
                    streaming: false,
                    quality: 'high'
                  }
                );

                const frameMetadata: EnhancedFrameMetadata = {
                  timestamp,
                  url: storageResult.url,
                  size: frameBuffer.length,
                  width: options.frameResolution.width,
                  height: options.frameResolution.height,
                  storageResult,
                  deliveryUrls
                };

                frames.push(frameMetadata);

                // Update progress for storage
                onProgress(0.6 + (i / frameFiles.length) * 0.4); // Remaining 40%
              }

              resolve(frames);
            } catch (error) {
              reject(new FrameExtractionError(
                'Failed to process extracted frames',
                { originalError: error instanceof Error ? error.message : 'Unknown error' },
                generateRequestId()
              ));
            }
          })
          .on('error', (error) => {
            reject(new FrameExtractionError(
              'FFmpeg frame extraction failed',
              { originalError: error.message },
              generateRequestId()
            ));
          });

        command.run();
      });

    } finally {
      // Cleanup temporary directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
      }
    }
  }

  /**
   * Extract audio and store with enhanced storage
   */
  private static async extractAndStoreAudio(
    videoUrl: string,
    videoMetadata: VideoMetadata,
    options: Required<EnhancedVideoProcessingOptions>,
    jobId: string,
    onProgress: (progress: number) => void
  ): Promise<EnhancedAudioMetadata> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-audio-'));
    const audioExtension = options.audioFormat === 'mp3' ? '.mp3' : '.wav';
    const audioFilename = `audio${audioExtension}`;
    const tempAudioPath = path.join(tempDir, audioFilename);

    try {
      return new Promise<EnhancedAudioMetadata>((resolve, reject) => {
        // First check if video has audio streams
        ffmpeg.ffprobe(videoUrl, async (err, metadata) => {
          if (err) {
            reject(new AudioExtractionError('Failed to probe video metadata', { originalError: err.message }, generateRequestId()));
            return;
          }

          const audioStream = metadata.streams?.find(stream => stream.codec_type === 'audio');
          if (!audioStream) {
            // No audio stream, return empty audio metadata
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
              requestId: generateRequestId()
            };

            resolve({
              url: '',
              duration: videoMetadata.duration,
              format: 'none',
              size: 0,
              sampleRate: 0,
              channels: 0,
              storageResult: emptyStorageResult,
              deliveryUrls: { direct: '' }
            });
            return;
          }

          // Extract audio
          const command = ffmpeg(videoUrl)
            .outputOptions([
              '-vn', // No video
              '-acodec', options.audioFormat === 'mp3' ? 'libmp3lame' : 'pcm_s16le',
              '-ab', `${options.audioQuality}k`,
              '-ar', '44100'
            ])
            .output(tempAudioPath)
            .on('start', () => {
              console.log(`Starting enhanced audio extraction for job ${jobId}`);
            })
            .on('progress', (progress) => {
              const extractionProgress = Math.min(progress.percent || 0, 100) / 100;
              onProgress(extractionProgress * 0.7); // 70% for extraction
            })
            .on('end', async () => {
              try {
                const audioBuffer = fs.readFileSync(tempAudioPath);
                const audioStats = fs.statSync(tempAudioPath);

                // Store audio with enhanced storage
                const storageResult = await StorageDeliveryManager.storeContent(
                  ContentType.AUDIO,
                  jobId,
                  audioFilename,
                  audioBuffer,
                  {
                    metadata: { 
                      jobId,
                      format: options.audioFormat,
                      quality: options.audioQuality,
                      extractionTime: new Date().toISOString()
                    },
                    compress: options.enableCompression
                  }
                );

                // Generate delivery URLs
                const deliveryUrls = await StorageDeliveryManager.generateDeliveryUrls(
                  storageResult.url,
                  {
                    includeSignedUrl: options.generateSignedUrls,
                    streaming: true,
                    quality: 'high'
                  }
                );

                onProgress(1.0); // Complete

                resolve({
                  url: storageResult.url,
                  duration: videoMetadata.duration,
                  format: options.audioFormat,
                  size: audioStats.size,
                  sampleRate: audioStream.sample_rate || 44100,
                  channels: audioStream.channels || 2,
                  storageResult,
                  deliveryUrls
                });
              } catch (error) {
                reject(new AudioExtractionError(
                  'Failed to process extracted audio',
                  { originalError: error instanceof Error ? error.message : 'Unknown error' },
                  generateRequestId()
                ));
              }
            })
            .on('error', (error) => {
              reject(new AudioExtractionError(
                'FFmpeg audio extraction failed',
                { originalError: error.message },
                generateRequestId()
              ));
            });

          command.run();
        });
      });

    } finally {
      // Cleanup temporary directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
      }
    }
  }

  /**
   * Perform visual analysis on extracted frames
   */
  private static async performVisualAnalysis(
    frames: EnhancedFrameMetadata[],
    visualAnalysisOptions: Required<EnhancedVideoProcessingOptions>['visualAnalysis'],
    jobId: string
  ): Promise<void> {
    if (!visualAnalysisOptions.enabled || frames.length === 0) {
      return;
    }

    try {
      // Analyze frames in batches to respect rate limits
      const batchSize = 5; // Conservative batch size for GPT-4V
      const batches = [];
      
      for (let i = 0; i < frames.length; i += batchSize) {
        batches.push(frames.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        try {
          const batchAnalysisRequests = batch.map(frame => ({
            frameUrl: frame.url,
            timestamp: frame.timestamp,
            analysisType: visualAnalysisOptions.analysisType,
            context: visualAnalysisOptions.context
          }));

          // Use batch analysis from VisionAnalysisService
          const batchResults = await VisionAnalysisService.analyzeBatch({
            frames: batchAnalysisRequests,
            analysisType: visualAnalysisOptions.analysisType,
            context: visualAnalysisOptions.context
          });

          // Attach results to frame metadata
          batchResults.results.forEach((result, index) => {
            const frameIndex = batch[index];
            if (frameIndex) {
              frameIndex.visualAnalysis = result;
            }
          });

        } catch (error) {
          console.warn(`Failed to analyze batch of frames for job ${jobId}:`, error);
          // Continue with other batches even if one fails
        }
      }

    } catch (error) {
      console.warn(`Visual analysis failed for job ${jobId}:`, error);
      // Don't fail the entire job if visual analysis fails
    }
  }

  // Helper methods

  private static async extractVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        if (err) {
          reject(new VideoProcessingError('Failed to extract video metadata', { originalError: err.message }, generateRequestId()));
          return;
        }

        const videoStream = metadata.streams?.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          reject(new VideoFormatError('No video stream found in file', {}, generateRequestId()));
          return;
        }

        resolve({
          duration: metadata.format?.duration || 0,
          resolution: `${videoStream.width}x${videoStream.height}`,
          fps: this.parseFrameRate(videoStream.r_frame_rate || '25/1'),
          codec: videoStream.codec_name || 'unknown',
          size: metadata.format?.size || 0,
          format: metadata.format?.format_name || 'unknown'
        });
      });
    });
  }

  private static parseFrameRate(frameRate: string): number {
    try {
      const parts = frameRate.split('/');
      if (parts.length === 2) {
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
      return parseFloat(frameRate);
    } catch {
      return 30; // Default fallback
    }
  }

  private static generateStorageLocations(frames: EnhancedFrameMetadata[], audio: EnhancedAudioMetadata | null): StorageLocation[] {
    const locations: StorageLocation[] = [];
    
    frames.forEach(frame => {
      locations.push({
        type: 'frame',
        url: frame.url,
        size: frame.size
      });
    });

    if (audio && audio.url) {
      locations.push({
        type: 'audio',
        url: audio.url,
        size: audio.size
      });
    }

    return locations;
  }

  private static generateDeliveryUrls(frames: EnhancedFrameMetadata[], audio: EnhancedAudioMetadata | null): DeliveryUrls {
    return {
      direct: frames.length > 0 ? frames[0].url : '',
      cdn: undefined, // Would be implemented with CDN integration
      signed: frames.length > 0 ? frames[0].deliveryUrls.signed : undefined,
      streaming: audio?.deliveryUrls.streaming
    };
  }

  private static calculateTotalSize(frames: EnhancedFrameMetadata[], audio: EnhancedAudioMetadata | null): number {
    let total = frames.reduce((sum, frame) => sum + frame.size, 0);
    if (audio) {
      total += audio.size;
    }
    return total;
  }

  private static calculateCompressionRatio(frames: EnhancedFrameMetadata[], audio: EnhancedAudioMetadata | null): number {
    // This would calculate actual compression ratio based on original vs compressed sizes
    // For now, return a default value
    return 0.8; // 80% of original size
  }

  private static updateJobStatus(
    jobId: string,
    status: EnhancedVideoProcessingJob['status'],
    updates: Partial<EnhancedVideoProcessingJob> = {}
  ): void {
    const job = processingJobs.get(jobId);
    if (job) {
      Object.assign(job, { status, ...updates });
      processingJobs.set(jobId, job);
    }
  }

  private static updateJobProgress(jobId: string, progress: number): void {
    const job = processingJobs.get(jobId);
    if (job) {
      job.progress = Math.min(progress, 100);
      processingJobs.set(jobId, job);
    }
  }

  private static handleProcessingError(jobId: string, error: unknown): void {
    console.error(`Enhanced video processing error for job ${jobId}:`, error);
    
    const job = processingJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown processing error';
      job.completedAt = new Date();
      processingJobs.set(jobId, job);
    }
    
    this.currentJobs = Math.max(0, this.currentJobs - 1);
  }

  /**
   * Clean up old jobs
   */
  static async cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;
    
    for (const [jobId, job] of processingJobs.entries()) {
      if (job.createdAt < cutoff && (job.status === 'completed' || job.status === 'failed')) {
        processingJobs.delete(jobId);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Get processing statistics
   */
  static async getStats(): Promise<{
    totalJobs: number;
    byStatus: Record<EnhancedVideoProcessingJob['status'], number>;
    currentJobs: number;
    maxConcurrent: number;
  }> {
    const jobs = Array.from(processingJobs.values());
    const byStatus = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    jobs.forEach(job => {
      byStatus[job.status]++;
    });
    
    return {
      totalJobs: jobs.length,
      byStatus,
      currentJobs: this.currentJobs,
      maxConcurrent: this.MAX_CONCURRENT_JOBS
    };
  }
} 
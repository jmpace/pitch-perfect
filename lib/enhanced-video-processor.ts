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

// Configure FFmpeg paths
ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg');
ffmpeg.setFfprobePath('/opt/homebrew/bin/ffprobe');

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
  signedUrl?: string;
  streamingUrl?: string;
  size: number;
  width: number;
  height: number;
  compressed: boolean;
  storageId: string;
  alternatives?: { quality: string; url: string; size: number }[];
  analysis?: FrameAnalysisResult;
}

export interface EnhancedAudioMetadata {
  url: string;
  signedUrl?: string;
  duration: number;
  format: string;
  size: number;
  sampleRate: number;
  channels: number;
  compressed: boolean;
  storageId: string;
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
  contentType: ContentType;
  count: number;
  totalSize: number;
  compressed: boolean;
}

export interface DeliveryUrls {
  allFrames: string;
  audio: string;
  metadata: string;
  batch: string;
}

export interface EnhancedVideoProcessingOptions {
  frameInterval?: number;
  frameQuality?: number;
  frameResolution?: { width: number; height: number };
  audioFormat?: 'mp3' | 'wav';
  audioQuality?: number;
  extractAudio?: boolean;
  timeout?: number;
  storageOptions?: {
    enableCompression?: boolean;
    enableCDN?: boolean;
    generateSignedUrls?: boolean;
    enableStreaming?: boolean;
    retentionHours?: number;
  };
  visualAnalysis?: {
    enabled?: boolean;
    analysisType?: AnalysisType;
    context?: {
      presentationTitle?: string;
      targetAudience?: string;
      analysisGoals?: string[];
    };
  };
}

// In-memory job storage (production should use Redis/database)
const enhancedProcessingJobs = new Map<string, EnhancedVideoProcessingJob>();

export class EnhancedVideoProcessor {
  private static readonly DEFAULT_OPTIONS: Required<EnhancedVideoProcessingOptions> = {
    frameInterval: 10,
    frameQuality: 85,
    frameResolution: { width: 1280, height: 720 },
    audioFormat: 'mp3',
    audioQuality: 128,
    extractAudio: true,
    timeout: 900000, // 15 minutes
    storageOptions: {
      enableCompression: true,
      enableCDN: true,
      generateSignedUrls: true,
      enableStreaming: false,
      retentionHours: 24
    },
    visualAnalysis: {
      enabled: false,
      analysisType: 'slide_content',
      context: {}
    }
  };

  private static readonly MAX_CONCURRENT_JOBS = 3;
  private static currentJobs = 0;

  /**
   * Initialize enhanced video processor with storage configuration
   */
  static initialize(storageConfig: any = {}): void {
    StorageDeliveryManager.initialize(storageConfig);
    console.log('EnhancedVideoProcessor initialized with storage integration');
  }

  /**
   * Start enhanced video processing with optimized storage
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

    const config = { ...this.DEFAULT_OPTIONS, ...options };

    const job: EnhancedVideoProcessingJob = {
      id: jobId,
      videoUrl,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      requestId,
      storageConfig: {
        enableCompression: config.storageOptions.enableCompression || false,
        enableCDN: config.storageOptions.enableCDN || false,
        generateSignedUrls: config.storageOptions.generateSignedUrls || false,
        storageRetention: (config.storageOptions.retentionHours || 24) * 60 * 60 * 1000
      }
    };

    enhancedProcessingJobs.set(jobId, job);

    // Start processing asynchronously
    this.processVideoEnhanced(jobId, config)
      .catch(error => {
        this.handleProcessingError(jobId, error);
      });

    return job;
  }

  /**
   * Get job status and details
   */
  static getJob(jobId: string): EnhancedVideoProcessingJob | undefined {
    return enhancedProcessingJobs.get(jobId);
  }

  /**
   * Get all jobs (optionally filtered by status)
   */
  static getJobs(status?: EnhancedVideoProcessingJob['status']): EnhancedVideoProcessingJob[] {
    const jobs = Array.from(enhancedProcessingJobs.values());
    return status ? jobs.filter(job => job.status === status) : jobs;
  }

  /**
   * Get delivery URLs for processed content
   */
  static async getContentDelivery(
    jobId: string,
    options: { 
      includeSignedUrls?: boolean;
      enableStreaming?: boolean;
      quality?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<{ frames: DeliveryResult[]; audio: DeliveryResult; success: boolean; error?: string }> {
    const job = this.getJob(jobId);
    
    if (!job || !job.results) {
      return {
        success: false,
        error: 'Job not found or not completed',
        frames: [],
        audio: {
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
          requestId: job?.requestId || ''
        }
      };
    }

    try {
      // Get optimized delivery for frames
      const frameDeliveryPromises = job.results.frames.map(frame =>
        StorageDeliveryManager.retrieveContent(frame.url, {
          includeSignedUrl: options.includeSignedUrls,
          streaming: options.enableStreaming,
          quality: options.quality
        })
      );

      const frameDeliveries = await Promise.all(frameDeliveryPromises);

      // Get optimized delivery for audio
      const audioDelivery = await StorageDeliveryManager.retrieveContent(job.results.audio.url, {
        includeSignedUrl: options.includeSignedUrls,
        streaming: options.enableStreaming
      });

      return {
        success: true,
        frames: frameDeliveries,
        audio: audioDelivery
      };

    } catch (error) {
      return {
        success: false,
        error: normalizeError(error, job.requestId).message,
        frames: [],
        audio: {
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
          requestId: job.requestId
        }
      };
    }
  }

  /**
   * Main enhanced video processing pipeline
   */
  private static async processVideoEnhanced(
    jobId: string,
    options: Required<EnhancedVideoProcessingOptions>
  ): Promise<void> {
    const job = enhancedProcessingJobs.get(jobId);
    if (!job) {
      throw new ProcessingJobNotFoundError(`Job ${jobId} not found`);
    }

    const startTime = Date.now();

    try {
      this.currentJobs++;
      this.updateJobStatus(jobId, 'processing', { startedAt: new Date() });

      // Step 1: Validate video and extract metadata (5% progress)
      const videoMetadata = await this.extractVideoMetadata(job.videoUrl);
      this.updateJobProgress(jobId, 5);

      // Step 2: Extract and store frames with enhanced storage (60% progress total)
      const frames = await this.extractAndStoreFrames(
        job.videoUrl,
        videoMetadata,
        options,
        jobId,
        (progress) => this.updateJobProgress(jobId, 5 + (progress * 0.55))
      );

      // Step 3: Extract and store audio if requested (85% progress total)
      let audio: EnhancedAudioMetadata | undefined;
      if (options.extractAudio) {
        audio = await this.extractAndStoreAudio(
          job.videoUrl,
          videoMetadata,
          options,
          jobId,
          (progress) => this.updateJobProgress(jobId, 60 + (progress * 0.25))
        );
      } else {
        audio = this.getEmptyAudioMetadata();
        this.updateJobProgress(jobId, 85);
      }

      // Step 4: Generate delivery URLs and metadata (100% progress)
      const deliveryUrls = this.generateDeliveryUrls(jobId);
      const storageLocations = this.calculateStorageLocations(frames, audio);
      
      this.updateJobProgress(jobId, 100);

      // Finalize results
      const processingTime = Date.now() - startTime;
      const results: EnhancedProcessingResults = {
        frames,
        audio,
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

              // Process and store each frame
              for (let i = 0; i < frameFiles.length; i++) {
                const frameFile = frameFiles[i];
                const framePath = path.join(tempDir, frameFile);
                const timestamp = i * options.frameInterval;
                
                // Read frame file
                const frameBuffer = fs.readFileSync(framePath);
                
                // Store frame with enhanced storage
                const storageResult = await StorageDeliveryManager.storeContent(
                  ContentType.FRAMES,
                  jobId,
                  `frame_${timestamp}s.jpg`,
                  frameBuffer,
                  {
                    compress: options.storageOptions.enableCompression,
                    metadata: {
                      timestamp,
                      resolution: `${options.frameResolution.width}x${options.frameResolution.height}`,
                      jobId
                    }
                  }
                );

                if (storageResult.success) {
                  const frameMetadata: EnhancedFrameMetadata = {
                    timestamp,
                    url: storageResult.url,
                    signedUrl: storageResult.signedUrl,
                    size: storageResult.metadata.size,
                    width: options.frameResolution.width,
                    height: options.frameResolution.height,
                    compressed: storageResult.metadata.compressed,
                    storageId: storageResult.metadata.storageId
                  };

                  // Add visual analysis if enabled
                  if (options.visualAnalysis.enabled && storageResult.url) {
                    try {
                      const analysisResult = await VisionAnalysisService.analyzeFrame({
                        frameUrl: storageResult.url,
                        timestamp,
                        analysisType: options.visualAnalysis.analysisType || 'slide_content',
                        context: options.visualAnalysis.context
                      });
                      frameMetadata.analysis = analysisResult;
                      console.log(`Visual analysis completed for frame at ${timestamp}s`);
                    } catch (analysisError) {
                      console.warn(`Visual analysis failed for frame at ${timestamp}s:`, analysisError);
                      // Continue without analysis - don't fail the entire process
                    }
                  }

                  frames.push(frameMetadata);
                }

                // Update progress for storage operations (40% for storage)
                const storageProgress = 0.6 + ((i + 1) / frameFiles.length) * 0.4;
                onProgress(storageProgress);
              }

              resolve(frames);

            } catch (error) {
              reject(new FrameExtractionError(
                'Failed to process extracted frames',
                { originalError: error instanceof Error ? error.message : String(error) },
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

          const audioStreams = metadata.streams?.filter(stream => stream.codec_type === 'audio') || [];
          
          if (audioStreams.length === 0) {
            // Return empty audio metadata if no audio streams
            resolve(this.getEmptyAudioMetadata());
            return;
          }

          // Configure audio extraction based on format
          const command = ffmpeg(videoUrl);
          
          if (options.audioFormat === 'mp3') {
            command
              .audioCodec('libmp3lame')
              .audioBitrate(options.audioQuality)
              .audioChannels(2);
          } else {
            command
              .audioCodec('pcm_s16le')
              .audioFrequency(44100)
              .audioChannels(2);
          }

          command
            .noVideo()
            .output(tempAudioPath)
            .on('start', (commandLine) => {
              console.log(`Starting enhanced audio extraction for job ${jobId}: ${commandLine}`);
            })
            .on('progress', (progress) => {
              const extractionProgress = Math.min(progress.percent || 0, 100) / 100;
              onProgress(extractionProgress * 0.7); // 70% for extraction
            })
            .on('end', async () => {
              try {
                // Read audio file
                const audioBuffer = fs.readFileSync(tempAudioPath);
                
                // Store audio with enhanced storage
                const storageResult = await StorageDeliveryManager.storeContent(
                  ContentType.AUDIO,
                  jobId,
                  audioFilename,
                  audioBuffer,
                  {
                    compress: options.storageOptions.enableCompression,
                    metadata: {
                      format: options.audioFormat,
                      quality: options.audioQuality,
                      jobId
                    }
                  }
                );

                if (storageResult.success) {
                  // Get audio metadata using ffprobe
                  ffmpeg.ffprobe(tempAudioPath, (probeErr, audioMetadata) => {
                    const duration = audioMetadata?.format?.duration || 0;
                    const sampleRate = audioStreams[0]?.sample_rate || 44100;
                    const channels = audioStreams[0]?.channels || 2;

                    const enhancedAudioMetadata: EnhancedAudioMetadata = {
                      url: storageResult.url,
                      signedUrl: storageResult.signedUrl,
                      duration,
                      format: options.audioFormat,
                      size: storageResult.metadata.size,
                      sampleRate,
                      channels,
                      compressed: storageResult.metadata.compressed,
                      storageId: storageResult.metadata.storageId
                    };

                    onProgress(1.0); // Complete
                    resolve(enhancedAudioMetadata);
                  });
                } else {
                  reject(new AudioExtractionError('Failed to store audio', { storageError: storageResult.error }, generateRequestId()));
                }

              } catch (error) {
                reject(new AudioExtractionError(
                  'Failed to process extracted audio',
                  { originalError: error instanceof Error ? error.message : String(error) },
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
    const [num, den] = frameRate.split('/').map(Number);
    return den ? num / den : num || 25;
  }

  private static getEmptyAudioMetadata(): EnhancedAudioMetadata {
    return {
      url: '',
      duration: 0,
      format: 'none',
      size: 0,
      sampleRate: 0,
      channels: 0,
      compressed: false,
      storageId: ''
    };
  }

  private static generateDeliveryUrls(_jobId: string): DeliveryUrls {
    const baseUrl = '/api/storage';
    return {
      allFrames: `${baseUrl}/video/${_jobId}?type=frames`,
      audio: `${baseUrl}/video/${_jobId}?type=audio`,
      metadata: `${baseUrl}/video/${_jobId}?type=metadata`,
      batch: `${baseUrl}/delivery`
    };
  }

  private static calculateStorageLocations(frames: EnhancedFrameMetadata[], audio: EnhancedAudioMetadata): StorageLocation[] {
    const locations: StorageLocation[] = [];

    if (frames.length > 0) {
      locations.push({
        contentType: ContentType.FRAMES,
        count: frames.length,
        totalSize: frames.reduce((sum, frame) => sum + frame.size, 0),
        compressed: frames.some(frame => frame.compressed)
      });
    }

    if (audio.url) {
      locations.push({
        contentType: ContentType.AUDIO,
        count: 1,
        totalSize: audio.size,
        compressed: audio.compressed
      });
    }

    return locations;
  }

  private static calculateTotalSize(frames: EnhancedFrameMetadata[], audio: EnhancedAudioMetadata): number {
    const framesSize = frames.reduce((sum, frame) => sum + frame.size, 0);
    const audioSize = audio.size || 0;
    return framesSize + audioSize;
  }

  private static calculateCompressionRatio(frames: EnhancedFrameMetadata[], audio: EnhancedAudioMetadata): number {
    // This would require original vs compressed size comparison
    // For now, return estimated ratio
    return 0.75; // 25% compression ratio estimate
  }

  private static updateJobStatus(
    jobId: string,
    status: EnhancedVideoProcessingJob['status'],
    updates: Partial<EnhancedVideoProcessingJob> = {}
  ): void {
    const job = enhancedProcessingJobs.get(jobId);
    if (job) {
      Object.assign(job, { status, ...updates });
      enhancedProcessingJobs.set(jobId, job);
    }
  }

  private static updateJobProgress(jobId: string, progress: number): void {
    const job = enhancedProcessingJobs.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      enhancedProcessingJobs.set(jobId, job);
    }
  }

  private static handleProcessingError(jobId: string, error: unknown): void {
    const job = enhancedProcessingJobs.get(jobId);
    if (job) {
      const normalizedError = normalizeError(error, job.requestId);
      job.status = 'failed';
      job.error = normalizedError.message;
      job.completedAt = new Date();
      enhancedProcessingJobs.set(jobId, job);
      
      logError(normalizedError, { 
        operation: 'enhanced_video_processing', 
        jobId,
        videoUrl: job.videoUrl
      });
    }
  }

  static getStats(): {
    totalJobs: number;
    byStatus: Record<EnhancedVideoProcessingJob['status'], number>;
    currentJobs: number;
    maxConcurrent: number;
    storageStats: {
      totalSize: number;
      averageCompressionRatio: number;
      contentTypes: number;
    };
  } {
    const jobs = Array.from(enhancedProcessingJobs.values());
    const stats = {
      totalJobs: jobs.length,
      byStatus: {
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0
      } as Record<EnhancedVideoProcessingJob['status'], number>,
      currentJobs: this.currentJobs,
      maxConcurrent: this.MAX_CONCURRENT_JOBS,
      storageStats: {
        totalSize: 0,
        averageCompressionRatio: 0,
        contentTypes: 0
      }
    };

    // Calculate statistics
    for (const job of jobs) {
      stats.byStatus[job.status]++;
      if (job.results?.storage) {
        stats.storageStats.totalSize += job.results.storage.totalSize;
        stats.storageStats.averageCompressionRatio += job.results.storage.compressionRatio;
        stats.storageStats.contentTypes += job.results.storage.storageLocations.length;
      }
    }

    const completedJobs = stats.byStatus.completed;
    if (completedJobs > 0) {
      stats.storageStats.averageCompressionRatio /= completedJobs;
    }

    return stats;
  }
} 
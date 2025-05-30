// Video Processing Service for FFmpeg integration
import { nanoid } from 'nanoid';
import ffmpeg from 'fluent-ffmpeg';
import { put } from '@vercel/blob';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  VideoProcessingError,
  VideoFormatError,
  VideoCorruptedError,
  FrameExtractionError,
  AudioExtractionError,
  ProcessingJobNotFoundError
} from './errors/types';
import { generateRequestId, logError, normalizeError } from './errors/handlers';
import { enhancedErrorHandler } from './enhanced-error-handling';

// Configure FFmpeg paths
ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg');
ffmpeg.setFfprobePath('/opt/homebrew/bin/ffprobe');

// Core interfaces from architecture document
export interface VideoProcessingJob {
  id: string;
  videoUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: ProcessingResults;
  requestId: string;
}

export interface ProcessingResults {
  frames: FrameMetadata[];
  audio: AudioMetadata;
  videoMetadata: VideoMetadata;
  processingStats: ProcessingStats;
}

export interface FrameMetadata {
  timestamp: number;
  url: string;
  size: number;
  width: number;
  height: number;
}

export interface AudioMetadata {
  url: string;
  duration: number;
  format: string;
  size: number;
  sampleRate: number;
  channels: number;
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
}

export interface VideoProcessingOptions {
  frameInterval?: number;
  frameQuality?: number;
  frameResolution?: { width: number; height: number };
  audioFormat?: 'mp3' | 'wav';
  audioQuality?: number;
  extractAudio?: boolean;
  timeout?: number;
}

// In-memory job storage (production should use Redis/database)
const processingJobs = new Map<string, VideoProcessingJob>();

export class VideoProcessor {
  private static readonly DEFAULT_OPTIONS: Required<VideoProcessingOptions> = {
    frameInterval: 10,
    frameQuality: 85,
    frameResolution: { width: 1280, height: 720 },
    audioFormat: 'mp3',
    audioQuality: 128,
    extractAudio: true,
    timeout: 900000 // 15 minutes
  };

  private static readonly MAX_CONCURRENT_JOBS = 3;
  private static currentJobs = 0;

  /**
   * Start a new video processing job
   */
  static async startProcessing(
    videoUrl: string,
    options: VideoProcessingOptions = {}
  ): Promise<VideoProcessingJob> {
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

    const job: VideoProcessingJob = {
      id: jobId,
      videoUrl,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      requestId
    };

    processingJobs.set(jobId, job);

    // Start processing asynchronously
    this.processVideo(jobId, { ...this.DEFAULT_OPTIONS, ...options })
      .catch(error => {
        this.handleProcessingError(jobId, error);
      });

    return job;
  }

  /**
   * Get job status and details
   */
  static getJob(jobId: string): VideoProcessingJob | undefined {
    return processingJobs.get(jobId);
  }

  /**
   * Get all jobs (optionally filtered by status)
   */
  static getJobs(status?: VideoProcessingJob['status']): VideoProcessingJob[] {
    const jobs = Array.from(processingJobs.values());
    return status ? jobs.filter(job => job.status === status) : jobs;
  }

  /**
   * Main video processing pipeline
   */
  private static async processVideo(
    jobId: string,
    options: Required<VideoProcessingOptions>
  ): Promise<void> {
    const job = processingJobs.get(jobId);
    if (!job) {
      throw new ProcessingJobNotFoundError(`Job ${jobId} not found`);
    }

    try {
      this.currentJobs++;
      this.updateJobStatus(jobId, 'processing', { startedAt: new Date() });

      // Step 1: Validate video and extract metadata (10% progress)
      const videoMetadata = await this.extractVideoMetadata(job.videoUrl);
      this.updateJobProgress(jobId, 10);

      // Step 2: Extract frames (60% progress total)
      const frames = await this.extractFrames(
        job.videoUrl,
        videoMetadata,
        options,
        (progress) => this.updateJobProgress(jobId, 10 + (progress * 0.6))
      );

      // Step 3: Extract audio if requested (90% progress total)
      let audio: AudioMetadata | undefined;
      if (options.extractAudio) {
        audio = await this.extractAudio(
          job.videoUrl,
          videoMetadata,
          options,
          (progress) => this.updateJobProgress(jobId, 70 + (progress * 0.2))
        );
      } else {
        this.updateJobProgress(jobId, 90);
      }

      // Step 4: Finalize results (100% progress)
      const results: ProcessingResults = {
        frames,
        audio: audio || {
          url: '',
          duration: videoMetadata.duration,
          format: 'none',
          size: 0,
          sampleRate: 0,
          channels: 0
        },
        videoMetadata,
        processingStats: {
          processingTime: Date.now() - (job.startedAt?.getTime() || job.createdAt.getTime()),
          memoryUsed: process.memoryUsage().heapUsed,
          framesExtracted: frames.length,
          audioExtracted: !!audio
        }
      };

      this.updateJobStatus(jobId, 'completed', {
        completedAt: new Date(),
        results,
        progress: 100
      });

    } catch (error) {
      this.handleProcessingError(jobId, error);
    } finally {
      this.currentJobs--;
    }
  }

  /**
   * Extract video metadata with enhanced error handling
   */
  private static async extractVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    const requestId = generateRequestId();
    
    return enhancedErrorHandler.executeWithProtection(
      async () => {
        return new Promise<VideoMetadata>((resolve, reject) => {
          ffmpeg.ffprobe(videoUrl, (err, metadata) => {
            if (err) {
              reject(new VideoFormatError(
                'Failed to extract video metadata',
                { ffmpegError: err.message, videoUrl }
              ));
              return;
            }

            if (!metadata || !metadata.format || !metadata.streams) {
              reject(new VideoCorruptedError(
                'Video metadata is incomplete or corrupted',
                { videoUrl }
              ));
              return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
              reject(new VideoFormatError(
                'No video stream found in file',
                { videoUrl, streams: metadata.streams.length }
              ));
              return;
            }

            const duration = parseFloat(String(metadata.format.duration || '0'));
            const size = parseInt(String(metadata.format.size || '0'));
            const fps = this.parseFrameRate(videoStream.r_frame_rate || '30/1');

            resolve({
              duration,
              resolution: `${videoStream.width}x${videoStream.height}`,
              fps,
              codec: videoStream.codec_name || 'unknown',
              size,
              format: metadata.format.format_name || 'unknown'
            });
          });
        });
      },
      'ffmpeg-metadata',
      requestId,
      'video-metadata-extraction'
    );
  }

  /**
   * Extract frames from video at specified intervals
   */
  private static async extractFrames(
    videoUrl: string,
    videoMetadata: VideoMetadata,
    options: Required<VideoProcessingOptions>,
    onProgress: (progress: number) => void
  ): Promise<FrameMetadata[]> {
    const frames: FrameMetadata[] = [];
    const totalFrames = Math.floor(videoMetadata.duration / options.frameInterval);
    const videoId = nanoid();

    if (totalFrames === 0) {
      return frames;
    }

    return new Promise((resolve, reject) => {
      let extractedFrames = 0;
      
      // Create temporary directory for frames
      const tempDir = path.join(os.tmpdir(), `frames_${videoId}`);
      
      try {
        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
      } catch (error) {
        reject(new FrameExtractionError(
          'Failed to create temporary directory',
          { error: error instanceof Error ? error.message : String(error) }
        ));
        return;
      }
      
      const command = ffmpeg(videoUrl)
        .outputOptions([
          '-vf', `fps=1/${options.frameInterval},scale=${options.frameResolution.width}:${options.frameResolution.height}`,
          '-q:v', options.frameQuality.toString(),
          '-f', 'image2'
        ])
        .output(`${tempDir}/frame_%03d.jpg`)
        .on('start', () => {
          console.log(`Starting frame extraction for video ${videoId}`);
        })
        .on('progress', (progress) => {
          // FFmpeg progress reporting can be inconsistent, so we'll estimate
          const currentProgress = Math.min(progress.percent || 0, 100) / 100;
          onProgress(currentProgress * 0.7); // Reserve 30% for upload processing
        })
        .on('end', async () => {
          try {
            // Process extracted frames and upload to blob storage
            if (!fs.existsSync(tempDir)) {
              throw new FrameExtractionError('Frame extraction directory not found');
            }

            const frameFiles = fs.readdirSync(tempDir)
              .filter((file: string) => file.endsWith('.jpg'))
              .sort();

            if (frameFiles.length === 0) {
              throw new FrameExtractionError('No frames were extracted from video');
            }

            for (let i = 0; i < frameFiles.length; i++) {
              const frameFile = frameFiles[i];
              const framePath = path.join(tempDir, frameFile);
              const timestamp = i * options.frameInterval;
              
              try {
                // Read frame file
                const frameBuffer = fs.readFileSync(framePath);
                const frameStats = fs.statSync(framePath);
                
                let frameUrl: string;
                
                // Check if we have a valid blob token
                const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
                if (!blobToken || blobToken === 'your_blob_read_write_token_here') {
                  // Development mode: create mock URL and log frame creation
                  frameUrl = `http://localhost:3002/mock-frames/${videoId}/frame_${timestamp}s.jpg`;
                  console.log(`Frame extracted (dev mode): ${frameFile} -> ${frameUrl}`);
                } else {
                  // Production mode: upload to Vercel Blob
                  const blobResult = await put(
                    `${videoId}/frames/frame_${timestamp}s.jpg`,
                    frameBuffer,
                    {
                      access: 'public',
                      token: blobToken,
                    }
                  );
                  frameUrl = blobResult.url;
                }

                // Create frame metadata
                const frameMetadata: FrameMetadata = {
                  timestamp,
                  url: frameUrl,
                  size: frameStats.size,
                  width: options.frameResolution.width,
                  height: options.frameResolution.height
                };

                frames.push(frameMetadata);
                extractedFrames++;

                // Update progress based on frames processed (70% base + 30% for uploads)
                const uploadProgress = 0.7 + (extractedFrames / frameFiles.length) * 0.3;
                onProgress(uploadProgress);

              } catch (uploadError) {
                console.error(`Failed to process frame ${frameFile}:`, uploadError);
                // Continue with other frames even if one fails
              }
            }

            console.log(`Successfully extracted and uploaded ${frames.length} frames for video ${videoId}`);
            resolve(frames);

          } catch (error) {
            reject(new FrameExtractionError(
              'Failed to process extracted frames',
              { error: error instanceof Error ? error.message : String(error) }
            ));
          } finally {
            // Clean up temporary directory and all its contents
            try {
              if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                for (const file of files) {
                  fs.unlinkSync(path.join(tempDir, file));
                }
                fs.rmdirSync(tempDir);
              }
            } catch (cleanupError) {
              console.warn(`Failed to cleanup temp directory ${tempDir}:`, cleanupError);
            }
          }
        })
        .on('error', (err) => {
          // Clean up temp directory on error
          try {
            if (fs.existsSync(tempDir)) {
              const files = fs.readdirSync(tempDir);
              for (const file of files) {
                fs.unlinkSync(path.join(tempDir, file));
              }
              fs.rmdirSync(tempDir);
            }
          } catch (cleanupError) {
            console.warn(`Failed to cleanup temp directory after error:`, cleanupError);
          }
          
          reject(new FrameExtractionError(
            'Frame extraction failed',
            { ffmpegError: err.message }
          ));
        });

      // Start frame extraction
      command.run();
    });
  }

  /**
   * Extract audio from video
   */
  private static async extractAudio(
    videoUrl: string,
    videoMetadata: VideoMetadata,
    options: Required<VideoProcessingOptions>,
    onProgress: (progress: number) => void
  ): Promise<AudioMetadata> {
    const videoId = nanoid();
    const audioExtension = options.audioFormat;
    const audioFilename = `audio.${audioExtension}`;
    
    return new Promise((resolve, reject) => {
      // First check if video has audio streams
      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        if (err) {
          reject(new AudioExtractionError(
            'Failed to probe video for audio streams',
            { ffmpegError: err.message }
          ));
          return;
        }

        // Check if video has audio streams
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        if (!audioStream) {
          // Video has no audio - return appropriate metadata
          console.log(`Video ${videoId} has no audio streams, skipping audio extraction`);
          onProgress(1.0);
          
          const noAudioMetadata: AudioMetadata = {
            url: '',
            duration: videoMetadata.duration,
            format: 'none',
            size: 0,
            sampleRate: 0,
            channels: 0
          };
          
          resolve(noAudioMetadata);
          return;
        }

        // Video has audio - proceed with extraction
        console.log(`Video ${videoId} has audio stream: ${audioStream.codec_name}, proceeding with extraction`);
        
        // Create temporary directory for audio processing
        const tempDir = path.join(os.tmpdir(), `audio_${videoId}`);
        const tempAudioPath = path.join(tempDir, audioFilename);
        
        try {
          // Ensure temp directory exists
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
        } catch (error) {
          reject(new AudioExtractionError(
            'Failed to create temporary directory for audio extraction',
            { error: error instanceof Error ? error.message : String(error) }
          ));
          return;
        }

        // Configure FFmpeg command for audio extraction
        const command = ffmpeg(videoUrl);

        // Set output format and codec based on requested format
        if (options.audioFormat === 'mp3') {
          command
            .audioCodec('libmp3lame')
            .audioBitrate(options.audioQuality)
            .format('mp3');
        } else if (options.audioFormat === 'wav') {
          command
            .audioCodec('pcm_s16le')
            .audioFrequency(44100)
            .format('wav');
        }

        // Set audio channels (stereo by default, but configurable)
        command.audioChannels(2);

        // Remove video stream to extract only audio
        command
          .noVideo()
          .output(tempAudioPath)
          .on('start', (commandLine) => {
            console.log(`Starting audio extraction for video ${videoId}: ${commandLine}`);
          })
          .on('progress', (progress) => {
            // FFmpeg progress reporting - reserve 70% for extraction, 30% for upload
            const extractionProgress = Math.min(progress.percent || 0, 100) / 100;
            onProgress(extractionProgress * 0.7);
          })
          .on('end', async () => {
            try {
              // Verify audio file was created
              if (!fs.existsSync(tempAudioPath)) {
                throw new AudioExtractionError('Audio extraction completed but output file not found');
              }

              // Get file stats
              const audioStats = fs.statSync(tempAudioPath);
              const audioBuffer = fs.readFileSync(tempAudioPath);

              let audioUrl: string;
              
              // Check if we have a valid blob token
              const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
              if (!blobToken || blobToken === 'your_blob_read_write_token_here') {
                // Development mode: create mock URL
                audioUrl = `http://localhost:3002/mock-audio/${videoId}/audio.${audioExtension}`;
                console.log(`Audio extracted (dev mode): ${audioFilename} -> ${audioUrl}`);
              } else {
                // Production mode: upload to Vercel Blob
                onProgress(0.7); // Mark extraction complete, starting upload
                
                const blobResult = await put(
                  `${videoId}/audio/${audioFilename}`,
                  audioBuffer,
                  {
                    access: 'public',
                    token: blobToken,
                  }
                );
                audioUrl = blobResult.url;
              }

              // Extract additional audio metadata using ffprobe
              ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
                try {
                  let sampleRate = 44100;
                  let channels = 2;
                  
                  if (!err && metadata.streams) {
                    const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
                    if (audioStream) {
                      sampleRate = audioStream.sample_rate || 44100;
                      channels = audioStream.channels || 2;
                    }
                  }

                  // Create audio metadata
                  const audioMetadata: AudioMetadata = {
                    url: audioUrl,
                    duration: videoMetadata.duration,
                    format: options.audioFormat,
                    size: audioStats.size,
                    sampleRate,
                    channels
                  };

                  onProgress(1.0); // Mark as complete
                  console.log(`Successfully extracted and uploaded audio for video ${videoId}: ${audioMetadata.size} bytes`);
                  resolve(audioMetadata);

                } catch (metadataError) {
                  console.error(`Failed to extract audio metadata:`, metadataError);
                  // Resolve with basic metadata even if ffprobe fails
                  const audioMetadata: AudioMetadata = {
                    url: audioUrl,
                    duration: videoMetadata.duration,
                    format: options.audioFormat,
                    size: audioStats.size,
                    sampleRate: 44100,
                    channels: 2
                  };
                  
                  onProgress(1.0);
                  resolve(audioMetadata);
                }
              });

            } catch (error) {
              reject(new AudioExtractionError(
                'Failed to process extracted audio',
                { error: error instanceof Error ? error.message : String(error) }
              ));
            } finally {
              // Clean up temporary directory and files
              try {
                if (fs.existsSync(tempDir)) {
                  const files = fs.readdirSync(tempDir);
                  for (const file of files) {
                    fs.unlinkSync(path.join(tempDir, file));
                  }
                  fs.rmdirSync(tempDir);
                }
              } catch (cleanupError) {
                console.warn(`Failed to cleanup audio temp directory ${tempDir}:`, cleanupError);
              }
            }
          })
          .on('error', (err) => {
            // Clean up temp directory on error
            try {
              if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                for (const file of files) {
                  fs.unlinkSync(path.join(tempDir, file));
                }
                fs.rmdirSync(tempDir);
              }
            } catch (cleanupError) {
              console.warn(`Failed to cleanup audio temp directory after error:`, cleanupError);
            }
            
            reject(new AudioExtractionError(
              'Audio extraction failed',
              { ffmpegError: err.message }
            ));
          });

        // Start audio extraction
        command.run();
      });
    });
  }

  /**
   * Parse frame rate string (e.g., "30/1" -> 30)
   */
  private static parseFrameRate(frameRate: string): number {
    const parts = frameRate.split('/');
    if (parts.length === 2) {
      return parseInt(parts[0]) / parseInt(parts[1]);
    }
    return parseFloat(frameRate) || 30;
  }

  /**
   * Update job status
   */
  private static updateJobStatus(
    jobId: string,
    status: VideoProcessingJob['status'],
    updates: Partial<VideoProcessingJob> = {}
  ): void {
    const job = processingJobs.get(jobId);
    if (job) {
      const updatedJob = { ...job, status, ...updates };
      processingJobs.set(jobId, updatedJob);
    }
  }

  /**
   * Update job progress
   */
  private static updateJobProgress(jobId: string, progress: number): void {
    this.updateJobStatus(jobId, 'processing', { progress: Math.min(progress, 100) });
  }

  /**
   * Handle processing errors
   */
  private static handleProcessingError(jobId: string, error: unknown): void {
    const job = processingJobs.get(jobId);
    if (job) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateJobStatus(jobId, 'failed', {
        error: errorMessage,
        completedAt: new Date()
      });

      const normalizedError = normalizeError(error, job.requestId);
      logError(normalizedError, {
        operation: 'video-processing',
        jobId,
        videoUrl: job.videoUrl
      });
    }
  }

  /**
   * Clean up completed or failed jobs older than specified time
   */
  static cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [jobId, job] of processingJobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.createdAt < cutoff
      ) {
        processingJobs.delete(jobId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get processing statistics
   */
  static getStats(): {
    totalJobs: number;
    byStatus: Record<VideoProcessingJob['status'], number>;
    currentJobs: number;
    maxConcurrent: number;
  } {
    const jobs = Array.from(processingJobs.values());
    const byStatus: Record<VideoProcessingJob['status'], number> = {
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
// Video Processing Queue Service - Uses EnhancedVideoProcessor for actual processing
import { nanoid } from 'nanoid';
import { EnhancedVideoProcessor, EnhancedVideoProcessingJob, EnhancedVideoProcessingOptions } from './enhanced-video-processor';

export interface VideoProcessingJob {
  id: string;
  videoUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStage: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: ProcessingResults;
  requestId: string;
  processingService: 'enhanced' | 'local';
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
  visualAnalysis?: any;
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
  visualAnalysis?: {
    enabled: boolean;
    analysisType: 'slide_content' | 'presentation_flow' | 'visual_quality' | 'engagement_cues' | 'comprehensive';
    context?: {
      presentationTitle?: string;
      targetAudience?: string;
      analysisGoals?: string[];
    };
  };
}

// Map our simple interface to enhanced processor job
function mapToSimpleJob(enhancedJob: EnhancedVideoProcessingJob): VideoProcessingJob {
  return {
    id: enhancedJob.id,
    videoUrl: enhancedJob.videoUrl,
    status: enhancedJob.status,
    progress: enhancedJob.progress,
    currentStage: getStageFromProgress(enhancedJob.progress),
    createdAt: enhancedJob.createdAt,
    startedAt: enhancedJob.startedAt,
    completedAt: enhancedJob.completedAt,
    error: enhancedJob.error,
    results: enhancedJob.results ? {
      frames: enhancedJob.results.frames.map(f => ({
        timestamp: f.timestamp,
        url: f.url,
        size: f.size,
        width: f.width,
        height: f.height,
        visualAnalysis: f.visualAnalysis
      })),
      audio: {
        url: enhancedJob.results.audio.url,
        duration: enhancedJob.results.audio.duration,
        format: enhancedJob.results.audio.format,
        size: enhancedJob.results.audio.size,
        sampleRate: enhancedJob.results.audio.sampleRate,
        channels: enhancedJob.results.audio.channels
      },
      videoMetadata: enhancedJob.results.videoMetadata,
      processingStats: {
        processingTime: enhancedJob.results.processingStats.processingTime,
        memoryUsed: enhancedJob.results.processingStats.memoryUsed,
        framesExtracted: enhancedJob.results.processingStats.framesExtracted,
        audioExtracted: enhancedJob.results.processingStats.audioExtracted
      }
    } : undefined,
    requestId: enhancedJob.requestId,
    processingService: 'enhanced'
  };
}

function getStageFromProgress(progress: number): string {
  if (progress < 10) return 'metadata_extraction';
  if (progress < 60) return 'frame_extraction';
  if (progress < 80) return 'audio_extraction';
  if (progress < 95) return 'visual_analysis';
  if (progress < 100) return 'finalizing';
  return 'completed';
}

function getStageMessage(stage: string, progress: number): string {
  const messages = {
    metadata_extraction: `Extracting video metadata... ${progress}%`,
    frame_extraction: `Extracting frames from video... ${progress}%`,
    audio_extraction: `Extracting audio track... ${progress}%`,
    visual_analysis: `Analyzing frames with GPT-4V... ${progress}%`,
    finalizing: `Finalizing results... ${progress}%`,
    completed: 'Processing complete!'
  };
  return messages[stage as keyof typeof messages] || `Processing... ${progress}%`;
}

export class VideoProcessorQueue {
  /**
   * Start video processing using EnhancedVideoProcessor
   */
  static async startProcessing(
    videoUrl: string,
    options: VideoProcessingOptions = {}
  ): Promise<VideoProcessingJob> {
    console.log(`Starting video processing with EnhancedVideoProcessor for: ${videoUrl}`);
    
    // Convert options to enhanced processor format
    const enhancedOptions: EnhancedVideoProcessingOptions = {
      frameInterval: options.frameInterval || 10,
      frameQuality: options.frameQuality || 85,
      frameResolution: options.frameResolution || { width: 1280, height: 720 },
      audioFormat: options.audioFormat || 'mp3',
      audioQuality: options.audioQuality || 128,
      extractAudio: options.extractAudio !== false, // Default to true
      timeout: options.timeout || 900000,
      enableCompression: true,
      enableCDN: false,
      generateSignedUrls: true,
      storageRetention: 2592000000, // 30 days
      visualAnalysis: options.visualAnalysis || {
        enabled: true,
        analysisType: 'slide_content',
        context: {}
      }
    };

    // Start processing with enhanced processor
    const enhancedJob = await EnhancedVideoProcessor.startProcessing(videoUrl, enhancedOptions);
    
    return mapToSimpleJob(enhancedJob);
  }

  /**
   * Get job status using EnhancedVideoProcessor
   */
  static async getJob(jobId: string): Promise<VideoProcessingJob | null> {
    const enhancedJob = await EnhancedVideoProcessor.getJob(jobId);
    if (!enhancedJob) return null;
    
    return mapToSimpleJob(enhancedJob);
  }

  /**
   * Get all jobs using EnhancedVideoProcessor
   */
  static async getJobs(status?: VideoProcessingJob['status']): Promise<VideoProcessingJob[]> {
    const enhancedJobs = await EnhancedVideoProcessor.getJobs(status);
    return enhancedJobs.map(mapToSimpleJob);
  }

  /**
   * Get job with user-friendly status message
   */
  static async getJobWithStatus(jobId: string): Promise<{
    job: VideoProcessingJob | null;
    message: string;
    estimatedTimeRemaining?: number;
  }> {
    const job = await this.getJob(jobId);
    if (!job) {
      return {
        job: null,
        message: 'Job not found'
      };
    }

    const message = getStageMessage(job.currentStage, job.progress);
    let estimatedTimeRemaining: number | undefined;

    // Estimate remaining time based on progress and current stage
    if (job.status === 'processing' && job.startedAt) {
      const elapsed = Date.now() - job.startedAt.getTime();
      const progressDecimal = job.progress / 100;
      if (progressDecimal > 0) {
        const totalEstimated = elapsed / progressDecimal;
        estimatedTimeRemaining = Math.max(0, totalEstimated - elapsed);
      }
    }

    return {
      job,
      message,
      estimatedTimeRemaining
    };
  }

  /**
   * Clean up old jobs
   */
  static async cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    return await EnhancedVideoProcessor.cleanupOldJobs(maxAge);
  }

  /**
   * Get processing statistics
   */
  static async getStats(): Promise<{
    totalJobs: number;
    byStatus: Record<VideoProcessingJob['status'], number>;
    currentJobs: number;
    maxConcurrent: number;
  }> {
    return await EnhancedVideoProcessor.getStats();
  }
} 
// Optimized Video Processing Service with parallel processing and performance monitoring
import { nanoid } from 'nanoid';
import ffmpeg from 'fluent-ffmpeg';
import { 
  VideoProcessingError,
  FrameExtractionError,
  AudioExtractionError,
  ProcessingJobNotFoundError
} from './errors/types';
import { generateRequestId, logError, normalizeError } from './errors/handlers';
import { PerformanceMonitor, JobPerformanceData } from './performance-monitor';
import { WorkerPool } from './worker-pool';

// Configure FFmpeg paths
ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg');
ffmpeg.setFfprobePath('/opt/homebrew/bin/ffprobe');

// Enhanced interfaces for optimized processing
export interface OptimizedVideoProcessingJob {
  id: string;
  videoUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: OptimizedProcessingResults;
  requestId: string;
  subtasks: {
    metadata?: string;
    frameExtraction?: string;
    audioExtraction?: string;
  };
  performance?: JobPerformanceData;
}

export interface OptimizedProcessingResults {
  frames: FrameMetadata[];
  audio: AudioMetadata;
  videoMetadata: VideoMetadata;
  processingStats: ProcessingStats;
  performanceMetrics: {
    totalProcessingTime: number;
    parallelEfficiency: number;
    resourceUtilization: {
      peakMemory: number;
      avgCpuUsage: number;
      diskUsage: number;
    };
    bottlenecks: string[];
  };
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
  parallelTasks: number;
  concurrencyLevel: number;
}

export interface OptimizedVideoProcessingOptions {
  frameInterval?: number;
  frameQuality?: number;
  frameResolution?: { width: number; height: number };
  audioFormat?: 'mp3' | 'wav';
  audioQuality?: number;
  extractAudio?: boolean;
  timeout?: number;
  enableParallelProcessing?: boolean;
  maxConcurrency?: number;
  chunkSize?: number;
  optimizeForSpeed?: boolean;
}

export class OptimizedVideoProcessor {
  private static readonly DEFAULT_OPTIONS: Required<OptimizedVideoProcessingOptions> = {
    frameInterval: 10,
    frameQuality: 85,
    frameResolution: { width: 1280, height: 720 },
    audioFormat: 'mp3',
    audioQuality: 128,
    extractAudio: true,
    timeout: 600000, // 10 minutes
    enableParallelProcessing: true,
    maxConcurrency: 0, // Auto-detect
    chunkSize: 60, // 60 seconds per chunk
    optimizeForSpeed: true
  };

  private static workerPool: WorkerPool;
  private static processingJobs = new Map<string, OptimizedVideoProcessingJob>();
  private static initialized = false;

  /**
   * Initialize the optimized video processor
   */
  static initialize(options: Partial<OptimizedVideoProcessingOptions> = {}): void {
    if (this.initialized) return;

    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Start performance monitoring
    PerformanceMonitor.startMonitoring(3000); // Every 3 seconds

    // Initialize worker pool with optimal settings
    const maxWorkers = config.maxConcurrency || PerformanceMonitor.getOptimalConcurrency();
    this.workerPool = new WorkerPool({
      maxWorkers,
      minWorkers: 1,
      maxQueueSize: 200,
      taskTimeout: config.timeout,
      autoScale: true
    });

    // Set up worker pool event listeners
    this.setupWorkerPoolListeners();

    this.initialized = true;
    console.log(`OptimizedVideoProcessor initialized with ${maxWorkers} max workers`);
  }

  /**
   * Start optimized video processing
   */
  static async startProcessing(
    videoUrl: string,
    options: OptimizedVideoProcessingOptions = {}
  ): Promise<OptimizedVideoProcessingJob> {
    if (!this.initialized) {
      this.initialize(options);
    }

    const requestId = generateRequestId();
    const jobId = nanoid();
    const config = { ...this.DEFAULT_OPTIONS, ...options };

    const job: OptimizedVideoProcessingJob = {
      id: jobId,
      videoUrl,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      requestId,
      subtasks: {}
    };

    this.processingJobs.set(jobId, job);

    // Start performance tracking
    PerformanceMonitor.startJobTracking(jobId, {
      duration: 0, // Will be updated after metadata extraction
      resolution: '',
      fileSize: 0,
      framesExtracted: 0,
      audioExtracted: config.extractAudio
    });

    // Start processing asynchronously
    this.processVideoOptimized(jobId, config)
      .catch(error => {
        this.handleProcessingError(jobId, error);
      });

    return job;
  }

  /**
   * Get job status and details
   */
  static getJob(jobId: string): OptimizedVideoProcessingJob | undefined {
    return this.processingJobs.get(jobId);
  }

  /**
   * Get all jobs with status filter
   */
  static getJobs(status?: OptimizedVideoProcessingJob['status']): OptimizedVideoProcessingJob[] {
    const jobs = Array.from(this.processingJobs.values());
    return status ? jobs.filter(job => job.status === status) : jobs;
  }

  /**
   * Get performance metrics and recommendations
   */
  static getPerformanceMetrics(): {
    current: ReturnType<typeof PerformanceMonitor.getCurrentMetrics>;
    historical: ReturnType<typeof PerformanceMonitor.getHistoricalMetrics>;
    workerPool: ReturnType<typeof WorkerPool.prototype.getStatus>;
    recommendations: string[];
  } {
    return {
      current: PerformanceMonitor.getCurrentMetrics(),
      historical: PerformanceMonitor.getHistoricalMetrics(50),
      workerPool: this.workerPool.getStatus(),
      recommendations: PerformanceMonitor.getPerformanceRecommendations()
    };
  }

  /**
   * Optimized video processing pipeline with parallel execution
   */
  private static async processVideoOptimized(
    jobId: string,
    options: Required<OptimizedVideoProcessingOptions>
  ): Promise<void> {
    const job = this.processingJobs.get(jobId);
    if (!job) {
      throw new ProcessingJobNotFoundError(`Job ${jobId} not found`);
    }

    try {
      this.updateJobStatus(jobId, 'processing', { startedAt: new Date() });
      PerformanceMonitor.updateJobStage(jobId, 'metadata', 'start');

      // Step 1: Extract metadata first (5% progress)
      const metadataTaskId = this.workerPool.addTask({
        type: 'metadata',
        data: { videoUrl: job.videoUrl },
        priority: 10
      });
      
      job.subtasks.metadata = metadataTaskId;
      
      // Wait for metadata to complete
      const metadataResult = await this.waitForTaskCompletion(metadataTaskId);
      if (!metadataResult.success) {
        throw new VideoProcessingError('Failed to extract metadata', { error: metadataResult.error });
      }

      const videoMetadata = metadataResult.data?.metadata as VideoMetadata;
      this.updateJobProgress(jobId, 5);
      PerformanceMonitor.updateJobStage(jobId, 'metadata', 'end');

      // Update performance tracking with video metadata
      PerformanceMonitor.startJobTracking(jobId, {
        duration: videoMetadata.duration,
        resolution: videoMetadata.resolution,
        fileSize: videoMetadata.size,
        framesExtracted: Math.floor(videoMetadata.duration / options.frameInterval),
        audioExtracted: options.extractAudio
      });

      // Step 2: Parallel processing of frames and audio
      const parallelTasks: Promise<any>[] = [];
      
      // Frame extraction task
      PerformanceMonitor.updateJobStage(jobId, 'frameExtraction', 'start');
      const frameTaskId = this.workerPool.addTask({
        type: 'frameExtraction',
        data: {
          videoUrl: job.videoUrl,
          videoMetadata,
          options,
          jobId
        },
        priority: 8
      });
      job.subtasks.frameExtraction = frameTaskId;
      parallelTasks.push(this.waitForTaskCompletion(frameTaskId));

      // Audio extraction task (if enabled)
      if (options.extractAudio) {
        PerformanceMonitor.updateJobStage(jobId, 'audioExtraction', 'start');
        const audioTaskId = this.workerPool.addTask({
          type: 'audioExtraction',
          data: {
            videoUrl: job.videoUrl,
            videoMetadata,
            options,
            jobId
          },
          priority: 7
        });
        job.subtasks.audioExtraction = audioTaskId;
        parallelTasks.push(this.waitForTaskCompletion(audioTaskId));
      }

      // Wait for all parallel tasks to complete
      const results = await Promise.all(parallelTasks);
      
      PerformanceMonitor.updateJobStage(jobId, 'frameExtraction', 'end');
      if (options.extractAudio) {
        PerformanceMonitor.updateJobStage(jobId, 'audioExtraction', 'end');
      }

      // Check for failures
      const frameResult = results[0];
      const audioResult = results[1];

      if (!frameResult.success) {
        throw new FrameExtractionError('Frame extraction failed', frameResult.error);
      }

      if (options.extractAudio && !audioResult.success) {
        throw new AudioExtractionError('Audio extraction failed', audioResult.error);
      }

      // Step 3: Compile final results (95% -> 100%)
      const performanceData = PerformanceMonitor.completeJobTracking(jobId);
      
      const optimizedResults: OptimizedProcessingResults = {
        frames: frameResult.data?.frames || [],
        audio: audioResult?.data?.audio || this.getEmptyAudioMetadata(),
        videoMetadata,
        processingStats: {
          processingTime: performanceData?.endTime ? performanceData.endTime - performanceData.startTime : 0,
          memoryUsed: performanceData?.resources.peakMemory || 0,
          framesExtracted: frameResult.data?.frames?.length || 0,
          audioExtracted: !!audioResult?.success,
          parallelTasks: parallelTasks.length,
          concurrencyLevel: this.workerPool.getStatus().workers.total
        },
        performanceMetrics: {
          totalProcessingTime: performanceData?.endTime ? performanceData.endTime - performanceData.startTime : 0,
          parallelEfficiency: this.calculateParallelEfficiency(performanceData),
          resourceUtilization: {
            peakMemory: performanceData?.resources.peakMemory || 0,
            avgCpuUsage: 0, // Would be calculated from system metrics
            diskUsage: performanceData?.resources.diskUsage || 0
          },
          bottlenecks: this.identifyBottlenecks(performanceData)
        }
      };

      this.updateJobStatus(jobId, 'completed', {
        completedAt: new Date(),
        results: optimizedResults,
        performance: performanceData
      });

      this.updateJobProgress(jobId, 100);
      
      console.log(`Optimized processing completed for job ${jobId} in ${optimizedResults.processingStats.processingTime}ms`);

    } catch (error) {
      this.handleProcessingError(jobId, error);
    }
  }

  /**
   * Wait for a worker task to complete
   */
  private static async waitForTaskCompletion(taskId: string, timeout: number = 600000): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    return new Promise((resolve, reject) => {
      const checkInterval = 1000; // Check every second
      let elapsed = 0;

      const interval = setInterval(() => {
        const result = this.workerPool.getTaskResult(taskId);
        
        if (result) {
          clearInterval(interval);
          resolve(result);
        } else if (elapsed >= timeout) {
          clearInterval(interval);
          reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
        }
        
        elapsed += checkInterval;
      }, checkInterval);
    });
  }

  /**
   * Calculate parallel processing efficiency
   */
  private static calculateParallelEfficiency(performanceData?: JobPerformanceData): number {
    if (!performanceData) return 0;

    const stages = performanceData.stages;
    const totalSequentialTime = 
      (stages.metadata.duration || 0) +
      (stages.frameExtraction.duration || 0) +
      (stages.audioExtraction.duration || 0);

    const actualTotalTime = performanceData.endTime ? 
      performanceData.endTime - performanceData.startTime : 0;

    return actualTotalTime > 0 ? (totalSequentialTime / actualTotalTime) * 100 : 0;
  }

  /**
   * Identify processing bottlenecks
   */
  private static identifyBottlenecks(performanceData?: JobPerformanceData): string[] {
    const bottlenecks: string[] = [];
    
    if (!performanceData) return bottlenecks;

    const stages = performanceData.stages;
    const totalTime = performanceData.endTime ? 
      performanceData.endTime - performanceData.startTime : 0;

    // Check if any stage took disproportionately long
    Object.entries(stages).forEach(([stageName, stageData]) => {
      if (stageData.duration && totalTime > 0) {
        const percentage = (stageData.duration / totalTime) * 100;
        if (percentage > 60) {
          bottlenecks.push(`${stageName} stage took ${percentage.toFixed(1)}% of total time`);
        }
      }
    });

    // Check memory usage
    if (performanceData.resources.peakMemory > 500 * 1024 * 1024) { // 500MB
      bottlenecks.push('High memory usage detected');
    }

    return bottlenecks;
  }

  /**
   * Setup worker pool event listeners
   */
  private static setupWorkerPoolListeners(): void {
    this.workerPool.on('taskCompleted', ({ task, result }) => {
      // Update job progress based on completed tasks
      if (task.data.jobId) {
        const jobId = task.data.jobId as string;
        this.updateTaskProgress(jobId, task.type, result.success);
      }
    });

    this.workerPool.on('taskError', ({ task, error }) => {
      console.error(`Worker task ${task.id} failed:`, error);
    });
  }

  /**
   * Update job progress based on completed tasks
   */
  private static updateTaskProgress(jobId: string, taskType: string, success: boolean): void {
    const job = this.processingJobs.get(jobId);
    if (!job) return;

    let progressIncrement = 0;
    
    switch (taskType) {
      case 'metadata':
        progressIncrement = 5;
        break;
      case 'frameExtraction':
        progressIncrement = 60;
        break;
      case 'audioExtraction':
        progressIncrement = 30;
        break;
    }

    if (success) {
      this.updateJobProgress(jobId, Math.min(job.progress + progressIncrement, 95));
    }
  }

  /**
   * Get empty audio metadata for videos without audio
   */
  private static getEmptyAudioMetadata(): AudioMetadata {
    return {
      url: '',
      duration: 0,
      format: '',
      size: 0,
      sampleRate: 0,
      channels: 0
    };
  }

  /**
   * Update job status
   */
  private static updateJobStatus(
    jobId: string,
    status: OptimizedVideoProcessingJob['status'],
    updates: Partial<OptimizedVideoProcessingJob> = {}
  ): void {
    const job = this.processingJobs.get(jobId);
    if (job) {
      Object.assign(job, { status, ...updates });
    }
  }

  /**
   * Update job progress
   */
  private static updateJobProgress(jobId: string, progress: number): void {
    const job = this.processingJobs.get(jobId);
    if (job) {
      job.progress = Math.min(Math.max(progress, 0), 100);
    }
  }

  /**
   * Handle processing errors
   */
  private static handleProcessingError(jobId: string, error: unknown): void {
    const job = this.processingJobs.get(jobId);
    if (job) {
      const normalizedError = normalizeError(error, job.requestId);
      job.status = 'failed';
      job.error = normalizedError.message;
      job.completedAt = new Date();
    }

    const requestId = job?.requestId || generateRequestId();
    logError(normalizeError(error, requestId), { jobId, stage: 'processing' });
  }

  /**
   * Cleanup and shutdown
   */
  static shutdown(): void {
    if (this.workerPool) {
      this.workerPool.shutdown();
    }
    PerformanceMonitor.stopMonitoring();
    this.initialized = false;
  }

  /**
   * Get processing statistics
   */
  static getStats(): {
    totalJobs: number;
    byStatus: Record<OptimizedVideoProcessingJob['status'], number>;
    performance: ReturnType<typeof PerformanceMonitor.getCurrentMetrics>;
    workerPool: ReturnType<typeof WorkerPool.prototype.getStatus>;
  } {
    const jobs = Array.from(this.processingJobs.values());
    const statusCounts = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<OptimizedVideoProcessingJob['status'], number>);

    return {
      totalJobs: jobs.length,
      byStatus: statusCounts,
      performance: PerformanceMonitor.getCurrentMetrics(),
      workerPool: this.workerPool?.getStatus() || {
        workers: { total: 0, idle: 0, busy: 0, error: 0 },
        queue: { pending: 0, maxSize: 0 },
        performance: { completedTasks: 0, avgProcessingTime: 0, errorRate: 0 }
      }
    };
  }
} 
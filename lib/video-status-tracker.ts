// Video Status Tracking Service for enhanced job monitoring
import { VideoProcessingJob } from './video-processor';
import { 
  ProcessingResults
} from './video-processor';
import { nanoid } from 'nanoid';

// Enhanced job interface with additional tracking fields
export interface EnhancedVideoProcessingJob extends VideoProcessingJob {
  // Additional metadata for better tracking
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  
  // Performance tracking
  queuedAt: Date;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  totalQueueTime?: number;
  totalProcessingTime?: number;
  
  // Enhanced status tracking
  currentStage: JobStage;
  stageHistory: StageEvent[];
  
  // Error handling and retries
  retryCount: number;
  maxRetries: number;
  lastError?: JobError;
  errorHistory: JobError[];
  
  // Resource usage tracking - make required to fix linter errors
  memoryUsage: MemoryUsage[];
  resourceStats?: ResourceStats;
}

export interface StageEvent {
  stage: JobStage;
  timestamp: Date;
  progress: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface JobError {
  timestamp: Date;
  error: string;
  errorCode: string;
  stack?: string;
  context?: Record<string, unknown>;
  retryable: boolean;
}

export interface MemoryUsage {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export interface ResourceStats {
  peakMemoryUsage: number;
  avgMemoryUsage: number;
  cpuUsage?: number;
  diskUsage?: number;
}

export type JobStage = 
  | 'queued'
  | 'initializing'
  | 'metadata_extraction'
  | 'frame_extraction'
  | 'audio_extraction'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface JobMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  avgQueueTime: number;
  successRate: number;
  throughput: number; // jobs per hour
  currentLoad: number;
  resourceUtilization: {
    memory: number;
    cpu: number;
  };
}

export interface JobQuery {
  status?: string | string[];
  stage?: JobStage | JobStage[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'completedAt' | 'processingTime';
  sortOrder?: 'asc' | 'desc';
}

export class VideoStatusTracker {
  private static instance: VideoStatusTracker;
  private jobs: Map<string, EnhancedVideoProcessingJob> = new Map();
  private jobHistory: Map<string, EnhancedVideoProcessingJob> = new Map();
  private metrics: JobMetrics;
  private readonly MAX_ACTIVE_JOBS = 3;
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    this.metrics = this.calculateMetrics();
    this.startCleanupTimer();
  }

  static getInstance(): VideoStatusTracker {
    if (!VideoStatusTracker.instance) {
      VideoStatusTracker.instance = new VideoStatusTracker();
    }
    return VideoStatusTracker.instance;
  }

  /**
   * Create a new job with enhanced tracking
   */
  createJob(
    jobId: string,
    videoUrl: string,
    options: {
      userAgent?: string;
      ipAddress?: string;
      sessionId?: string;
      maxRetries?: number;
    } = {}
  ): EnhancedVideoProcessingJob {
    const now = new Date();
    
    const job: EnhancedVideoProcessingJob = {
      id: jobId,
      videoUrl,
      status: 'queued',
      progress: 0,
      createdAt: now,
      queuedAt: now,
      currentStage: 'queued',
      stageHistory: [{
        stage: 'queued',
        timestamp: now,
        progress: 0,
        message: 'Job created and queued for processing'
      }],
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      errorHistory: [],
      memoryUsage: [],
      requestId: nanoid(),
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
      sessionId: options.sessionId
    };

    this.jobs.set(jobId, job);
    this.updateMetrics();
    
    return job;
  }

  /**
   * Update job stage with detailed tracking
   */
  updateJobStage(
    jobId: string,
    stage: JobStage,
    progress: number,
    message?: string,
    metadata?: Record<string, unknown>
  ): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    const now = new Date();

    // Update job properties
    job.currentStage = stage;
    job.progress = Math.min(Math.max(progress, 0), 100);
    
    // Update status based on stage
    if (stage === 'completed') {
      job.status = 'completed';
      job.completedAt = now;
      job.processingCompletedAt = now;
      
      if (job.processingStartedAt) {
        job.totalProcessingTime = now.getTime() - job.processingStartedAt.getTime();
      }
      if (job.queuedAt) {
        job.totalQueueTime = (job.processingStartedAt || now).getTime() - job.queuedAt.getTime();
      }
    } else if (stage === 'failed' || stage === 'cancelled' || stage === 'timeout') {
      job.status = 'failed';
      job.completedAt = now;
    } else if (['metadata_extraction', 'frame_extraction', 'audio_extraction', 'finalizing'].includes(stage)) {
      job.status = 'processing';
      if (!job.processingStartedAt) {
        job.processingStartedAt = now;
        job.startedAt = now;
      }
    }

    // Add stage event to history
    const stageEvent: StageEvent = {
      stage,
      timestamp: now,
      progress,
      message,
      metadata
    };
    job.stageHistory.push(stageEvent);

    // Record memory usage if in processing stage
    if (job.status === 'processing') {
      this.recordMemoryUsage(jobId);
    }

    // Move to history if completed
    if (stage === 'completed' || stage === 'failed' || stage === 'cancelled') {
      this.moveToHistory(jobId);
    }

    this.updateMetrics();
    return true;
  }

  /**
   * Record an error for a job
   */
  recordJobError(
    jobId: string,
    error: string,
    errorCode: string,
    context?: Record<string, unknown>,
    retryable: boolean = true
  ): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    const jobError: JobError = {
      timestamp: new Date(),
      error,
      errorCode,
      context,
      retryable
    };

    job.errorHistory.push(jobError);
    job.lastError = jobError;

    if (retryable && job.retryCount < job.maxRetries) {
      job.retryCount++;
      // Reset to queued for retry
      this.updateJobStage(jobId, 'queued', 0, `Retry ${job.retryCount}/${job.maxRetries}`);
    } else {
      this.updateJobStage(jobId, 'failed', job.progress, error);
    }

    return true;
  }

  /**
   * Set job results
   */
  setJobResults(jobId: string, results: ProcessingResults): boolean {
    const job = this.jobs.get(jobId) || this.jobHistory.get(jobId);
    if (!job) {
      return false;
    }

    job.results = results;
    
    // Calculate final resource stats
    if (job.memoryUsage.length > 0) {
      const memoryUsages = job.memoryUsage.map(m => m.heapUsed);
      job.resourceStats = {
        peakMemoryUsage: Math.max(...memoryUsages),
        avgMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
      };
    }

    return true;
  }

  /**
   * Get a job by ID (checks both active and history)
   */
  getJob(jobId: string): EnhancedVideoProcessingJob | undefined {
    return this.jobs.get(jobId) || this.jobHistory.get(jobId);
  }

  /**
   * Query jobs with filtering and pagination
   */
  queryJobs(query: JobQuery = {}): {
    jobs: EnhancedVideoProcessingJob[];
    total: number;
    hasMore: boolean;
  } {
    const allJobs = [
      ...Array.from(this.jobs.values()),
      ...Array.from(this.jobHistory.values())
    ];

    let filteredJobs = allJobs;

    // Apply filters
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      filteredJobs = filteredJobs.filter(job => statuses.includes(job.status));
    }

    if (query.stage) {
      const stages = Array.isArray(query.stage) ? query.stage : [query.stage];
      filteredJobs = filteredJobs.filter(job => stages.includes(job.currentStage));
    }

    if (query.dateRange) {
      filteredJobs = filteredJobs.filter(job => 
        job.createdAt >= query.dateRange!.start && 
        job.createdAt <= query.dateRange!.end
      );
    }

    // Apply sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    
    filteredJobs.sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (sortBy) {
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'completedAt':
          aValue = a.completedAt?.getTime() || 0;
          bValue = b.completedAt?.getTime() || 0;
          break;
        case 'processingTime':
          aValue = a.totalProcessingTime || 0;
          bValue = b.totalProcessingTime || 0;
          break;
        default:
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    // Apply pagination
    const total = filteredJobs.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    
    const paginatedJobs = filteredJobs.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      jobs: paginatedJobs,
      total,
      hasMore
    };
  }

  /**
   * Get current system metrics
   */
  getMetrics(): JobMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get job statistics for monitoring
   */
  getJobStatistics(timeRange?: { start: Date; end: Date }): {
    summary: JobMetrics;
    stageDistribution: Record<JobStage, number>;
    errorAnalysis: {
      topErrors: Array<{ error: string; count: number; lastOccurrence: Date }>;
      retryAnalysis: { totalRetries: number; successAfterRetry: number };
    };
    performanceAnalysis: {
      processingTimePercentiles: { p50: number; p90: number; p95: number; p99: number };
      queueTimePercentiles: { p50: number; p90: number; p95: number; p99: number };
    };
  } {
    const query: JobQuery = timeRange ? { dateRange: timeRange } : {};
    const { jobs } = this.queryJobs(query);

    // Stage distribution
    const stageDistribution: Record<JobStage, number> = {
      queued: 0, initializing: 0, metadata_extraction: 0, frame_extraction: 0,
      audio_extraction: 0, finalizing: 0, completed: 0, failed: 0, cancelled: 0, timeout: 0
    };
    
    jobs.forEach(job => {
      stageDistribution[job.currentStage]++;
    });

    // Error analysis
    const errorCounts = new Map<string, { count: number; lastOccurrence: Date }>();
    let totalRetries = 0;
    let successAfterRetry = 0;

    jobs.forEach(job => {
      totalRetries += job.retryCount;
      if (job.retryCount > 0 && job.status === 'completed') {
        successAfterRetry++;
      }

      job.errorHistory.forEach(error => {
        const key = error.errorCode || error.error;
        const existing = errorCounts.get(key);
        if (existing) {
          existing.count++;
          if (error.timestamp > existing.lastOccurrence) {
            existing.lastOccurrence = error.timestamp;
          }
        } else {
          errorCounts.set(key, { count: 1, lastOccurrence: error.timestamp });
        }
      });
    });

    const topErrors = Array.from(errorCounts.entries())
      .map(([error, data]) => ({ error, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Performance analysis
    const processingTimes = jobs
      .filter(job => job.totalProcessingTime)
      .map(job => job.totalProcessingTime!)
      .sort((a, b) => a - b);

    const queueTimes = jobs
      .filter(job => job.totalQueueTime)
      .map(job => job.totalQueueTime!)
      .sort((a, b) => a - b);

    const getPercentile = (values: number[], percentile: number): number => {
      if (values.length === 0) return 0;
      const index = Math.ceil((percentile / 100) * values.length) - 1;
      return values[Math.max(0, index)];
    };

    return {
      summary: this.getMetrics(),
      stageDistribution,
      errorAnalysis: {
        topErrors,
        retryAnalysis: { totalRetries, successAfterRetry }
      },
      performanceAnalysis: {
        processingTimePercentiles: {
          p50: getPercentile(processingTimes, 50),
          p90: getPercentile(processingTimes, 90),
          p95: getPercentile(processingTimes, 95),
          p99: getPercentile(processingTimes, 99)
        },
        queueTimePercentiles: {
          p50: getPercentile(queueTimes, 50),
          p90: getPercentile(queueTimes, 90),
          p95: getPercentile(queueTimes, 95),
          p99: getPercentile(queueTimes, 99)
        }
      }
    };
  }

  /**
   * Archive completed jobs older than specified age
   */
  archiveOldJobs(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - maxAge);
    let archived = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.createdAt < cutoff
      ) {
        this.jobHistory.set(jobId, job);
        this.jobs.delete(jobId);
        archived++;
      }
    }

    // Limit history size
    if (this.jobHistory.size > this.MAX_HISTORY_SIZE) {
      const historyArray = Array.from(this.jobHistory.entries())
        .sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime());
      
      this.jobHistory.clear();
      historyArray.slice(0, this.MAX_HISTORY_SIZE).forEach(([id, job]) => {
        this.jobHistory.set(id, job);
      });
    }

    this.updateMetrics();
    return archived;
  }

  private recordMemoryUsage(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const memoryUsage = process.memoryUsage();
    job.memoryUsage.push({
      timestamp: new Date(),
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers
    });

    // Keep only last 100 memory samples per job
    if (job.memoryUsage.length > 100) {
      job.memoryUsage = job.memoryUsage.slice(-100);
    }
  }

  private moveToHistory(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobHistory.set(jobId, job);
      this.jobs.delete(jobId);
    }
  }

  private updateMetrics(): void {
    const activeJobs = Array.from(this.jobs.values());
    const allJobs = [
      ...activeJobs,
      ...Array.from(this.jobHistory.values())
    ];

    const completedJobs = allJobs.filter(job => job.status === 'completed');
    const failedJobs = allJobs.filter(job => job.status === 'failed');
    
    const processingTimes = completedJobs
      .filter(job => job.totalProcessingTime)
      .map(job => job.totalProcessingTime!);
    
    const queueTimes = completedJobs
      .filter(job => job.totalQueueTime)
      .map(job => job.totalQueueTime!);

    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentJobs = allJobs.filter(job => job.createdAt.getTime() > oneHourAgo);

    this.metrics = {
      totalJobs: allJobs.length,
      activeJobs: activeJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      avgProcessingTime: processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0,
      avgQueueTime: queueTimes.length > 0 
        ? queueTimes.reduce((a, b) => a + b, 0) / queueTimes.length 
        : 0,
      successRate: allJobs.length > 0 
        ? (completedJobs.length / allJobs.length) * 100 
        : 0,
      throughput: recentJobs.length,
      currentLoad: (activeJobs.length / this.MAX_ACTIVE_JOBS) * 100,
      resourceUtilization: {
        memory: this.getCurrentMemoryUtilization(),
        cpu: 0 // TODO: Implement CPU monitoring
      }
    };
  }

  private getCurrentMemoryUtilization(): number {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    return totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.archiveOldJobs();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Shutdown the tracker and cleanup resources
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private calculateMetrics(): JobMetrics {
    return {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      avgProcessingTime: 0,
      avgQueueTime: 0,
      successRate: 0,
      throughput: 0,
      currentLoad: 0,
      resourceUtilization: {
        memory: 0,
        cpu: 0
      }
    };
  }
}

// Export singleton instance
export const videoStatusTracker = VideoStatusTracker.getInstance(); 
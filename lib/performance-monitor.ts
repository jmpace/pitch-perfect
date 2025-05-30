// Performance monitoring system for video processing pipeline
import { VideoProcessingJob } from './video-processor';

export interface PerformanceMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    tempDirSize: number;
    availableSpace: number;
  };
  processing: {
    activeJobs: number;
    queuedJobs: number;
    avgProcessingTime: number;
    throughput: number; // jobs per minute
  };
}

export interface JobPerformanceData {
  jobId: string;
  startTime: number;
  endTime?: number;
  stages: {
    metadata: { start: number; end?: number; duration?: number };
    frameExtraction: { start: number; end?: number; duration?: number };
    audioExtraction: { start: number; end?: number; duration?: number };
    upload: { start: number; end?: number; duration?: number };
  };
  resources: {
    peakMemory: number;
    avgMemory: number;
    cpuTime: number;
    diskUsage: number;
  };
  videoMetrics: {
    duration: number;
    resolution: string;
    fileSize: number;
    framesExtracted: number;
    audioExtracted: boolean;
  };
}

export class PerformanceMonitor {
  private static jobMetrics = new Map<string, JobPerformanceData>();
  private static systemMetrics: PerformanceMetrics[] = [];
  private static maxHistorySize = 1000;
  private static metricsInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring system performance
   */
  static startMonitoring(intervalMs: number = 5000): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
  }

  /**
   * Stop monitoring system performance
   */
  static stopMonitoring(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Start tracking a processing job
   */
  static startJobTracking(jobId: string, videoMetrics: Partial<JobPerformanceData['videoMetrics']>): void {
    const now = Date.now();
    
    this.jobMetrics.set(jobId, {
      jobId,
      startTime: now,
      stages: {
        metadata: { start: now },
        frameExtraction: { start: 0 },
        audioExtraction: { start: 0 },
        upload: { start: 0 }
      },
      resources: {
        peakMemory: 0,
        avgMemory: 0,
        cpuTime: 0,
        diskUsage: 0
      },
      videoMetrics: {
        duration: videoMetrics.duration || 0,
        resolution: videoMetrics.resolution || '',
        fileSize: videoMetrics.fileSize || 0,
        framesExtracted: videoMetrics.framesExtracted || 0,
        audioExtracted: videoMetrics.audioExtracted || false
      }
    });
  }

  /**
   * Update job stage timing
   */
  static updateJobStage(
    jobId: string, 
    stage: keyof JobPerformanceData['stages'], 
    event: 'start' | 'end'
  ): void {
    const jobData = this.jobMetrics.get(jobId);
    if (!jobData) return;

    const now = Date.now();
    
    if (event === 'start') {
      jobData.stages[stage].start = now;
    } else {
      jobData.stages[stage].end = now;
      jobData.stages[stage].duration = now - jobData.stages[stage].start;
    }
  }

  /**
   * Complete job tracking
   */
  static completeJobTracking(jobId: string): JobPerformanceData | undefined {
    const jobData = this.jobMetrics.get(jobId);
    if (!jobData) return undefined;

    jobData.endTime = Date.now();
    
    // Calculate averages and cleanup
    const totalDuration = jobData.endTime - jobData.startTime;
    jobData.resources.avgMemory = jobData.resources.avgMemory || 0;
    
    return jobData;
  }

  /**
   * Update resource usage for a job
   */
  static updateJobResources(jobId: string, resources: Partial<JobPerformanceData['resources']>): void {
    const jobData = this.jobMetrics.get(jobId);
    if (!jobData) return;

    if (resources.peakMemory && resources.peakMemory > jobData.resources.peakMemory) {
      jobData.resources.peakMemory = resources.peakMemory;
    }
    
    if (resources.avgMemory) {
      jobData.resources.avgMemory = (jobData.resources.avgMemory + resources.avgMemory) / 2;
    }
    
    if (resources.cpuTime) {
      jobData.resources.cpuTime += resources.cpuTime;
    }
    
    if (resources.diskUsage) {
      jobData.resources.diskUsage = Math.max(jobData.resources.diskUsage, resources.diskUsage);
    }
  }

  /**
   * Collect current system metrics
   */
  private static collectSystemMetrics(): void {
    const os = require('os');
    const fs = require('fs');
    
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics: PerformanceMetrics = {
        cpu: {
          usage: this.getCpuUsage(),
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        },
        memory: {
          used: memoryUsage.rss,
          total: os.totalmem(),
          percentage: (memoryUsage.rss / os.totalmem()) * 100,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        },
        disk: {
          tempDirSize: this.getTempDirSize(),
          availableSpace: this.getAvailableDiskSpace()
        },
        processing: {
          activeJobs: Array.from(this.jobMetrics.values()).filter(job => !job.endTime).length,
          queuedJobs: 0, // Will be updated by video processor
          avgProcessingTime: this.calculateAvgProcessingTime(),
          throughput: this.calculateThroughput()
        }
      };

      this.systemMetrics.push(metrics);
      
      // Keep only recent metrics
      if (this.systemMetrics.length > this.maxHistorySize) {
        this.systemMetrics = this.systemMetrics.slice(-this.maxHistorySize);
      }
    } catch (error) {
      console.warn('Failed to collect system metrics:', error);
    }
  }

  /**
   * Get current system performance metrics
   */
  static getCurrentMetrics(): PerformanceMetrics | null {
    return this.systemMetrics.length > 0 ? this.systemMetrics[this.systemMetrics.length - 1] : null;
  }

  /**
   * Get historical performance metrics
   */
  static getHistoricalMetrics(limit?: number): PerformanceMetrics[] {
    const metrics = this.systemMetrics;
    return limit ? metrics.slice(-limit) : metrics;
  }

  /**
   * Get job performance data
   */
  static getJobMetrics(jobId?: string): JobPerformanceData[] | JobPerformanceData | undefined {
    if (jobId) {
      return this.jobMetrics.get(jobId);
    }
    return Array.from(this.jobMetrics.values());
  }

  /**
   * Calculate optimal concurrency based on system resources
   */
  static getOptimalConcurrency(): number {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return 3; // Default fallback

    const memoryUsagePercent = currentMetrics.memory.percentage;
    const cpuUsage = currentMetrics.cpu.usage;
    const cores = currentMetrics.cpu.cores;

    // Conservative scaling based on resource availability
    let optimalConcurrency = cores;

    // Reduce concurrency if memory usage is high
    if (memoryUsagePercent > 80) {
      optimalConcurrency = Math.max(1, Math.floor(optimalConcurrency * 0.5));
    } else if (memoryUsagePercent > 60) {
      optimalConcurrency = Math.max(2, Math.floor(optimalConcurrency * 0.75));
    }

    // Reduce concurrency if CPU usage is high
    if (cpuUsage > 80) {
      optimalConcurrency = Math.max(1, Math.floor(optimalConcurrency * 0.6));
    }

    return Math.min(optimalConcurrency, 6); // Cap at 6 concurrent jobs
  }

  /**
   * Get performance recommendations
   */
  static getPerformanceRecommendations(): string[] {
    const currentMetrics = this.getCurrentMetrics();
    const recommendations: string[] = [];

    if (!currentMetrics) {
      recommendations.push('Enable performance monitoring to get recommendations');
      return recommendations;
    }

    if (currentMetrics.memory.percentage > 80) {
      recommendations.push('High memory usage detected - consider reducing concurrent jobs');
    }

    if (currentMetrics.cpu.usage > 80) {
      recommendations.push('High CPU usage detected - optimize FFmpeg parameters');
    }

    const avgProcessingTime = this.calculateAvgProcessingTime();
    if (avgProcessingTime > 300000) { // 5 minutes
      recommendations.push('Long processing times detected - consider implementing video chunking');
    }

    if (currentMetrics.disk.tempDirSize > 1024 * 1024 * 1024) { // 1GB
      recommendations.push('Large temporary directory size - improve cleanup routines');
    }

    return recommendations;
  }

  // Helper methods
  private static getCpuUsage(): number {
    const os = require('os');
    const cpus = os.cpus();
    
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    
    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }
    
    const total = user + nice + sys + idle + irq;
    return ((total - idle) / total) * 100;
  }

  private static getTempDirSize(): number {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    
    try {
      const tmpDir = os.tmpdir();
      let totalSize = 0;
      
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        if (file.startsWith('frames_') || file.startsWith('audio_')) {
          const filePath = path.join(tmpDir, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.isDirectory() ? this.getDirectorySize(filePath) : stats.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  private static getDirectorySize(dirPath: string): number {
    const fs = require('fs');
    const path = require('path');
    
    try {
      let totalSize = 0;
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.isDirectory() ? this.getDirectorySize(filePath) : stats.size;
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  private static getAvailableDiskSpace(): number {
    const fs = require('fs');
    
    try {
      const stats = fs.statSync(process.cwd());
      return stats.free || 0;
    } catch (error) {
      return 0;
    }
  }

  private static calculateAvgProcessingTime(): number {
    const completedJobs = Array.from(this.jobMetrics.values())
      .filter(job => job.endTime)
      .map(job => job.endTime! - job.startTime);
    
    if (completedJobs.length === 0) return 0;
    
    return completedJobs.reduce((sum, time) => sum + time, 0) / completedJobs.length;
  }

  private static calculateThroughput(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentJobs = Array.from(this.jobMetrics.values())
      .filter(job => job.endTime && job.endTime >= oneMinuteAgo);
    
    return recentJobs.length;
  }
} 
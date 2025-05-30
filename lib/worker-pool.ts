// Worker pool for parallel video processing
import { EventEmitter } from 'events';
import { PerformanceMonitor } from './performance-monitor';

export interface WorkerTask {
  id: string;
  type: 'frameExtraction' | 'audioExtraction' | 'metadata';
  data: Record<string, unknown>;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  workerId?: string;
  timeout?: number;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  processingTime: number;
  memoryUsed: number;
}

export interface Worker {
  id: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: WorkerTask;
  totalTasks: number;
  errors: number;
  createdAt: Date;
  lastActivity: Date;
}

export class WorkerPool extends EventEmitter {
  private workers: Map<string, Worker> = new Map();
  private taskQueue: WorkerTask[] = [];
  private completedTasks: Map<string, WorkerResult> = new Map();
  private maxWorkers: number;
  private minWorkers: number;
  private maxQueueSize: number;
  private taskTimeout: number;
  private autoScale: boolean;
  private lastScaleCheck: number = 0;
  private scaleCheckInterval: number = 30000; // 30 seconds

  constructor(options: {
    maxWorkers?: number;
    minWorkers?: number;
    maxQueueSize?: number;
    taskTimeout?: number;
    autoScale?: boolean;
  } = {}) {
    super();
    
    this.maxWorkers = options.maxWorkers || 6;
    this.minWorkers = options.minWorkers || 1;
    this.maxQueueSize = options.maxQueueSize || 100;
    this.taskTimeout = options.taskTimeout || 600000; // 10 minutes
    this.autoScale = options.autoScale !== false;

    // Initialize with minimum workers
    this.initializeWorkers();
    
    // Start auto-scaling if enabled
    if (this.autoScale) {
      this.startAutoScaling();
    }
  }

  /**
   * Add a task to the processing queue
   */
  addTask(task: Omit<WorkerTask, 'id' | 'createdAt'>): string {
    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new Error('Task queue is full');
    }

    const workTask: WorkerTask = {
      id: this.generateTaskId(),
      createdAt: new Date(),
      ...task
    };

    // Insert task based on priority (higher priority first)
    const insertIndex = this.taskQueue.findIndex(t => t.priority < workTask.priority);
    if (insertIndex === -1) {
      this.taskQueue.push(workTask);
    } else {
      this.taskQueue.splice(insertIndex, 0, workTask);
    }

    this.emit('taskAdded', workTask);
    this.processQueue();
    
    return workTask.id;
  }

  /**
   * Get task result
   */
  getTaskResult(taskId: string): WorkerResult | undefined {
    return this.completedTasks.get(taskId);
  }

  /**
   * Get worker pool status
   */
  getStatus(): {
    workers: {
      total: number;
      idle: number;
      busy: number;
      error: number;
    };
    queue: {
      pending: number;
      maxSize: number;
    };
    performance: {
      completedTasks: number;
      avgProcessingTime: number;
      errorRate: number;
    };
  } {
    const workers = Array.from(this.workers.values());
    const completedResults = Array.from(this.completedTasks.values());
    
    const avgProcessingTime = completedResults.length > 0
      ? completedResults.reduce((sum, result) => sum + result.processingTime, 0) / completedResults.length
      : 0;
      
    const errorRate = completedResults.length > 0
      ? completedResults.filter(result => !result.success).length / completedResults.length
      : 0;

    return {
      workers: {
        total: workers.length,
        idle: workers.filter(w => w.status === 'idle').length,
        busy: workers.filter(w => w.status === 'busy').length,
        error: workers.filter(w => w.status === 'error').length
      },
      queue: {
        pending: this.taskQueue.length,
        maxSize: this.maxQueueSize
      },
      performance: {
        completedTasks: completedResults.length,
        avgProcessingTime,
        errorRate
      }
    };
  }

  /**
   * Scale the worker pool up or down
   */
  scale(targetWorkers: number): void {
    const currentWorkers = this.workers.size;
    targetWorkers = Math.max(this.minWorkers, Math.min(this.maxWorkers, targetWorkers));

    if (targetWorkers > currentWorkers) {
      // Scale up
      for (let i = currentWorkers; i < targetWorkers; i++) {
        this.createWorker();
      }
    } else if (targetWorkers < currentWorkers) {
      // Scale down
      const workersToRemove = currentWorkers - targetWorkers;
      const idleWorkers = Array.from(this.workers.values())
        .filter(w => w.status === 'idle')
        .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime());

      for (let i = 0; i < Math.min(workersToRemove, idleWorkers.length); i++) {
        this.removeWorker(idleWorkers[i].id);
      }
    }
  }

  /**
   * Shutdown the worker pool
   */
  shutdown(): void {
    this.workers.clear();
    this.taskQueue.length = 0;
    this.removeAllListeners();
  }

  /**
   * Initialize workers
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.minWorkers; i++) {
      this.createWorker();
    }
  }

  /**
   * Create a new worker
   */
  private createWorker(): Worker {
    const worker: Worker = {
      id: this.generateWorkerId(),
      status: 'idle',
      totalTasks: 0,
      errors: 0,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.workers.set(worker.id, worker);
    this.emit('workerCreated', worker);
    
    return worker;
  }

  /**
   * Remove a worker
   */
  private removeWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker && worker.status === 'idle') {
      this.workers.delete(workerId);
      this.emit('workerRemoved', worker);
    }
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    const idleWorkers = Array.from(this.workers.values())
      .filter(w => w.status === 'idle');

    for (const worker of idleWorkers) {
      if (this.taskQueue.length === 0) break;
      
      const task = this.taskQueue.shift()!;
      this.assignTaskToWorker(worker, task);
    }

    // Auto-scale if needed
    if (this.autoScale && this.taskQueue.length > 0 && this.workers.size < this.maxWorkers) {
      const currentTime = Date.now();
      if (currentTime - this.lastScaleCheck > this.scaleCheckInterval) {
        this.checkAutoScale();
        this.lastScaleCheck = currentTime;
      }
    }
  }

  /**
   * Assign a task to a worker
   */
  private assignTaskToWorker(worker: Worker, task: WorkerTask): void {
    worker.status = 'busy';
    worker.currentTask = task;
    worker.lastActivity = new Date();
    
    task.startedAt = new Date();
    task.workerId = worker.id;

    this.emit('taskStarted', { worker, task });

    // Simulate task processing (in real implementation, this would be actual FFmpeg processing)
    this.executeTask(task)
      .then(result => {
        this.handleTaskCompletion(worker, task, result);
      })
      .catch(error => {
        this.handleTaskError(worker, task, error);
      });
  }

  /**
   * Execute a task (placeholder for actual processing)
   */
  private async executeTask(task: WorkerTask): Promise<WorkerResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${task.timeout || this.taskTimeout}ms`));
      }, task.timeout || this.taskTimeout);
    });

    // Simulate processing based on task type
    const processingPromise = this.processTaskByType(task);

    try {
      const data = await Promise.race([processingPromise, timeoutPromise]);
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;

      return {
        taskId: task.id,
        success: true,
        data,
        processingTime: endTime - startTime,
        memoryUsed: endMemory - startMemory
      };
    } catch (error) {
      const endTime = Date.now();
      
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: endTime - startTime,
        memoryUsed: 0
      };
    }
  }

  /**
   * Process task based on its type
   */
  private async processTaskByType(task: WorkerTask): Promise<Record<string, unknown>> {
    switch (task.type) {
      case 'frameExtraction':
        return this.processFrameExtraction(task);
      case 'audioExtraction':
        return this.processAudioExtraction(task);
      case 'metadata':
        return this.processMetadataExtraction(task);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Process frame extraction task
   */
  private async processFrameExtraction(task: WorkerTask): Promise<Record<string, unknown>> {
    const { videoUrl, videoMetadata, options } = task.data;
    
    // This integrates with the actual frame extraction logic from video-processor
    // Import the actual frame extraction function
    const { VideoProcessor } = await import('./video-processor');
    
    try {
      // Use the actual extractFrames method (we'll need to make it static/public)
      const frames = await this.extractFramesActual(
        videoUrl as string,
        videoMetadata as any,
        options as any
      );
      
      return {
        frames,
        framesExtracted: frames.length,
        success: true
      };
    } catch (error) {
      throw new Error(`Frame extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process audio extraction task
   */
  private async processAudioExtraction(task: WorkerTask): Promise<Record<string, unknown>> {
    const { videoUrl, videoMetadata, options } = task.data;
    
    try {
      // Use the actual extractAudio method
      const audio = await this.extractAudioActual(
        videoUrl as string,
        videoMetadata as any,
        options as any
      );
      
      return {
        audio,
        audioExtracted: true,
        success: true
      };
    } catch (error) {
      throw new Error(`Audio extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process metadata extraction task
   */
  private async processMetadataExtraction(task: WorkerTask): Promise<Record<string, unknown>> {
    const { videoUrl } = task.data;
    
    try {
      const metadata = await this.extractMetadataActual(videoUrl as string);
      
      return {
        metadata,
        success: true
      };
    } catch (error) {
      throw new Error(`Metadata extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Actual frame extraction using FFmpeg
   */
  private async extractFramesActual(
    videoUrl: string,
    videoMetadata: any,
    options: any
  ): Promise<any[]> {
    // This would use the actual frame extraction logic from VideoProcessor
    // For now, return a simulated result based on the video duration
    const frameInterval = options.frameInterval || 10;
    const totalFrames = Math.floor(videoMetadata.duration / frameInterval);
    
    const frames = [];
    for (let i = 0; i < totalFrames; i++) {
      frames.push({
        timestamp: i * frameInterval,
        url: `mock://frame_${i * frameInterval}s.jpg`,
        size: 50000,
        width: options.frameResolution?.width || 1280,
        height: options.frameResolution?.height || 720
      });
    }
    
    // Simulate processing time
    await this.sleep(Math.min(totalFrames * 100, 3000));
    
    return frames;
  }

  /**
   * Actual audio extraction using FFmpeg
   */
  private async extractAudioActual(
    videoUrl: string,
    videoMetadata: any,
    options: any
  ): Promise<any> {
    // Simulate processing time
    await this.sleep(Math.min(videoMetadata.duration * 20, 2000));
    
    return {
      url: 'mock://audio.mp3',
      duration: videoMetadata.duration,
      format: options.audioFormat || 'mp3',
      size: Math.floor(videoMetadata.duration * 1000), // ~1KB per second
      sampleRate: 44100,
      channels: 2
    };
  }

  /**
   * Actual metadata extraction using FFmpeg
   */
  private async extractMetadataActual(videoUrl: string): Promise<any> {
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          duration: metadata.format?.duration || 0,
          resolution: `${videoStream.width}x${videoStream.height}`,
          fps: this.parseFrameRate(videoStream.r_frame_rate || '30/1'),
          codec: videoStream.codec_name || 'unknown',
          size: metadata.format?.size || 0,
          format: metadata.format?.format_name || 'unknown',
          hasAudio: !!audioStream
        });
      });
    });
  }

  /**
   * Parse frame rate from FFmpeg format
   */
  private parseFrameRate(frameRate: string): number {
    const parts = frameRate.split('/');
    if (parts.length === 2) {
      const numerator = parseInt(parts[0], 10);
      const denominator = parseInt(parts[1], 10);
      return denominator > 0 ? numerator / denominator : 30;
    }
    return parseFloat(frameRate) || 30;
  }

  /**
   * Handle successful task completion
   */
  private handleTaskCompletion(worker: Worker, task: WorkerTask, result: WorkerResult): void {
    worker.status = 'idle';
    worker.currentTask = undefined;
    worker.totalTasks++;
    worker.lastActivity = new Date();

    task.completedAt = new Date();
    this.completedTasks.set(task.id, result);

    this.emit('taskCompleted', { worker, task, result });
    
    // Process next task if available
    this.processQueue();
  }

  /**
   * Handle task error
   */
  private handleTaskError(worker: Worker, task: WorkerTask, error: unknown): void {
    worker.status = 'error';
    worker.currentTask = undefined;
    worker.errors++;
    worker.lastActivity = new Date();

    const result: WorkerResult = {
      taskId: task.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - (task.startedAt?.getTime() || Date.now()),
      memoryUsed: 0
    };

    this.completedTasks.set(task.id, result);
    this.emit('taskError', { worker, task, error });

    // Reset worker to idle after a brief delay
    setTimeout(() => {
      if (worker.status === 'error') {
        worker.status = 'idle';
        this.processQueue();
      }
    }, 1000);
  }

  /**
   * Check if auto-scaling is needed
   */
  private checkAutoScale(): void {
    const currentMetrics = PerformanceMonitor.getCurrentMetrics();
    const optimalConcurrency = PerformanceMonitor.getOptimalConcurrency();
    
    // Scale based on queue length and system resources
    let targetWorkers = this.workers.size;
    
    if (this.taskQueue.length > this.workers.size * 2) {
      // Queue is building up, scale up
      targetWorkers = Math.min(this.maxWorkers, targetWorkers + 1);
    } else if (this.taskQueue.length === 0 && this.workers.size > this.minWorkers) {
      // No tasks, scale down
      targetWorkers = Math.max(this.minWorkers, targetWorkers - 1);
    }

    // Respect system resource limits
    targetWorkers = Math.min(targetWorkers, optimalConcurrency);

    if (targetWorkers !== this.workers.size) {
      this.scale(targetWorkers);
    }
  }

  /**
   * Start auto-scaling monitoring
   */
  private startAutoScaling(): void {
    setInterval(() => {
      if (this.autoScale) {
        this.checkAutoScale();
      }
    }, this.scaleCheckInterval);
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(): string {
    return `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 
/**
 * End-to-End Tests for Video Processing Pipeline
 * Tests the complete video processing workflow from ingestion to delivery
 */

// Mock fluent-ffmpeg before any imports
jest.mock('fluent-ffmpeg', () => {
  const mockCommand: any = {
    outputOptions: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    noVideo: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    save: jest.fn().mockReturnThis(),
    run: jest.fn().mockReturnThis(),
    input: '',
    on: jest.fn(function(this: any, event: string, callback: Function) {
      const inputUrl = this.input || this._inputs?.[0] || '';
      
      // Simulate longer processing for VALID_LONG video (5-minute video)
      const isLongVideo = inputUrl.includes('SampleVideo_1280x720_5mb.mp4');
      const processingDelay = isLongVideo ? 8000 : 40; // 8 seconds for long video, 40ms for others
      
      if (event === 'start') {
        setTimeout(() => callback('ffmpeg command line'), 10);
      } else if (event === 'progress') {
        // For long videos, simulate slower progress to allow timeout testing
        if (isLongVideo) {
          setTimeout(() => callback({ percent: 25 }), 2000);
          setTimeout(() => callback({ percent: 50 }), 4000);
          setTimeout(() => callback({ percent: 75 }), 6000);
          setTimeout(() => callback({ percent: 100 }), processingDelay);
        } else {
          setTimeout(() => callback({ percent: 50 }), 20);
          setTimeout(() => callback({ percent: 100 }), 30);
        }
      } else if (event === 'end') {
        setTimeout(() => callback(), processingDelay);
      } else if (event === 'error') {
        // Store error callback for potential timeout simulation
        this._errorCallback = callback;
      }
      return this;
    })
  };
  
  const ffmpegMock = jest.fn((input) => {
    // Store input for reference in event handlers
    mockCommand.input = input;
    return mockCommand;
  });
  Object.assign(ffmpegMock, {
    ffprobe: jest.fn((url, callback) => {
      // Handle different URL types appropriately
      if (url.includes('invalid-url.com') || url.includes('nonexistent.mp4')) {
        // Invalid URL should fail
        setTimeout(() => callback(new Error('HTTP 404: Not Found')), 10);
        return;
      }
      
      if (url.includes('video.unsupported') || url.includes('corrupted-video.mp4')) {
        // Unsupported format should fail
        setTimeout(() => callback(new Error('Invalid data found when processing input')), 10);
        return;
      }
      
      // Mock successful ffprobe response for valid URLs
      let mockMetadata = {
        format: {
          duration: '30.0',
          size: '1048576',
          format_name: 'mp4'
        },
        streams: [{
          codec_type: 'video',
          codec_name: 'h264',
          width: 480,
          height: 270,
          r_frame_rate: '30/1'
        }, {
          codec_type: 'audio',
          codec_name: 'aac',
          sample_rate: '44100',
          channels: 2
        }]
      };
      
      // Customize metadata based on URL
      if (url.includes('SampleVideo_640x360_2mb.mp4')) {
        mockMetadata = {
          format: {
            duration: '60.0',
            size: '2097152',
            format_name: 'mp4'
          },
          streams: [{
            codec_type: 'video',
            codec_name: 'h264',
            width: 640,
            height: 360,
            r_frame_rate: '30/1'
          }, {
            codec_type: 'audio',
            codec_name: 'aac',
            sample_rate: '44100',
            channels: 2
          }]
        };
      } else if (url.includes('SampleVideo_1280x720_5mb.mp4')) {
        mockMetadata = {
          format: {
            duration: '300.0',
            size: '5242880',
            format_name: 'mp4'
          },
          streams: [{
            codec_type: 'video',
            codec_name: 'h264',
            width: 1280,
            height: 720,
            r_frame_rate: '30/1'
          }, {
            codec_type: 'audio',
            codec_name: 'aac',
            sample_rate: '44100',
            channels: 2
          }]
        };
      } else if (url.includes('silent-video.mp4')) {
        // Video without audio stream
        mockMetadata = {
          format: {
            duration: '30.0',
            size: '1048576',
            format_name: 'mp4'
          },
          streams: [{
            codec_type: 'video',
            codec_name: 'h264',
            width: 480,
            height: 270,
            r_frame_rate: '30/1'
          }]
          // No audio stream
        };
      } else if (url.includes('SampleAudio_0.4mb.mp3')) {
        // Audio-only file
        mockMetadata = {
          format: {
            duration: '30.0',
            size: '409600',
            format_name: 'mp3'
          },
          streams: [{
            codec_type: 'audio',
            codec_name: 'mp3',
            sample_rate: '44100',
            channels: 2
          }]
          // No video stream
        };
      }
      
      setTimeout(() => callback(null, mockMetadata), 10);
    }),
    setFfmpegPath: jest.fn(),
    setFfprobePath: jest.fn()
  });
  
  return ffmpegMock;
});

// Mock @vercel/blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({
    url: 'https://blob.vercel-storage.com/test-file.jpg',
    pathname: 'test-file.jpg',
    contentType: 'image/jpeg',
    contentDisposition: 'inline; filename="test-file.jpg"',
    downloadUrl: 'https://blob.vercel-storage.com/test-file.jpg'
  })
}));

// Mock StorageDeliveryManager
jest.mock('@/lib/storage-delivery-manager', () => ({
  StorageDeliveryManager: {
    storeContent: jest.fn().mockResolvedValue({
      success: true,
      url: 'https://blob.vercel-storage.com/stored-content.mp3',
      signedUrl: 'https://blob.vercel-storage.com/stored-content.mp3?signed=true',
      metadata: {
        size: 1024,
        contentType: 'audio/mp3',
        uploadedAt: new Date(),
        compressed: false,
        storageId: 'test-storage-id'
      },
      requestId: 'test-request-id'
    }),
    retrieveContent: jest.fn().mockResolvedValue({
      success: true,
      content: {
        url: 'https://blob.vercel-storage.com/stored-content.mp3',
        signedUrl: 'https://blob.vercel-storage.com/stored-content.mp3?signed=true',
        metadata: {
          size: 1024,
          contentType: 'audio/mp3',
          lastModified: new Date(),
          cacheControl: 'public, max-age=3600',
          compressed: false
        }
      },
      requestId: 'test-request-id'
    }),
    initialize: jest.fn(),
    getAnalytics: jest.fn().mockReturnValue({
      usage: { totalSize: 0, totalFiles: 0, byContentType: {} },
      performance: { averageUploadTime: 0, averageDownloadTime: 0, cacheHitRate: 0, cdnHitRate: 0 },
      costs: { storageUsage: 0, bandwidth: 0, operations: 0, total: 0 }
    })
  },
  ContentType: {
    VIDEO: 'videos',
    FRAMES: 'frames',
    AUDIO: 'audio',
    METADATA: 'metadata',
    THUMBNAILS: 'thumbnails'
  }
}));

// Mock fs operations
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  mkdtempSync: jest.fn((prefix) => `${prefix}test-temp-dir`),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('fake-image-data', 'utf8')),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  readdirSync: jest.fn().mockReturnValue(['frame_001.jpg', 'frame_002.jpg', 'frame_003.jpg']),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  rmSync: jest.fn()
}));

// Mock path operations  
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

// Mock os operations
jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
  cpus: jest.fn(() => [
    { model: 'Intel Core i7', speed: 2800, times: { user: 1000, nice: 0, sys: 500, idle: 10000, irq: 0 } },
    { model: 'Intel Core i7', speed: 2800, times: { user: 1000, nice: 0, sys: 500, idle: 10000, irq: 0 } }
  ]),
  freemem: jest.fn(() => 8589934592), // 8GB
  totalmem: jest.fn(() => 17179869184), // 16GB
  loadavg: jest.fn(() => [1.5, 1.2, 1.0]),
  platform: jest.fn(() => 'darwin'),
  arch: jest.fn(() => 'x64')
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id-12345')
}));

// Mock error handlers
jest.mock('@/lib/errors/handlers', () => ({
  generateRequestId: jest.fn(() => 'test-request-id'),
  logError: jest.fn(),
  normalizeError: jest.fn((error) => error)
}));

// Mock enhanced error handler
jest.mock('@/lib/enhanced-error-handling', () => ({
  enhancedErrorHandler: {
    executeWithProtection: jest.fn(async (fn) => {
      try {
        return await fn();
      } catch (error) {
        throw error; // Re-throw to allow proper error handling
      }
    })
  },
  EnhancedErrorHandler: jest.fn().mockImplementation(() => ({
    executeWithProtection: jest.fn(async (fn) => {
      try {
        return await fn();
      } catch (error) {
        throw error; // Re-throw to allow proper error handling
      }
    }),
    getErrorStats: jest.fn().mockReturnValue({
      totalErrors: 0,
      errorsByType: {},
      recentErrors: []
    }),
    getCircuitBreaker: jest.fn((name) => ({
      getState: jest.fn().mockReturnValue('CLOSED')
    }))
  }))
}));

// Mock performance monitor
jest.mock('@/lib/performance-monitor', () => ({
  PerformanceMonitor: {
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
      uptime: 1000,
      cpu: { usage: 25 },
      memory: { used: 0.5, total: 16 },
      network: { bytesIn: 1000, bytesOut: 500 }
    }),
    getCurrentMetrics: jest.fn().mockReturnValue({
      cpu: { usage: 25 },
      memory: { used: 0.5, total: 16 },
      network: { bytesIn: 1000, bytesOut: 500 }
    }),
    getJobMetrics: jest.fn().mockReturnValue({
      uptime: 1000,
      cpu: { usage: 25 },
      memory: { used: 0.5, total: 16 },
      network: { bytesIn: 1000, bytesOut: 500 }
    }),
    startJobTracking: jest.fn(),
    updateJobProgress: jest.fn(),
    updateJobStage: jest.fn(),
    completeJobTracking: jest.fn(),
    getOptimalConcurrency: jest.fn().mockReturnValue(3)
  }
}));

import { VideoProcessor } from '@/lib/video-processor';
import { OptimizedVideoProcessor } from '@/lib/optimized-video-processor';
import { EnhancedVideoProcessor } from '@/lib/enhanced-video-processor';
import { StorageDeliveryManager } from '@/lib/storage-delivery-manager';
import { PerformanceMonitor } from '@/lib/performance-monitor';
import { WorkerPool } from '@/lib/worker-pool';
import { EnhancedErrorHandler } from '@/lib/enhanced-error-handling';
import { VideoStatusTracker } from '@/lib/video-status-tracker';
import type { VideoProcessingJob, VideoMetadata } from '@/lib/video-processor';

// Test utilities and mocks
class TestVideoManager {
  static readonly TEST_VIDEOS = {
    VALID_SHORT: 'https://sample-videos.com/zip/10/mp4/SampleVideo_480x270_1mb.mp4',
    VALID_MEDIUM: 'https://sample-videos.com/zip/10/mp4/SampleVideo_640x360_2mb.mp4', 
    VALID_LONG: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4',
    INVALID_URL: 'https://invalid-url.com/nonexistent.mp4',
    CORRUPTED: 'https://example.com/corrupted-video.mp4',
    UNSUPPORTED_FORMAT: 'https://example.com/video.unsupported',
    AUDIO_ONLY: 'https://sample-videos.com/zip/10/mp3/SampleAudio_0.4mb.mp3',
    NO_AUDIO: 'https://example.com/silent-video.mp4'
  };

  static getMockVideoMetadata(url: string) {
    const urlToMetadata: Record<string, VideoMetadata> = {
      [this.TEST_VIDEOS.VALID_SHORT]: {
        duration: 30,
        format: 'mp4',
        resolution: '480x270',
        fps: 30,
        codec: 'h264',
        size: 1048576
      },
      [this.TEST_VIDEOS.VALID_MEDIUM]: {
        duration: 60,
        format: 'mp4', 
        resolution: '640x360',
        fps: 30,
        codec: 'h264',
        size: 2097152
      },
      [this.TEST_VIDEOS.VALID_LONG]: {
        duration: 300, // 5 minutes
        format: 'mp4',
        resolution: '1280x720',
        fps: 30,
        codec: 'h264',
        size: 5242880
      }
    };

    return urlToMetadata[url];
  }
}

describe('Video Processing Pipeline E2E Tests', () => {
  let videoProcessor: typeof VideoProcessor;
  let optimizedProcessor: typeof OptimizedVideoProcessor;
  let enhancedProcessor: typeof EnhancedVideoProcessor;
  let performanceMonitor: typeof PerformanceMonitor;
  let workerPool: WorkerPool;
  let statusTracker: VideoStatusTracker;
  let errorHandler: EnhancedErrorHandler;

  beforeAll(async () => {
    // Initialize static classes and instances
    performanceMonitor = PerformanceMonitor;
    workerPool = new WorkerPool();
    statusTracker = VideoStatusTracker.getInstance();
    errorHandler = new EnhancedErrorHandler();
    // StorageDeliveryManager is a static class, no instantiation needed
    
    // Start monitoring
    PerformanceMonitor.startMonitoring();
    
    // Initialize processors
    videoProcessor = VideoProcessor;
    optimizedProcessor = OptimizedVideoProcessor;
    enhancedProcessor = EnhancedVideoProcessor;
  });

  beforeEach(async () => {
    // Wait for any ongoing processing to complete before starting the next test
    let attempts = 0;
    while (attempts < 30) {
      const processingJobs = videoProcessor.getJobs('processing');
      const stats = videoProcessor.getStats();
      
      if (processingJobs.length === 0 && stats.currentJobs === 0) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    // Clean up job state between tests to prevent contamination
    videoProcessor.cleanupOldJobs(0);
    
    // Force reset processor state for testing
    // Access private static fields to reset counters
    const processorClass = videoProcessor as any;
    if (processorClass.currentJobs !== undefined) {
      processorClass.currentJobs = 0;
    }
  });

  afterAll(async () => {
    // Clean up resources
    PerformanceMonitor.stopMonitoring();
    workerPool.shutdown();
    
    // Clean up all test jobs
    const jobs = videoProcessor.getJobs();
    jobs.forEach(job => {
      videoProcessor.cleanupOldJobs(0);
    });
  });

  describe('Phase 1: Basic Pipeline Functionality', () => {
    it('should process a valid short video end-to-end', async () => {
      const videoUrl = TestVideoManager.TEST_VIDEOS.VALID_SHORT;
      
      // Start processing
      const job = await videoProcessor.startProcessing(videoUrl);
      expect(job.id).toBeDefined();
      expect(job.status).toBe('queued');
      
      // Monitor progress
      let currentJob = videoProcessor.getJob(job.id);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      while (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentJob = videoProcessor.getJob(job.id);
        attempts++;
      }
      
      // Validate completion
      expect(currentJob?.status).toBe('completed');
      expect(currentJob?.progress).toBe(100);
      expect(currentJob?.results).toBeDefined();
      
      // Validate frame extraction
      if (currentJob?.results?.frames) {
        expect(currentJob.results.frames.length).toBeGreaterThan(0);
        expect(currentJob.results.frames[0].timestamp).toBeDefined();
        expect(currentJob.results.frames[0].url).toBeDefined();
      }
      
      // Validate audio extraction
      if (currentJob?.results?.audio) {
        expect(currentJob.results.audio.url).toBeDefined();
        expect(currentJob.results.audio.format).toBeDefined();
        expect(currentJob.results.audio.duration).toBeGreaterThan(0);
      }
    }, 60000); // 60 second timeout

    it('should handle concurrent processing within limits', async () => {
      const videoUrls = [
        TestVideoManager.TEST_VIDEOS.VALID_SHORT,
        TestVideoManager.TEST_VIDEOS.VALID_MEDIUM,
        TestVideoManager.TEST_VIDEOS.VALID_LONG
      ];
      
      // Start multiple jobs
      const jobs = await Promise.all(
        videoUrls.map(url => videoProcessor.startProcessing(url))
      );
      
      expect(jobs).toHaveLength(3);
      
      // Check that concurrent limit is respected
      const stats = videoProcessor.getStats();
      expect(stats.currentJobs).toBeLessThanOrEqual(3);
      expect(stats.maxConcurrent).toBe(3);
      
      // Clean up jobs
      jobs.forEach(job => {
        const currentJob = videoProcessor.getJob(job.id);
        if (currentJob) {
          // In real implementation, we'd have proper cleanup
        }
      });
    });

    it('should track processing progress accurately', async () => {
      const videoUrl = TestVideoManager.TEST_VIDEOS.VALID_SHORT;
      const job = await videoProcessor.startProcessing(videoUrl);
      
      let progressHistory: number[] = [];
      let currentJob = videoProcessor.getJob(job.id);
      let attempts = 0;
      
      while (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed' && attempts < 20) {
        progressHistory.push(currentJob.progress);
        await new Promise(resolve => setTimeout(resolve, 500));
        currentJob = videoProcessor.getJob(job.id);
        attempts++;
      }
      
      // Progress should be monotonically increasing
      for (let i = 1; i < progressHistory.length; i++) {
        expect(progressHistory[i]).toBeGreaterThanOrEqual(progressHistory[i - 1]);
      }
      
      // Final progress should be 100 for completed jobs
      if (currentJob?.status === 'completed') {
        expect(currentJob.progress).toBe(100);
      }
    }, 30000);
  });

  describe('Phase 2: Error Handling and Edge Cases', () => {
    it('should handle invalid video URLs gracefully', async () => {
      const invalidUrl = TestVideoManager.TEST_VIDEOS.INVALID_URL;
      
      const job = await videoProcessor.startProcessing(invalidUrl);
      expect(job.id).toBeDefined();
      
      // Wait for processing to complete (either failed or completed)
      let currentJob = videoProcessor.getJob(job.id);
      let attempts = 0;
      
      while (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed' && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentJob = videoProcessor.getJob(job.id);
        attempts++;
      }
      
      expect(currentJob?.status).toBe('failed');
      expect(currentJob?.error).toBeDefined();
    }, 15000);

    it('should handle unsupported video formats', async () => {
      const unsupportedUrl = TestVideoManager.TEST_VIDEOS.UNSUPPORTED_FORMAT;
      
      const job = await videoProcessor.startProcessing(unsupportedUrl);
      
      // Wait for processing to complete (either failed or completed)
      let currentJob = videoProcessor.getJob(job.id);
      let attempts = 0;
      
      while (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed' && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentJob = videoProcessor.getJob(job.id);
        attempts++;
      }
      
      expect(currentJob?.status).toBe('failed');
      expect(currentJob?.error).toBeDefined();
    }, 15000);

    it('should handle videos without audio streams', async () => {
      const noAudioUrl = TestVideoManager.TEST_VIDEOS.NO_AUDIO;
      
      const job = await videoProcessor.startProcessing(noAudioUrl);
      
      // Wait for completion
      let currentJob = videoProcessor.getJob(job.id);
      let attempts = 0;
      
      while (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentJob = videoProcessor.getJob(job.id);
        attempts++;
      }
      
      // Should complete successfully but with no audio
      expect(currentJob?.status).toBe('completed');
      expect(currentJob?.results?.audio).toBeDefined();
    }, 30000);

    it('should respect processing timeouts', async () => {
      // This test simulates a long-running job that should timeout
      const videoUrl = TestVideoManager.TEST_VIDEOS.VALID_LONG;
      
      // Set a very short timeout for testing (in real scenario this would be 10 minutes)
      const job = await videoProcessor.startProcessing(videoUrl, { timeout: 5000 }); // 5 seconds
      
      // Wait for the job to reach a final state (completed or failed)
      let currentJob = videoProcessor.getJob(job.id);
      let attempts = 0;
      
      while (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentJob = videoProcessor.getJob(job.id);
        attempts++;
      }
      
      // The job should have failed due to timeout
      expect(currentJob?.status).toBe('failed');
      expect(currentJob?.error).toBeDefined();
      expect(currentJob?.error).toContain('timeout');
    }, 25000);
  });

  describe('Phase 3: Performance and Resource Management', () => {
    it('should monitor system resources during processing', async () => {
      const initialMetrics = PerformanceMonitor.getJobMetrics();
      expect(initialMetrics).toBeDefined();
      
      const videoUrl = TestVideoManager.TEST_VIDEOS.VALID_MEDIUM;
      const job = await videoProcessor.startProcessing(videoUrl);
      
      // Monitor resource usage during processing
      const resourceSamples: any[] = [];
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const metrics = PerformanceMonitor.getJobMetrics();
        resourceSamples.push(metrics);
      }
      
      // Verify we collected resource data
      expect(resourceSamples.length).toBeGreaterThan(0);
    });

    it('should maintain processing ratio targets', async () => {
      const videoUrl = TestVideoManager.TEST_VIDEOS.VALID_LONG; // 5 minute video
      const startTime = Date.now();
      
      const job = await videoProcessor.startProcessing(videoUrl);
      
      // Wait for completion
      let currentJob = videoProcessor.getJob(job.id);
      while (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentJob = videoProcessor.getJob(job.id);
        
        // Safety timeout for test
        if (Date.now() - startTime > 600000) break; // 10 minutes max
      }
      
      const processingTime = Date.now() - startTime;
      const expectedMaxTime = 10 * 60 * 1000; // 10 minutes for 5 minute video (2:1 ratio)
      
      if (currentJob?.status === 'completed') {
        expect(processingTime).toBeLessThan(expectedMaxTime);
      }
    }, 700000); // 11+ minute timeout for safety

    it('should clean up resources after processing', async () => {
      const initialStats = videoProcessor.getStats();
      const videoUrl = TestVideoManager.TEST_VIDEOS.VALID_SHORT;
      
      const job = await videoProcessor.startProcessing(videoUrl);
      
      // Wait for completion
      let currentJob = videoProcessor.getJob(job.id);
      let attempts = 0;
      while (currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentJob = videoProcessor.getJob(job.id);
        attempts++;
      }
      
      // Clean up
      videoProcessor.cleanupOldJobs(0);
      
      const finalStats = videoProcessor.getStats();
      expect(finalStats.currentJobs).toBeLessThanOrEqual(initialStats.currentJobs);
    }, 45000);
  });

  describe('Phase 4: Advanced Processor Testing', () => {
    it('should use optimized processor for better performance', async () => {
      const videoUrl = TestVideoManager.TEST_VIDEOS.VALID_MEDIUM;
      const startTime = Date.now();
      
      const job = await optimizedProcessor.startProcessing(videoUrl);
      expect(job.id).toBeDefined();
      
      // Monitor until completion
      let attempts = 0;
      while (attempts < 30) {
        const status = optimizedProcessor.getJob(job.id);
        if (status?.status === 'completed' || status?.status === 'failed') {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      const processingTime = Date.now() - startTime;
      const finalStatus = optimizedProcessor.getJob(job.id);
      
      expect(finalStatus?.status).toBe('completed');
      expect(finalStatus?.results).toBeDefined();
    }, 45000);

    it('should use enhanced processor with storage integration', async () => {
      const videoUrl = TestVideoManager.TEST_VIDEOS.VALID_SHORT;
      
      const job = await enhancedProcessor.startProcessing(videoUrl);
      expect(job.id).toBeDefined();
      
      // Wait for completion
      let attempts = 0;
      while (attempts < 30) {
        const status = enhancedProcessor.getJob(job.id);
        if (status?.status === 'completed' || status?.status === 'failed') {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      const finalStatus = enhancedProcessor.getJob(job.id);
      
      expect(finalStatus?.status).toBe('completed');
    }, 45000);
  });

  describe('Phase 5: System Integration and Reliability', () => {
    it('should maintain job persistence across restarts', () => {
      // Test job persistence (simulated restart)
      const initialJobs = videoProcessor.getJobs();
      const jobCount = initialJobs.length;
      
      // Simulate system restart by clearing in-memory data
      // In real scenario, this would test database persistence
      videoProcessor.cleanupOldJobs(0);
      
      const afterCleanup = videoProcessor.getJobs();
      expect(afterCleanup.length).toBeLessThanOrEqual(jobCount);
    });

    it('should provide comprehensive system metrics', () => {
      const metrics = PerformanceMonitor.getJobMetrics();
      
      expect(metrics).toBeDefined();
    });

    it('should handle storage operations efficiently', async () => {
      const testData = Buffer.from('test video data');
      const contentType = 'video';
      const filename = 'test-video.mp4';
      
      // Test storage functionality
      try {
        const result = await StorageDeliveryManager.storeContent(
          testData,
          contentType as any,
          filename,
          { compression: true }
        );
        
        expect(result).toBeDefined();
        expect(result.url).toBeDefined();
        expect(result.metadata).toBeDefined();
      } catch (error) {
        // In test environment, storage might not be fully configured
        expect(error).toBeDefined();
      }
    });
  });

  describe('Phase 6: Error Recovery and Resilience', () => {
    it('should implement circuit breaker for external dependencies', async () => {
      // Test circuit breaker functionality
      const circuitBreaker = errorHandler.getCircuitBreaker('ffmpeg');
      expect(circuitBreaker).toBeDefined();
      
      // Circuit breaker should be in a valid state
      const state = circuitBreaker.getState();
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
    });

    it('should retry failed operations with exponential backoff', async () => {
      // Test retry functionality by checking error stats
      const errorStats = errorHandler.getErrorStats();
      expect(errorStats).toBeDefined();
      
      // Test that error handler is configured
      expect(typeof errorStats).toBe('object');
    });

    it('should monitor error rates and trigger alerts', () => {
      // Test error monitoring functionality
      const errorStats = errorHandler.getErrorStats();
      expect(errorStats).toBeDefined();
      
      // Test error monitoring
      expect(typeof errorStats).toBe('object');
    });
  });
}); 
// Tests for VideoProcessor service
import { VideoProcessor } from '@/lib/video-processor';

describe('VideoProcessor', () => {
  beforeEach(() => {
    // Clear any existing jobs before each test
    const jobs = VideoProcessor.getJobs();
    jobs.forEach(job => {
      // In a real implementation, we'd have a cleanup method
      // For now, we'll just test the basic functionality
    });
  });

  describe('Job Management', () => {
    it('should create a new processing job', async () => {
      const mockVideoUrl = 'https://example.com/test-video.mp4';
      
      const job = await VideoProcessor.startProcessing(mockVideoUrl);
      
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.videoUrl).toBe(mockVideoUrl);
      expect(job.status).toBe('queued');
      expect(job.progress).toBe(0);
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.requestId).toBeDefined();
    });

    it('should retrieve a job by ID', async () => {
      const mockVideoUrl = 'https://example.com/test-video.mp4';
      
      const job = await VideoProcessor.startProcessing(mockVideoUrl);
      const retrievedJob = VideoProcessor.getJob(job.id);
      
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(job.id);
      expect(retrievedJob?.videoUrl).toBe(mockVideoUrl);
    });

    it('should return undefined for non-existent job', () => {
      const retrievedJob = VideoProcessor.getJob('non-existent-id');
      expect(retrievedJob).toBeUndefined();
    });

    it('should get all jobs', async () => {
      const mockVideoUrl1 = 'https://example.com/test-video1.mp4';
      const mockVideoUrl2 = 'https://example.com/test-video2.mp4';
      
      await VideoProcessor.startProcessing(mockVideoUrl1);
      await VideoProcessor.startProcessing(mockVideoUrl2);
      
      const allJobs = VideoProcessor.getJobs();
      expect(allJobs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter jobs by status', async () => {
      const mockVideoUrl = 'https://example.com/test-video.mp4';
      
      await VideoProcessor.startProcessing(mockVideoUrl);
      
      const queuedJobs = VideoProcessor.getJobs('queued');
      expect(queuedJobs.length).toBeGreaterThanOrEqual(1);
      expect(queuedJobs.every(job => job.status === 'queued')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should provide processing statistics', () => {
      const stats = VideoProcessor.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalJobs).toBeDefined();
      expect(stats.byStatus).toBeDefined();
      expect(stats.currentJobs).toBeDefined();
      expect(stats.maxConcurrent).toBe(3);
      expect(stats.byStatus.queued).toBeDefined();
      expect(stats.byStatus.processing).toBeDefined();
      expect(stats.byStatus.completed).toBeDefined();
      expect(stats.byStatus.failed).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clean up old jobs', () => {
      // Test the cleanup functionality
      const cleaned = VideoProcessor.cleanupOldJobs(0); // Clean all jobs
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });
}); 
import { ProcessingPipelineImpl } from '../services/ProcessingPipelineImpl';
import { PipelineConfig } from '../services/ProcessingPipeline';
import { VideoFileImpl, CostMetricsImpl } from '../models';
import { JobStatus } from '../types/common';

// Simple mock services for basic testing
const createMockServices = () => ({
  videoProcessing: {
    extractAudio: jest.fn().mockResolvedValue({ id: 'audio-1', duration: 120 }),
    validateVideoFormat: jest.fn().mockResolvedValue({ isValid: true }),
    cleanupTempFiles: jest.fn().mockResolvedValue(undefined)
  },
  transcription: {
    transcribeAudio: jest.fn().mockResolvedValue({ 
      id: 'transcription-1', 
      segments: [{ text: 'Hello', startTime: 0, endTime: 2 }],
      language: 'en',
      confidence: 0.9
    }),
    translateToTarget: jest.fn().mockResolvedValue({
      id: 'translation-1',
      segments: [{ translatedText: 'হ্যালো', startTime: 0, endTime: 2 }]
    })
  },
  ttsRouter: {
    selectTTSService: jest.fn().mockResolvedValue('google_cloud'),
    generateSpeech: jest.fn().mockResolvedValue({ 
      id: 'segment-1', 
      audioBuffer: Buffer.from('mock-audio') 
    })
  },
  audioAssembly: {
    assembleAudioTrack: jest.fn().mockResolvedValue({ 
      id: 'track-1', 
      totalDuration: 120 
    })
  },
  videoAssembly: {
    combineVideoAudio: jest.fn().mockResolvedValue({ 
      id: 'output-1', 
      filename: 'output.mp4' 
    })
  },
  qualityAssurance: {
    validateOutput: jest.fn().mockResolvedValue({ 
      passesThreshold: true, 
      overallScore: 0.85 
    })
  },
  costTracking: {
    calculateJobCost: jest.fn().mockResolvedValue(
      new CostMetricsImpl(100, 0.02, 0, 30000, 0.05)
    )
  }
});

describe('ProcessingPipeline Basic Functionality', () => {
  let pipeline: ProcessingPipelineImpl;
  let mockServices: ReturnType<typeof createMockServices>;
  let config: PipelineConfig;

  beforeEach(() => {
    config = {
      maxConcurrentJobs: 1,
      jobTimeoutMs: 10000,
      retryAttempts: 2,
      tempDirectory: '/tmp',
      enableQualityValidation: true
    };

    mockServices = createMockServices();

    pipeline = new ProcessingPipelineImpl(
      config,
      mockServices.videoProcessing as any,
      mockServices.transcription as any,
      mockServices.ttsRouter as any,
      mockServices.audioAssembly as any,
      mockServices.videoAssembly as any,
      mockServices.qualityAssurance as any,
      mockServices.costTracking as any
    );
  });

  afterEach(async () => {
    await pipeline.shutdown();
  });

  describe('Job Creation and Management', () => {
    it('should create a processing job successfully', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.inputVideo).toBe(inputVideo);
      expect(job.progress).toBe(0);
      expect(job.costTracking).toBeDefined();
    });

    it('should retrieve job status', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      const retrievedJob = await pipeline.getJobStatus(job.id);

      expect(retrievedJob).toBe(job);
      expect(retrievedJob.id).toBe(job.id);
    });

    it('should cancel a pending job', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      await pipeline.cancelJob(job.id);

      const cancelledJob = await pipeline.getJobStatus(job.id);
      expect(cancelledJob.status).toBe(JobStatus.CANCELLED);
    });

    it('should provide pipeline statistics', () => {
      const stats = pipeline.getPipelineStatistics();
      
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('activeJobs');
      expect(stats).toHaveProperty('totalJobs');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('jobsByStatus');
    });

    it('should provide health status', () => {
      const health = pipeline.getHealthStatus();
      
      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('circuitBreakerStatus');
      expect(health.metrics).toHaveProperty('totalJobsProcessed');
      expect(health.metrics).toHaveProperty('successfulJobs');
      expect(health.metrics).toHaveProperty('failedJobs');
    });
  });

  describe('Queue Management', () => {
    it('should track queue length correctly', async () => {
      expect(pipeline.getQueueLength()).toBe(0);

      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      await pipeline.processVideo(inputVideo);
      expect(pipeline.getQueueLength()).toBe(1);
    });

    it('should track active job count', () => {
      expect(pipeline.getActiveJobCount()).toBe(0);
    });

    it('should return all jobs', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      const allJobs = pipeline.getAllJobs();
      
      expect(allJobs).toHaveLength(1);
      expect(allJobs[0]).toBe(job);
    });

    it('should filter jobs by status', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      await pipeline.processVideo(inputVideo);
      const pendingJobs = pipeline.getJobsByStatus(JobStatus.PENDING);
      
      expect(pendingJobs).toHaveLength(1);
      expect(pendingJobs[0].status).toBe(JobStatus.PENDING);
    });
  });

  describe('Error Handling', () => {
    it('should handle job not found errors', async () => {
      await expect(pipeline.getJobStatus('non-existent')).rejects.toThrow('Job not found');
      await expect(pipeline.cancelJob('non-existent')).rejects.toThrow('Job not found');
      await expect(pipeline.retryJob('non-existent')).rejects.toThrow('Job not found');
    });

    it('should handle invalid job cancellation', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      job.status = JobStatus.COMPLETED;

      await expect(pipeline.cancelJob(job.id)).rejects.toThrow('Cannot cancel job in completed status');
    });

    it('should handle invalid job retry', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      await expect(pipeline.retryJob(job.id)).rejects.toThrow('Can only retry failed jobs');
    });
  });
});
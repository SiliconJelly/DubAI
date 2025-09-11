import { ProcessingPipelineImpl } from '../services/ProcessingPipelineImpl';
import { PipelineConfig } from '../services/ProcessingPipeline';
import { VideoFileImpl, AudioFileImpl, TranscriptionResultImpl, TranslationResultImpl, AudioSegmentImpl, CostMetricsImpl } from '../models';
import { JobStatus, TTSServiceType } from '../types/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

// Integration test with real service implementations (mocked external dependencies)
describe('ProcessingPipelineImpl Integration Tests', () => {
  let pipeline: ProcessingPipelineImpl;
  let config: PipelineConfig;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, '../../temp/integration-test');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    config = {
      maxConcurrentJobs: 1, // Single job for predictable testing
      jobTimeoutMs: 30000, // 30 seconds
      retryAttempts: 2,
      tempDirectory: tempDir,
      enableQualityValidation: true
    };

    // Create mock service instances
    const videoProcessingService = {
      extractAudio: jest.fn(),
      validateVideoFormat: jest.fn(),
      cleanupTempFiles: jest.fn()
    };
    
    const transcriptionService = {
      transcribeAudio: jest.fn(),
      translateToTarget: jest.fn(),
      translateWithTimestampPreservation: jest.fn(),
      generateSRT: jest.fn()
    };
    
    const ttsRouter = {
      selectTTSService: jest.fn(),
      generateSpeech: jest.fn(),
      trackUsage: jest.fn()
    };
    
    const audioAssemblyService = {
      assembleAudioTrack: jest.fn(),
      synchronizeWithTimestamps: jest.fn(),
      normalizeAudio: jest.fn()
    };
    
    const videoAssemblyService = {
      combineVideoAudio: jest.fn(),
      preserveVideoQuality: jest.fn(),
      addMetadata: jest.fn()
    };
    
    const qualityAssuranceEngine = {
      validateAudioQuality: jest.fn(),
      validateSynchronization: jest.fn(),
      generateQualityReport: jest.fn(),
      checkQualityThresholds: jest.fn(),
      validateOutput: jest.fn()
    };
    
    const costTrackingService = {
      trackUsage: jest.fn(),
      getCostMetrics: jest.fn(),
      generateCostReport: jest.fn(),
      checkQuotaStatus: jest.fn(),
      calculateJobCost: jest.fn()
    };

    // Mock external service calls
    videoProcessingService.extractAudio.mockImplementation(async (videoFile) => {
      // Simulate audio extraction
      await new Promise(resolve => setTimeout(resolve, 100));
      return new AudioFileImpl(
        uuidv4(),
        'extracted-audio.wav',
        path.join(tempDir, 'extracted-audio.wav'),
        'wav',
        videoFile.duration,
        44100,
        2
      );
    });

    transcriptionService.transcribeAudio.mockImplementation(async (audioFile) => {
      // Simulate transcription
      await new Promise(resolve => setTimeout(resolve, 200));
      return new TranscriptionResultImpl(
        uuidv4(),
        [
          { text: 'Hello world, this is a test video.', startTime: 0, endTime: 3, confidence: 0.95 },
          { text: 'We are testing the dubbing workflow.', startTime: 3, endTime: 6, confidence: 0.92 }
        ],
        'en',
        0.93
      );
    });

    transcriptionService.translateToTarget.mockImplementation(async (transcription, targetLang) => {
      // Simulate translation
      await new Promise(resolve => setTimeout(resolve, 150));
      return new TranslationResultImpl(
        uuidv4(),
        'Hello world, this is a test video. We are testing the dubbing workflow.',
        'হ্যালো ওয়ার্ল্ড, এটি একটি পরীক্ষার ভিডিও। আমরা ডাবিং ওয়ার্কফ্লো পরীক্ষা করছি।',
        [
          { originalText: 'Hello world, this is a test video.', translatedText: 'হ্যালো ওয়ার্ল্ড, এটি একটি পরীক্ষার ভিডিও।', startTime: 0, endTime: 3, confidence: 0.9 },
          { originalText: 'We are testing the dubbing workflow.', translatedText: 'আমরা ডাবিং ওয়ার্কফ্লো পরীক্ষা করছি।', startTime: 3, endTime: 6, confidence: 0.88 }
        ],
        targetLang
      );
    });

    ttsRouter.selectTTSService.mockImplementation(async () => {
      return TTSServiceType.GOOGLE_CLOUD;
    });

    ttsRouter.generateSpeech.mockImplementation(async (text, service) => {
      // Simulate TTS generation
      await new Promise(resolve => setTimeout(resolve, 300));
      return new AudioSegmentImpl(
        uuidv4(),
        text,
        Buffer.from(`mock-audio-data-${text.length}`),
        0,
        text.length * 0.1, // Rough duration estimate
        { languageCode: 'bn', voiceName: 'bn-IN-Standard-A', gender: 'FEMALE', speakingRate: 1, pitch: 0, volumeGainDb: 0 }
      );
    });

    audioAssemblyService.assembleAudioTrack.mockImplementation(async (segments) => {
      // Simulate audio assembly
      await new Promise(resolve => setTimeout(resolve, 200));
      const totalDuration = segments.reduce((sum: number, segment: any) => sum + segment.endTime - segment.startTime, 0);
      return {
        id: uuidv4(),
        segments,
        totalDuration,
        sampleRate: 44100,
        channels: 2,
        format: 'wav'
      };
    });

    videoAssemblyService.combineVideoAudio.mockImplementation(async (videoFile, audioTrack) => {
      // Simulate video assembly
      await new Promise(resolve => setTimeout(resolve, 400));
      return new VideoFileImpl(
        uuidv4(),
        'dubbed-output.mp4',
        path.join(tempDir, 'dubbed-output.mp4'),
        'mp4',
        videoFile.duration,
        videoFile.resolution,
        {
          ...videoFile.metadata,
          title: `${videoFile.metadata.title} (Dubbed)`
        }
      );
    });

    qualityAssuranceEngine.validateOutput.mockImplementation(async (outputVideo) => {
      // Simulate quality validation
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        passesThreshold: true,
        overallScore: 0.85,
        issues: [],
        recommendations: []
      };
    });

    costTrackingService.calculateJobCost.mockImplementation(async (jobId) => {
      // Simulate cost calculation
      await new Promise(resolve => setTimeout(resolve, 50));
      return new CostMetricsImpl(150, 0.03, 0.01, 45, 0.04);
    });

    pipeline = new ProcessingPipelineImpl(
      config,
      videoProcessingService as any,
      transcriptionService as any,
      ttsRouter as any,
      audioAssemblyService as any,
      videoAssemblyService as any,
      qualityAssuranceEngine as any,
      costTrackingService as any
    );
  });

  afterEach(async () => {
    // Shutdown pipeline after each test
    await pipeline.shutdown();
    jest.clearAllMocks();
  });

  describe('Complete Pipeline Execution', () => {
    it('should process a video through the entire dubbing pipeline successfully', async () => {
      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'test-video.mp4',
        path.join(tempDir, 'test-video.mp4'),
        'mp4',
        120, // 2 minutes
        { width: 1920, height: 1080 },
        {
          title: 'Integration Test Video',
          description: 'Test video for complete pipeline execution',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      // Start processing
      const job = await pipeline.processVideo(inputVideo);
      expect(job.status).toBe(JobStatus.PENDING);
      expect(pipeline.getQueueLength()).toBe(1);

      // Wait for processing to complete
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (attempts >= maxAttempts) {
          throw new Error('Pipeline processing timed out');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      // Verify successful completion
      expect(job.status).toBe(JobStatus.COMPLETED);
      expect(job.progress).toBe(100);
      expect(job.outputVideo).toBeDefined();
      expect(job.completedAt).toBeDefined();
      expect(job.costTracking).toBeDefined();
      expect(job.costTracking.totalCost).toBeGreaterThan(0);

      // Verify pipeline statistics
      const stats = pipeline.getPipelineStatistics();
      expect(stats.totalJobs).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.jobsByStatus[JobStatus.COMPLETED]).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);

      // Verify health status
      const health = pipeline.getHealthStatus();
      expect(health.isHealthy).toBe(true);
      expect(health.metrics.successfulJobs).toBe(1);
      expect(health.metrics.totalJobsProcessed).toBe(1);
    }, 70000); // 70 second timeout

    it('should handle pipeline failures with proper error recovery', async () => {
      // Mock transcription service to fail initially
      const transcriptionService = pipeline['transcriptionService'] as any;
      let callCount = 0;
      
      transcriptionService.transcribeAudio.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated transcription failure');
        }
        // Succeed on retry
        await new Promise(resolve => setTimeout(resolve, 200));
        return new TranscriptionResultImpl(
          uuidv4(),
          [{ text: 'Recovered transcription', startTime: 0, endTime: 2, confidence: 0.9 }],
          'en',
          0.9
        );
      });

      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'test-video-failure.mp4',
        path.join(tempDir, 'test-video-failure.mp4'),
        'mp4',
        60,
        { width: 1280, height: 720 },
        {
          title: 'Failure Test Video',
          description: 'Test video for error recovery',
          duration: 60,
          codec: 'h264',
          bitrate: 3000000,
          frameRate: 24
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      // Wait for processing to complete (with retries)
      let attempts = 0;
      const maxAttempts = 90; // Extended timeout for retry logic
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (attempts >= maxAttempts) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      // Should eventually succeed after retry
      expect(job.status).toBe(JobStatus.COMPLETED);
      expect(callCount).toBeGreaterThan(1); // Should have retried
      
      // Verify health metrics account for the failure and recovery
      const health = pipeline.getHealthStatus();
      expect(health.metrics.totalJobsProcessed).toBe(1);
      expect(health.metrics.successfulJobs).toBe(1);
    }, 100000); // 100 second timeout for retry logic

    it('should fail job after exhausting all retry attempts', async () => {
      // Mock transcription service to always fail
      const transcriptionService = pipeline['transcriptionService'] as any;
      transcriptionService.transcribeAudio.mockImplementation(async () => {
        throw new Error('Persistent transcription failure');
      });

      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'test-video-persistent-failure.mp4',
        path.join(tempDir, 'test-video-persistent-failure.mp4'),
        'mp4',
        30,
        { width: 1280, height: 720 },
        {
          title: 'Persistent Failure Test Video',
          description: 'Test video for persistent failure handling',
          duration: 30,
          codec: 'h264',
          bitrate: 2000000,
          frameRate: 24
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      // Wait for processing to fail
      let attempts = 0;
      const maxAttempts = 60;
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (attempts >= maxAttempts) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(job.status).toBe(JobStatus.FAILED);
      expect(job.errorMessage).toContain('Persistent transcription failure');
      
      // Verify health metrics
      const health = pipeline.getHealthStatus();
      expect(health.metrics.failedJobs).toBe(1);
      expect(health.metrics.totalJobsProcessed).toBe(1);
    }, 70000);

    it('should handle quality validation failures', async () => {
      // Mock quality validation to fail
      const qualityEngine = pipeline['qualityAssuranceEngine'] as any;
      qualityEngine.validateOutput.mockImplementation(async () => {
        return {
          passesThreshold: false,
          overallScore: 0.4,
          issues: ['Poor audio quality', 'Synchronization issues'],
          recommendations: ['Improve TTS settings', 'Check timestamp accuracy']
        };
      });

      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'test-video-quality-fail.mp4',
        path.join(tempDir, 'test-video-quality-fail.mp4'),
        'mp4',
        45,
        { width: 1920, height: 1080 },
        {
          title: 'Quality Failure Test Video',
          description: 'Test video for quality validation failure',
          duration: 45,
          codec: 'h264',
          bitrate: 4000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      // Wait for processing to fail at quality validation
      let attempts = 0;
      const maxAttempts = 60;
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (attempts >= maxAttempts) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(job.status).toBe(JobStatus.FAILED);
      expect(job.errorMessage).toContain('Quality validation failed');
    }, 70000);
  });

  describe('Concurrent Job Processing', () => {
    it('should handle multiple concurrent jobs within limits', async () => {
      // Update config for concurrent processing
      const concurrentConfig = { ...config, maxConcurrentJobs: 2 };
      
      // Create new pipeline with concurrent config
      const concurrentPipeline = new ProcessingPipelineImpl(
        concurrentConfig,
        pipeline['videoProcessingService'],
        pipeline['transcriptionService'],
        pipeline['ttsRouter'],
        pipeline['audioAssemblyService'],
        pipeline['videoAssemblyService'],
        pipeline['qualityAssuranceEngine'],
        pipeline['costTrackingService']
      );

      const inputVideo1 = new VideoFileImpl(
        uuidv4(),
        'concurrent-test-1.mp4',
        path.join(tempDir, 'concurrent-test-1.mp4'),
        'mp4',
        30,
        { width: 1280, height: 720 },
        {
          title: 'Concurrent Test Video 1',
          description: 'First concurrent test video',
          duration: 30,
          codec: 'h264',
          bitrate: 2000000,
          frameRate: 24
        }
      );

      const inputVideo2 = new VideoFileImpl(
        uuidv4(),
        'concurrent-test-2.mp4',
        path.join(tempDir, 'concurrent-test-2.mp4'),
        'mp4',
        30,
        { width: 1280, height: 720 },
        {
          title: 'Concurrent Test Video 2',
          description: 'Second concurrent test video',
          duration: 30,
          codec: 'h264',
          bitrate: 2000000,
          frameRate: 24
        }
      );

      // Start both jobs
      const job1 = await concurrentPipeline.processVideo(inputVideo1);
      const job2 = await concurrentPipeline.processVideo(inputVideo2);

      expect(concurrentPipeline.getQueueLength()).toBe(2);

      // Wait for both jobs to complete
      let attempts = 0;
      const maxAttempts = 90;
      
      while ((job1.status === JobStatus.PENDING || job1.status === JobStatus.PROCESSING) ||
             (job2.status === JobStatus.PENDING || job2.status === JobStatus.PROCESSING)) {
        if (attempts >= maxAttempts) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(job1.status).toBe(JobStatus.COMPLETED);
      expect(job2.status).toBe(JobStatus.COMPLETED);

      const stats = concurrentPipeline.getPipelineStatistics();
      expect(stats.totalJobs).toBe(2);
      expect(stats.successRate).toBe(1);

      await concurrentPipeline.shutdown();
    }, 100000);
  });

  describe('Job Management Operations', () => {
    it('should support job cancellation', async () => {
      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'cancellation-test.mp4',
        path.join(tempDir, 'cancellation-test.mp4'),
        'mp4',
        60,
        { width: 1920, height: 1080 },
        {
          title: 'Cancellation Test Video',
          description: 'Test video for job cancellation',
          duration: 60,
          codec: 'h264',
          bitrate: 3000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      expect(job.status).toBe(JobStatus.PENDING);

      // Cancel the job before it completes
      await pipeline.cancelJob(job.id);

      const cancelledJob = await pipeline.getJobStatus(job.id);
      expect(cancelledJob.status).toBe(JobStatus.CANCELLED);
      expect(cancelledJob.completedAt).toBeDefined();
    });

    it('should support job retry after failure', async () => {
      // Mock service to fail initially
      const transcriptionService = pipeline['transcriptionService'] as any;
      transcriptionService.transcribeAudio.mockImplementation(async () => {
        throw new Error('Simulated failure for retry test');
      });

      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'retry-test.mp4',
        path.join(tempDir, 'retry-test.mp4'),
        'mp4',
        30,
        { width: 1280, height: 720 },
        {
          title: 'Retry Test Video',
          description: 'Test video for job retry',
          duration: 30,
          codec: 'h264',
          bitrate: 2000000,
          frameRate: 24
        }
      );

      const originalJob = await pipeline.processVideo(inputVideo);

      // Wait for job to fail
      let attempts = 0;
      while (originalJob.status === JobStatus.PENDING || originalJob.status === JobStatus.PROCESSING) {
        if (attempts >= 30) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(originalJob.status).toBe(JobStatus.FAILED);

      // Now mock service to succeed for retry
      transcriptionService.transcribeAudio.mockImplementation(async () => {
        return new TranscriptionResultImpl(
          uuidv4(),
          [{ text: 'Retry success', startTime: 0, endTime: 2, confidence: 0.9 }],
          'en',
          0.9
        );
      });

      // Retry the job
      const retryJob = await pipeline.retryJob(originalJob.id);
      expect(retryJob.id).not.toBe(originalJob.id); // Should be a new job
      expect(retryJob.status).toBe(JobStatus.PENDING);

      // Wait for retry to complete
      attempts = 0;
      while (retryJob.status === JobStatus.PENDING || retryJob.status === JobStatus.PROCESSING) {
        if (attempts >= 60) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(retryJob.status).toBe(JobStatus.COMPLETED);
    }, 100000);
  });
});
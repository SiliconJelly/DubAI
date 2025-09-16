import { ProcessingPipelineImpl } from '../services/ProcessingPipelineImpl';
import { PipelineConfig } from '../services/ProcessingPipeline';
import { VideoFileImpl, AudioFileImpl, TranscriptionResultImpl, TranslationResultImpl, AudioSegmentImpl, CostMetricsImpl } from '../models';
import { JobStatus, TTSServiceType } from '../types/common';
import { v4 as uuidv4 } from 'uuid';

describe('ProcessingPipeline Execution Tests', () => {
  let pipeline: ProcessingPipelineImpl;
  let config: PipelineConfig;
  let mockServices: any;

  beforeEach(() => {
    config = {
      maxConcurrentJobs: 2,
      jobTimeoutMs: 15000, // 15 seconds
      retryAttempts: 2,
      tempDirectory: '/tmp',
      enableQualityValidation: true
    };

    // Create comprehensive mock services
    mockServices = {
      videoProcessing: {
        extractAudio: jest.fn().mockImplementation(async (videoFile) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return new AudioFileImpl(
            uuidv4(),
            'extracted-audio.wav',
            '/tmp/extracted-audio.wav',
            'wav',
            videoFile.duration,
            44100,
            2
          );
        }),
        validateVideoFormat: jest.fn().mockResolvedValue({ isValid: true }),
        cleanupTempFiles: jest.fn().mockResolvedValue(undefined)
      },
      transcription: {
        transcribeAudio: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return new TranscriptionResultImpl(
            uuidv4(),
            [
              { text: 'Hello world, this is a test.', startTime: 0, endTime: 3, confidence: 0.95 },
              { text: 'Testing the dubbing workflow.', startTime: 3, endTime: 6, confidence: 0.92 }
            ],
            'en',
            0.93
          );
        }),
        translateToTarget: jest.fn().mockImplementation(async (transcription, targetLang) => {
          await new Promise(resolve => setTimeout(resolve, 80));
          return new TranslationResultImpl(
            uuidv4(),
            'Hello world, this is a test. Testing the dubbing workflow.',
            'হ্যালো ওয়ার্ল্ড, এটি একটি পরীক্ষা। ডাবিং ওয়ার্কফ্লো পরীক্ষা করা হচ্ছে।',
            [
              { originalText: 'Hello world, this is a test.', translatedText: 'হ্যালো ওয়ার্ল্ড, এটি একটি পরীক্ষা।', startTime: 0, endTime: 3, confidence: 0.9 },
              { originalText: 'Testing the dubbing workflow.', translatedText: 'ডাবিং ওয়ার্কফ্লো পরীক্ষা করা হচ্ছে।', startTime: 3, endTime: 6, confidence: 0.88 }
            ],
            targetLang
          );
        }),
        translateWithTimestampPreservation: jest.fn(),
        generateSRT: jest.fn()
      },
      ttsRouter: {
        selectTTSService: jest.fn().mockResolvedValue(TTSServiceType.GOOGLE_CLOUD),
        generateSpeech: jest.fn().mockImplementation(async (text, service) => {
          await new Promise(resolve => setTimeout(resolve, 150));
          return new AudioSegmentImpl(
            uuidv4(),
            text,
            Buffer.from(`mock-audio-data-${text.length}`),
            0,
            text.length * 0.1,
            { languageCode: 'bn', voiceName: 'bn-IN-Standard-A', gender: 'FEMALE', speakingRate: 1, pitch: 0, volumeGainDb: 0 }
          );
        }),
        trackUsage: jest.fn()
      },
      audioAssembly: {
        assembleAudioTrack: jest.fn().mockImplementation(async (segments) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          const totalDuration = segments.reduce((sum: number, segment: any) => sum + segment.endTime - segment.startTime, 0);
          return {
            id: uuidv4(),
            segments,
            totalDuration,
            sampleRate: 44100,
            channels: 2,
            format: 'wav'
          };
        }),
        synchronizeWithTimestamps: jest.fn(),
        normalizeAudio: jest.fn()
      },
      videoAssembly: {
        combineVideoAudio: jest.fn().mockImplementation(async (videoFile, audioTrack) => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return new VideoFileImpl(
            uuidv4(),
            'dubbed-output.mp4',
            '/tmp/dubbed-output.mp4',
            'mp4',
            videoFile.duration,
            videoFile.resolution,
            {
              ...videoFile.metadata,
              title: `${videoFile.metadata.title} (Dubbed)`
            }
          );
        }),
        preserveVideoQuality: jest.fn(),
        addMetadata: jest.fn()
      },
      qualityAssurance: {
        validateAudioQuality: jest.fn(),
        validateSynchronization: jest.fn(),
        generateQualityReport: jest.fn(),
        checkQualityThresholds: jest.fn(),
        validateOutput: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            passesThreshold: true,
            overallScore: 0.85,
            issues: [],
            recommendations: []
          };
        })
      },
      costTracking: {
        trackUsage: jest.fn(),
        getCostMetrics: jest.fn(),
        generateCostReport: jest.fn(),
        checkQuotaStatus: jest.fn(),
        calculateJobCost: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          return new CostMetricsImpl(150, 0.03, 0.01, 45, 0.04);
        })
      }
    };

    pipeline = new ProcessingPipelineImpl(
      config,
      mockServices.videoProcessing,
      mockServices.transcription,
      mockServices.ttsRouter,
      mockServices.audioAssembly,
      mockServices.videoAssembly,
      mockServices.qualityAssurance,
      mockServices.costTracking
    );
  });

  afterEach(async () => {
    await pipeline.shutdown();
    jest.clearAllMocks();
  });

  describe('Complete Pipeline Execution', () => {
    it('should successfully process a video through the entire pipeline', async () => {
      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'test-video.mp4',
        '/tmp/test-video.mp4',
        'mp4',
        120, // 2 minutes
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for pipeline execution',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      // Start processing
      const job = await pipeline.processVideo(inputVideo);
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.progress).toBe(0);

      // Wait for processing to complete
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (attempts >= maxAttempts) {
          throw new Error(`Pipeline processing timed out. Current status: ${job.status}, Progress: ${job.progress}`);
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

      // Verify all services were called
      expect(mockServices.videoProcessing.extractAudio).toHaveBeenCalledWith(inputVideo);
      expect(mockServices.transcription.transcribeAudio).toHaveBeenCalled();
      expect(mockServices.transcription.translateToTarget).toHaveBeenCalledWith(expect.anything(), 'bn');
      expect(mockServices.ttsRouter.selectTTSService).toHaveBeenCalled();
      expect(mockServices.ttsRouter.generateSpeech).toHaveBeenCalled();
      expect(mockServices.audioAssembly.assembleAudioTrack).toHaveBeenCalled();
      expect(mockServices.videoAssembly.combineVideoAudio).toHaveBeenCalled();
      expect(mockServices.qualityAssurance.validateOutput).toHaveBeenCalled();
      expect(mockServices.costTracking.calculateJobCost).toHaveBeenCalledWith(job.id);

      // Verify pipeline statistics
      const stats = pipeline.getPipelineStatistics();
      expect(stats.totalJobs).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.jobsByStatus[JobStatus.COMPLETED]).toBe(1);

      // Verify health status
      const health = pipeline.getHealthStatus();
      expect(health.isHealthy).toBe(true);
      expect(health.metrics.successfulJobs).toBe(1);
      expect(health.metrics.totalJobsProcessed).toBe(1);
    }, 35000);

    it('should handle concurrent job processing', async () => {
      const inputVideo1 = new VideoFileImpl(
        uuidv4(),
        'concurrent-test-1.mp4',
        '/tmp/concurrent-test-1.mp4',
        'mp4',
        60,
        { width: 1280, height: 720 },
        {
          title: 'Concurrent Test Video 1',
          description: 'First concurrent test video',
          duration: 60,
          codec: 'h264',
          bitrate: 3000000,
          frameRate: 24
        }
      );

      const inputVideo2 = new VideoFileImpl(
        uuidv4(),
        'concurrent-test-2.mp4',
        '/tmp/concurrent-test-2.mp4',
        'mp4',
        60,
        { width: 1280, height: 720 },
        {
          title: 'Concurrent Test Video 2',
          description: 'Second concurrent test video',
          duration: 60,
          codec: 'h264',
          bitrate: 3000000,
          frameRate: 24
        }
      );

      // Start both jobs
      const job1 = await pipeline.processVideo(inputVideo1);
      const job2 = await pipeline.processVideo(inputVideo2);

      expect(pipeline.getQueueLength()).toBe(2);

      // Wait for both jobs to complete
      let attempts = 0;
      const maxAttempts = 40;
      
      while ((job1.status === JobStatus.PENDING || job1.status === JobStatus.PROCESSING) ||
             (job2.status === JobStatus.PENDING || job2.status === JobStatus.PROCESSING)) {
        if (attempts >= maxAttempts) {
          throw new Error(`Concurrent processing timed out. Job1: ${job1.status}, Job2: ${job2.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(job1.status).toBe(JobStatus.COMPLETED);
      expect(job2.status).toBe(JobStatus.COMPLETED);

      const stats = pipeline.getPipelineStatistics();
      expect(stats.totalJobs).toBe(2);
      expect(stats.successRate).toBe(1);
      expect(stats.jobsByStatus[JobStatus.COMPLETED]).toBe(2);
    }, 45000);

    it('should track progress throughout pipeline execution', async () => {
      // Slow down services to allow progress tracking
      mockServices.videoProcessing.extractAudio.mockImplementation(async (videoFile: any) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return new AudioFileImpl(uuidv4(), 'extracted-audio.wav', '/tmp/extracted-audio.wav', 'wav', videoFile.duration, 44100, 2);
      });
      
      mockServices.transcription.transcribeAudio.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return new TranscriptionResultImpl(uuidv4(), [{ text: 'Test', startTime: 0, endTime: 2, confidence: 0.9 }], 'en', 0.9);
      });

      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'progress-test.mp4',
        '/tmp/progress-test.mp4',
        'mp4',
        90,
        { width: 1920, height: 1080 },
        {
          title: 'Progress Test Video',
          description: 'Test video for progress tracking',
          duration: 90,
          codec: 'h264',
          bitrate: 4000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      const progressUpdates: number[] = [job.progress]; // Start with initial progress

      // Monitor progress updates more frequently
      let attempts = 0;
      const maxAttempts = 30;
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (attempts >= maxAttempts) {
          break;
        }
        
        if (progressUpdates[progressUpdates.length - 1] !== job.progress) {
          progressUpdates.push(job.progress);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Check more frequently
        attempts++;
      }

      // Add final progress if not already captured
      if (progressUpdates[progressUpdates.length - 1] !== job.progress) {
        progressUpdates.push(job.progress);
      }

      expect(job.status).toBe(JobStatus.COMPLETED);
      expect(job.progress).toBe(100);
      
      // Verify progress increased over time
      expect(progressUpdates.length).toBeGreaterThan(1);
      expect(progressUpdates[0]).toBe(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
      
      // Verify progress is monotonically increasing
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
      }
    }, 35000);

    it('should support job cancellation during processing', async () => {
      // Slow down one of the services to allow cancellation
      mockServices.transcription.transcribeAudio.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        return new TranscriptionResultImpl(
          uuidv4(),
          [{ text: 'Slow transcription', startTime: 0, endTime: 2, confidence: 0.9 }],
          'en',
          0.9
        );
      });

      const inputVideo = new VideoFileImpl(
        uuidv4(),
        'cancellation-test.mp4',
        '/tmp/cancellation-test.mp4',
        'mp4',
        60,
        { width: 1280, height: 720 },
        {
          title: 'Cancellation Test Video',
          description: 'Test video for job cancellation',
          duration: 60,
          codec: 'h264',
          bitrate: 3000000,
          frameRate: 24
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      expect(job.status).toBe(JobStatus.PENDING);

      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Cancel the job
      await pipeline.cancelJob(job.id);

      const cancelledJob = await pipeline.getJobStatus(job.id);
      expect(cancelledJob.status).toBe(JobStatus.CANCELLED);
      expect(cancelledJob.completedAt).toBeDefined();
    }, 15000);
  });

  describe('Pipeline Monitoring and Statistics', () => {
    it('should provide accurate pipeline statistics', async () => {
      // Process multiple jobs to generate statistics
      const jobs = [];
      for (let i = 0; i < 3; i++) {
        const inputVideo = new VideoFileImpl(
          uuidv4(),
          `stats-test-${i}.mp4`,
          `/tmp/stats-test-${i}.mp4`,
          'mp4',
          30,
          { width: 1280, height: 720 },
          {
            title: `Stats Test Video ${i}`,
            description: `Test video ${i} for statistics`,
            duration: 30,
            codec: 'h264',
            bitrate: 2000000,
            frameRate: 24
          }
        );
        
        const job = await pipeline.processVideo(inputVideo);
        jobs.push(job);
      }

      // Wait for all jobs to complete
      let attempts = 0;
      const maxAttempts = 40;
      
      while (jobs.some(job => job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING)) {
        if (attempts >= maxAttempts) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      const stats = pipeline.getPipelineStatistics();
      expect(stats.totalJobs).toBe(3);
      expect(stats.successRate).toBe(1);
      expect(stats.jobsByStatus[JobStatus.COMPLETED]).toBe(3);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);

      const health = pipeline.getHealthStatus();
      expect(health.isHealthy).toBe(true);
      expect(health.metrics.totalJobsProcessed).toBe(3);
      expect(health.metrics.successfulJobs).toBe(3);
      expect(health.metrics.failedJobs).toBe(0);
    }, 45000);

    it('should provide health status information', () => {
      const health = pipeline.getHealthStatus();
      
      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('circuitBreakerStatus');
      
      expect(health.metrics).toHaveProperty('totalJobsProcessed');
      expect(health.metrics).toHaveProperty('successfulJobs');
      expect(health.metrics).toHaveProperty('failedJobs');
      expect(health.metrics).toHaveProperty('averageProcessingTime');
      expect(health.metrics).toHaveProperty('lastHealthCheck');
      
      expect(Array.isArray(health.circuitBreakerStatus)).toBe(true);
    });
  });
});
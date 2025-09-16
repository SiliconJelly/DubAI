import { JobProcessingIntegration, JobProcessingConfig } from '../services/JobProcessingIntegration';
import { JobQueueService } from '../services/JobQueueService';
import { ProcessingPipelineImpl } from '../services/ProcessingPipelineImpl';
import { JobStatus } from '@dubai/shared';
import winston from 'winston';
import { Server as SocketIOServer } from 'socket.io';
import { VideoFileImpl } from '../models/VideoFile';

// Mock dependencies
jest.mock('../services/JobQueueService');
jest.mock('../services/ProcessingPipelineImpl');
jest.mock('socket.io');

// Mock the service imports to avoid initialization issues
jest.mock('../../src/services/TranscriptionServiceImpl');
jest.mock('../../src/services/TTSRouterImpl');
jest.mock('../../src/services/AudioAssemblyServiceImpl');
jest.mock('../../src/utils/ffmpeg');
jest.mock('../../src/utils/fileManager');

describe('JobProcessingIntegration', () => {
  let jobProcessingIntegration: JobProcessingIntegration;
  let mockJobQueueService: jest.Mocked<JobQueueService>;
  let mockProcessingPipeline: jest.Mocked<ProcessingPipelineImpl>;
  let mockSupabase: any;
  let mockIO: jest.Mocked<SocketIOServer>;
  let mockLogger: jest.Mocked<winston.Logger>;

  const testConfig: JobProcessingConfig = {
    maxConcurrentProcessing: 2,
    processingTimeout: 300000, // 5 minutes
    retryDelay: 1000,
    maxRetryAttempts: 3,
    enableProgressTracking: true,
    enableErrorRecovery: true,
    tempDirectory: './temp'
  };

  beforeEach(() => {
    // Setup mocks
    mockJobQueueService = {
      updateJobProgress: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockProcessingPipeline = {
      processVideo: jest.fn(),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn()
    } as any;

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    };

    mockIO = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    jobProcessingIntegration = new JobProcessingIntegration(
      mockJobQueueService,
      mockProcessingPipeline,
      mockSupabase,
      mockIO,
      mockLogger,
      testConfig
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize all required services', () => {
      expect(jobProcessingIntegration).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Processing services initialized successfully');
    });

    it('should set up event listeners for job queue', () => {
      expect(mockJobQueueService.on).toHaveBeenCalledWith('jobAdded', expect.any(Function));
      expect(mockJobQueueService.on).toHaveBeenCalledWith('jobStarted', expect.any(Function));
      expect(mockJobQueueService.on).toHaveBeenCalledWith('jobUpdated', expect.any(Function));
      expect(mockJobQueueService.on).toHaveBeenCalledWith('jobCompleted', expect.any(Function));
      expect(mockJobQueueService.on).toHaveBeenCalledWith('jobFailed', expect.any(Function));
      expect(mockJobQueueService.on).toHaveBeenCalledWith('jobCancelled', expect.any(Function));
    });
  });

  describe('Job Context Management', () => {
    it('should store job context data', async () => {
      const jobId = 'test-job-id';
      const contextKey = 'audioFile';
      const contextData = { path: '/tmp/audio.wav', duration: 120 };

      mockSupabase.upsert.mockResolvedValue({ error: null });

      await (jobProcessingIntegration as any).storeJobContext(jobId, contextKey, contextData);

      expect(mockSupabase.from).toHaveBeenCalledWith('job_context');
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        job_id: jobId,
        context_key: contextKey,
        context_data: contextData,
        updated_at: expect.any(String)
      });
    });

    it('should retrieve job context data', async () => {
      const jobId = 'test-job-id';
      const contextKey = 'audioFile';
      const expectedData = { path: '/tmp/audio.wav', duration: 120 };

      mockSupabase.single.mockResolvedValue({
        data: { context_data: expectedData },
        error: null
      });

      const result = await (jobProcessingIntegration as any).getJobContext(jobId, contextKey);

      expect(mockSupabase.from).toHaveBeenCalledWith('job_context');
      expect(mockSupabase.select).toHaveBeenCalledWith('context_data');
      expect(mockSupabase.eq).toHaveBeenCalledWith('job_id', jobId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('context_key', contextKey);
      expect(result).toEqual(expectedData);
    });

    it('should handle missing job context gracefully', async () => {
      const jobId = 'test-job-id';
      const contextKey = 'nonexistent';

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      });

      const result = await (jobProcessingIntegration as any).getJobContext(jobId, contextKey);

      expect(result).toBeNull();
    });
  });

  describe('Processing Steps', () => {
    const mockJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      status: JobStatus.UPLOADED,
      progress: 0,
      createdAt: new Date(),
      inputFiles: {
        videoFileId: 'video-file-id'
      }
    };

    const mockVideoFile = new VideoFileImpl(
      'video-id',
      'test-video.mp4',
      '/tmp/test-video.mp4',
      'mp4',
      120,
      { width: 1920, height: 1080 },
      { duration: 120, codec: 'h264', bitrate: 5000000, frameRate: 30 }
    );

    it('should execute audio extraction step successfully', async () => {
      const stepMetric: any = {
        stepName: 'Audio Extraction',
        startTime: new Date(),
        success: false,
        retryCount: 0,
        serviceUsed: undefined,
        costEstimate: undefined
      };

      // Mock video processing service
      const mockAudioFile = {
        id: 'audio-id',
        path: '/tmp/audio.wav',
        duration: 120,
        format: 'wav'
      };

      // Mock the video processing service method
      (jobProcessingIntegration as any).videoProcessingService = {
        extractAudio: jest.fn().mockResolvedValue(mockAudioFile)
      };

      mockSupabase.upsert.mockResolvedValue({ error: null });

      await (jobProcessingIntegration as any).executeAudioExtraction(
        mockJob,
        mockVideoFile,
        stepMetric
      );

      expect(stepMetric.serviceUsed).toBe('FFmpeg');
      expect(stepMetric.costEstimate).toBe(0.01);
      expect(mockSupabase.upsert).toHaveBeenCalled();
    });

    it('should handle step failures with retry logic', async () => {
      const step = {
        name: 'Audio Extraction',
        status: JobStatus.EXTRACTING_AUDIO,
        progressStart: 5,
        progressEnd: 15,
        estimatedDuration: 30000,
        retryable: true
      };

      // Mock failure on first attempt, success on second
      let attemptCount = 0;
      (jobProcessingIntegration as any).executeStepLogic = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve();
      });

      mockJobQueueService.updateJobProgress.mockResolvedValue(undefined);

      await (jobProcessingIntegration as any).executeProcessingStep(
        mockJob,
        step,
        mockVideoFile
      );

      expect((jobProcessingIntegration as any).executeStepLogic).toHaveBeenCalledTimes(2);
      expect(mockJobQueueService.updateJobProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: mockJob.id,
          status: step.status,
          progress: step.progressEnd,
          message: `${step.name} completed successfully`
        })
      );
    });

    it('should fail after max retry attempts', async () => {
      const step = {
        name: 'Audio Extraction',
        status: JobStatus.EXTRACTING_AUDIO,
        progressStart: 5,
        progressEnd: 15,
        estimatedDuration: 30000,
        retryable: true
      };

      (jobProcessingIntegration as any).executeStepLogic = jest.fn()
        .mockRejectedValue(new Error('Persistent failure'));

      mockJobQueueService.updateJobProgress.mockResolvedValue(undefined);

      await expect(
        (jobProcessingIntegration as any).executeProcessingStep(
          mockJob,
          step,
          mockVideoFile
        )
      ).rejects.toThrow('Persistent failure');

      expect((jobProcessingIntegration as any).executeStepLogic)
        .toHaveBeenCalledTimes(testConfig.maxRetryAttempts + 1);
    });
  });

  describe('Error Recovery', () => {
    it('should apply TTS-specific error recovery', async () => {
      const mockJob = { id: 'test-job-id' };
      const step = { name: 'TTS Generation' };
      const error = new Error('quota exceeded');
      const retryCount = 1;

      await (jobProcessingIntegration as any).applyErrorRecovery(
        mockJob,
        step,
        error,
        retryCount
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('TTS quota/rate limit detected')
      );
    });

    it('should clear step cache during recovery', async () => {
      const jobId = 'test-job-id';
      const stepName = 'Audio Extraction';

      mockSupabase.delete.mockResolvedValue({ error: null });

      await (jobProcessingIntegration as any).clearStepCache(jobId, stepName);

      expect(mockSupabase.from).toHaveBeenCalledWith('job_context');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('job_id', jobId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('context_key', 'audioFile');
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate final metrics correctly', () => {
      const jobId = 'test-job-id';
      const totalProcessingTime = 120000; // 2 minutes

      const mockMetrics = [
        {
          stepName: 'Audio Extraction',
          duration: 30000,
          success: true,
          retryCount: 0,
          serviceUsed: 'FFmpeg',
          costEstimate: 0.01
        },
        {
          stepName: 'TTS Generation',
          duration: 60000,
          success: true,
          retryCount: 1,
          serviceUsed: 'google',
          costEstimate: 0.15
        }
      ];

      (jobProcessingIntegration as any).jobMetrics.set(jobId, mockMetrics);

      const result = (jobProcessingIntegration as any).calculateFinalMetrics(
        jobId,
        totalProcessingTime
      );

      expect(result.totalProcessingTime).toBe(totalProcessingTime);
      expect(result.totalCost).toBe(0.16);
      expect(result.successfulSteps).toBe(2);
      expect(result.totalRetries).toBe(1);
      expect(result.ttsService).toBe('google');
      expect(result.costBreakdown.ttsCost).toBe(0.15);
      expect(result.costBreakdown.processingCost).toBe(0.01);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup job files and context', async () => {
      const jobId = 'test-job-id';

      mockSupabase.delete.mockResolvedValue({ error: null });
      (jobProcessingIntegration as any).fileManager = {
        cleanupJobFiles: jest.fn().mockResolvedValue(undefined)
      };

      await (jobProcessingIntegration as any).cleanupJobFiles(jobId);

      expect(mockSupabase.from).toHaveBeenCalledWith('job_context');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('job_id', jobId);
      expect((jobProcessingIntegration as any).fileManager.cleanupJobFiles)
        .toHaveBeenCalledWith(jobId);
    });

    it('should handle cleanup errors gracefully', async () => {
      const jobId = 'test-job-id';

      mockSupabase.delete.mockRejectedValue(new Error('Database error'));

      // The method should not throw, but should log the warning
      await expect(
        (jobProcessingIntegration as any).cleanupJobFiles(jobId)
      ).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup files'),
        expect.any(Error)
      );
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const jobId = 'test-job-id';
      const mockTimeout = setTimeout(() => {}, 1000);
      
      (jobProcessingIntegration as any).processingJobs.set(jobId, mockTimeout);

      await jobProcessingIntegration.shutdown();

      expect((jobProcessingIntegration as any).processingJobs.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Job processing integration shut down');
    });
  });
});
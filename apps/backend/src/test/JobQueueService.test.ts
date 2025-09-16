import { JobQueueService, JobQueueConfig } from '../services/JobQueueService';
import { JobValidationService } from '../services/JobValidationService';
import { JobStatus } from '@dubai/shared';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import winston from 'winston';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { id: 'test-job-id' }, error: null }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null }))
    })),
    select: jest.fn((columns: string, options?: any) => {
      if (options?.count === 'exact') {
        return {
          eq: jest.fn(() => ({
            in: jest.fn(() => Promise.resolve({ count: 0, error: null })),
            gte: jest.fn(() => Promise.resolve({ count: 0, error: null }))
          }))
        };
      }
      return {
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: { 
              id: 'test-job-id', 
              status: 'uploaded',
              user_id: 'user-123',
              mime_type: 'video/mp4',
              file_size: 1000000
            }, 
            error: null 
          }))
        })),
        in: jest.fn(() => Promise.resolve({ data: [], error: null }))
      };
    })
  }))
} as unknown as SupabaseClient;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as unknown as winston.Logger;

describe('JobQueueService', () => {
  let jobQueueService: JobQueueService;
  let jobValidationService: JobValidationService;
  
  const config: JobQueueConfig = {
    maxConcurrentJobs: 2,
    maxRetries: 3,
    retryDelay: 1000,
    jobTimeout: 30000,
    cleanupInterval: 60000,
    maxQueueSize: 100
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jobQueueService = new JobQueueService(config, mockSupabase, mockLogger);
    jobValidationService = new JobValidationService(mockSupabase, mockLogger);
  });

  afterEach(async () => {
    await jobQueueService.shutdown();
  });

  describe('Job Creation', () => {
    it('should create a new job successfully', async () => {
      const jobData = {
        userId: 'user-123',
        title: 'Test Job',
        videoFileId: 'video-123',
        priority: 1
      };

      const job = await jobQueueService.addJob(jobData);

      expect(job).toBeDefined();
      expect(job.userId).toBe(jobData.userId);
      expect(job.title).toBe(jobData.title);
      expect(job.status).toBe(JobStatus.UPLOADED);
      expect(job.progress).toBe(0);
      expect(job.priority).toBe(1);
      expect(job.retryCount).toBe(0);
    });

    it('should reject job creation when queue is full', async () => {
      // Fill the queue to max capacity
      const promises = [];
      for (let i = 0; i < config.maxQueueSize; i++) {
        promises.push(jobQueueService.addJob({
          userId: 'user-123',
          title: `Job ${i}`,
          priority: 0
        }));
      }
      await Promise.all(promises);

      // Try to add one more job
      await expect(jobQueueService.addJob({
        userId: 'user-123',
        title: 'Overflow Job',
        priority: 0
      })).rejects.toThrow('Job queue is full');
    });

    it('should assign default priority when not specified', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      expect(job.priority).toBe(0);
    });
  });

  describe('Job Retrieval', () => {
    it('should retrieve job by ID', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      const retrievedJob = jobQueueService.getJob(job.id);
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(job.id);
    });

    it('should return undefined for non-existent job', () => {
      const retrievedJob = jobQueueService.getJob('non-existent-id');
      expect(retrievedJob).toBeUndefined();
    });

    it('should retrieve all jobs for a user', async () => {
      const userId = 'user-123';
      
      await jobQueueService.addJob({ userId, title: 'Job 1' });
      await jobQueueService.addJob({ userId, title: 'Job 2' });
      await jobQueueService.addJob({ userId: 'other-user', title: 'Job 3' });

      const userJobs = jobQueueService.getUserJobs(userId);
      expect(userJobs).toHaveLength(2);
      expect(userJobs.every(job => job.userId === userId)).toBe(true);
    });

    it('should retrieve jobs by status', async () => {
      const job1 = await jobQueueService.addJob({ userId: 'user-123', title: 'Job 1' });
      const job2 = await jobQueueService.addJob({ userId: 'user-123', title: 'Job 2' });
      
      // Update one job status
      await jobQueueService.updateJobProgress({
        jobId: job2.id,
        status: JobStatus.TRANSCRIBING,
        progress: 25
      });

      const uploadedJobs = jobQueueService.getJobsByStatus(JobStatus.UPLOADED);
      const transcribingJobs = jobQueueService.getJobsByStatus(JobStatus.TRANSCRIBING);

      expect(uploadedJobs).toHaveLength(1);
      expect(uploadedJobs[0].id).toBe(job1.id);
      expect(transcribingJobs).toHaveLength(1);
      expect(transcribingJobs[0].id).toBe(job2.id);
    });
  });

  describe('Job Status Updates', () => {
    it('should update job progress successfully', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      await jobQueueService.updateJobProgress({
        jobId: job.id,
        status: JobStatus.TRANSCRIBING,
        progress: 50,
        message: 'Transcribing audio...'
      });

      const updatedJob = jobQueueService.getJob(job.id);
      expect(updatedJob?.status).toBe(JobStatus.TRANSCRIBING);
      expect(updatedJob?.progress).toBe(50);
    });

    it('should handle job completion', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      const completionPromise = new Promise((resolve) => {
        jobQueueService.once('jobCompleted', resolve);
      });

      await jobQueueService.updateJobProgress({
        jobId: job.id,
        status: JobStatus.COMPLETED,
        progress: 100
      });

      await completionPromise;
      
      const completedJob = jobQueueService.getJob(job.id);
      expect(completedJob?.status).toBe(JobStatus.COMPLETED);
      expect(completedJob?.progress).toBe(100);
    });

    it('should handle job failure and retry logic', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      const retryPromise = new Promise((resolve) => {
        jobQueueService.once('jobRetry', resolve);
      });

      await jobQueueService.updateJobProgress({
        jobId: job.id,
        status: JobStatus.FAILED,
        progress: 0,
        error: 'Processing failed'
      });

      // Wait for retry logic to trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      const failedJob = jobQueueService.getJob(job.id);
      expect(failedJob?.retryCount).toBe(1);
    });
  });

  describe('Job Cancellation', () => {
    it('should cancel job successfully', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      const cancelled = await jobQueueService.cancelJob(job.id, 'user-123');
      expect(cancelled).toBe(true);

      const cancelledJob = jobQueueService.getJob(job.id);
      expect(cancelledJob?.status).toBe(JobStatus.FAILED);
      expect(cancelledJob?.errorMessage).toBe('Job cancelled by user');
    });

    it('should reject cancellation by unauthorized user', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      await expect(jobQueueService.cancelJob(job.id, 'other-user'))
        .rejects.toThrow('Unauthorized: Cannot cancel job belonging to another user');
    });

    it('should reject cancellation of completed job', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      // Complete the job first
      await jobQueueService.updateJobProgress({
        jobId: job.id,
        status: JobStatus.COMPLETED,
        progress: 100
      });

      await expect(jobQueueService.cancelJob(job.id, 'user-123'))
        .rejects.toThrow('Cannot cancel job in completed status');
    });
  });

  describe('Job Deletion', () => {
    it('should delete job successfully', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      const deleted = await jobQueueService.deleteJob(job.id, 'user-123');
      expect(deleted).toBe(true);

      const deletedJob = jobQueueService.getJob(job.id);
      expect(deletedJob).toBeUndefined();
    });

    it('should reject deletion by unauthorized user', async () => {
      const job = await jobQueueService.addJob({
        userId: 'user-123',
        title: 'Test Job'
      });

      await expect(jobQueueService.deleteJob(job.id, 'other-user'))
        .rejects.toThrow('Unauthorized: Cannot delete job belonging to another user');
    });
  });

  describe('Queue Statistics', () => {
    it('should return accurate queue statistics', async () => {
      // Add some jobs with different statuses
      const job1 = await jobQueueService.addJob({ userId: 'user-123', title: 'Job 1' });
      const job2 = await jobQueueService.addJob({ userId: 'user-123', title: 'Job 2' });
      const job3 = await jobQueueService.addJob({ userId: 'user-123', title: 'Job 3' });

      // Update job statuses
      await jobQueueService.updateJobProgress({
        jobId: job2.id,
        status: JobStatus.TRANSCRIBING,
        progress: 25
      });

      await jobQueueService.updateJobProgress({
        jobId: job3.id,
        status: JobStatus.COMPLETED,
        progress: 100
      });

      const stats = jobQueueService.getQueueStats();

      expect(stats.totalJobs).toBe(3);
      expect(stats.queuedJobs).toBe(1); // job1 is still uploaded
      expect(stats.processingJobs).toBe(1); // job2 is transcribing
      expect(stats.completedJobs).toBe(1); // job3 is completed
      expect(stats.failedJobs).toBe(0);
    });
  });

  describe('Job Validation Integration', () => {
    it('should validate job creation data', async () => {
      const validData = {
        title: 'Valid Job Title',
        videoFileId: '123e4567-e89b-12d3-a456-426614174000',
        priority: 5
      };

      const result = await jobValidationService.validateCreateJob(
        validData,
        { userId: 'user-123' }
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid job creation data', async () => {
      const invalidData = {
        title: '', // Empty title
        videoFileId: 'invalid-uuid',
        priority: 15 // Too high priority
      };

      const result = await jobValidationService.validateCreateJob(
        invalidData,
        { userId: 'user-123' }
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate job cancellation', async () => {
      const result = await jobValidationService.validateJobCancellation(
        'test-job-id',
        { userId: 'user-123' }
      );

      // This will depend on the mock data setup
      expect(result).toBeDefined();
    });
  });
});
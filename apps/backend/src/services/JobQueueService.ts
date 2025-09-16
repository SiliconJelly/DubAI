import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { JobStatus, DubbingJob, ProcessingMetrics, CostBreakdown } from '@dubai/shared';
import { SupabaseClient } from '@supabase/supabase-js';
import winston from 'winston';

export interface QueuedJob {
  id: string;
  userId: string;
  title: string;
  status: JobStatus;
  progress: number;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  inputFiles: {
    videoFileId?: string | undefined;
    srtFileId?: string | undefined;
  };
  outputFiles: {
    dubbedAudioFileId?: string;
    translatedSrtFileId?: string;
  };
  processingMetrics: ProcessingMetrics;
  errorMessage?: string | undefined;
  retryCount: number;
  maxRetries: number;
}

export interface JobQueueConfig {
  maxConcurrentJobs: number;
  maxRetries: number;
  retryDelay: number;
  jobTimeout: number;
  cleanupInterval: number;
  maxQueueSize: number;
}

export interface JobProgressUpdate {
  jobId: string;
  status: JobStatus;
  progress: number;
  message?: string;
  metrics?: Partial<ProcessingMetrics>;
  error?: string;
}

export class JobQueueService extends EventEmitter {
  private jobQueue: Map<string, QueuedJob> = new Map();
  private processingJobs: Set<string> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(
    private config: JobQueueConfig,
    private supabase: SupabaseClient,
    private logger: winston.Logger
  ) {
    super();
    this.startProcessing();
    this.startCleanup();
  }

  /**
   * Add a new job to the queue
   */
  async addJob(jobData: {
    userId: string;
    title: string;
    videoFileId?: string;
    srtFileId?: string;
    priority?: number;
  }): Promise<QueuedJob> {
    if (this.jobQueue.size >= this.config.maxQueueSize) {
      throw new Error('Job queue is full. Please try again later.');
    }

    const jobId = uuidv4();
    const now = new Date();

    const job: QueuedJob = {
      id: jobId,
      userId: jobData.userId,
      title: jobData.title,
      status: JobStatus.UPLOADED,
      progress: 0,
      priority: jobData.priority || 0,
      createdAt: now,
      updatedAt: now,
      inputFiles: {
        ...(jobData.videoFileId && { videoFileId: jobData.videoFileId }),
        ...(jobData.srtFileId && { srtFileId: jobData.srtFileId })
      },
      outputFiles: {},
      processingMetrics: {
        costBreakdown: {
          transcriptionCost: 0,
          translationCost: 0,
          ttsCost: 0,
          processingCost: 0,
          totalCost: 0
        }
      },

      retryCount: 0,
      maxRetries: this.config.maxRetries
    };

    // Store in memory queue
    this.jobQueue.set(jobId, job);

    // Persist to database
    await this.persistJobToDatabase(job);

    this.logger.info(`Job ${jobId} added to queue for user ${jobData.userId}`);
    this.emit('jobAdded', job);

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): QueuedJob | undefined {
    return this.jobQueue.get(jobId);
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): QueuedJob[] {
    return Array.from(this.jobQueue.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): QueuedJob[] {
    return Array.from(this.jobQueue.values())
      .filter(job => job.status === status);
  }

  /**
   * Update job status and progress
   */
  async updateJobProgress(update: JobProgressUpdate): Promise<void> {
    const job = this.jobQueue.get(update.jobId);
    if (!job) {
      this.logger.warn(`Attempted to update non-existent job: ${update.jobId}`);
      return;
    }

    const previousStatus = job.status;
    job.status = update.status;
    job.progress = update.progress;
    job.updatedAt = new Date();

    if (update.error) {
      job.errorMessage = update.error;
    }

    if (update.metrics) {
      job.processingMetrics = { ...job.processingMetrics, ...update.metrics };
    }

    // Update database
    await this.updateJobInDatabase(job);

    this.logger.info(`Job ${update.jobId} updated: ${previousStatus} -> ${update.status} (${update.progress}%)`);
    this.emit('jobUpdated', job, update);

    // Handle job completion or failure
    if (update.status === JobStatus.COMPLETED) {
      this.processingJobs.delete(update.jobId);
      this.emit('jobCompleted', job);
    } else if (update.status === JobStatus.FAILED) {
      this.processingJobs.delete(update.jobId);
      await this.handleJobFailure(job);
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    const job = this.jobQueue.get(jobId);
    if (!job) {
      return false;
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized: Cannot cancel job belonging to another user');
    }

    if ([JobStatus.COMPLETED, JobStatus.FAILED].includes(job.status)) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    job.status = JobStatus.FAILED;
    job.errorMessage = 'Job cancelled by user';
    job.updatedAt = new Date();

    this.processingJobs.delete(jobId);

    // Update database
    await this.updateJobInDatabase(job);

    this.logger.info(`Job ${jobId} cancelled by user ${userId}`);
    this.emit('jobCancelled', job);

    return true;
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string, userId: string): Promise<boolean> {
    const job = this.jobQueue.get(jobId);
    if (!job) {
      return false;
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized: Cannot delete job belonging to another user');
    }

    if (this.processingJobs.has(jobId)) {
      throw new Error('Cannot delete job that is currently processing');
    }

    // Remove from memory
    this.jobQueue.delete(jobId);

    // Remove from database
    await this.deleteJobFromDatabase(jobId);

    this.logger.info(`Job ${jobId} deleted by user ${userId}`);
    this.emit('jobDeleted', { jobId, userId });

    return true;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalJobs: number;
    queuedJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageWaitTime: number;
  } {
    const jobs = Array.from(this.jobQueue.values());
    const now = new Date();

    const queuedJobs = jobs.filter(job => job.status === JobStatus.UPLOADED).length;
    const processingStatuses = [
      JobStatus.EXTRACTING_AUDIO,
      JobStatus.TRANSCRIBING,
      JobStatus.TRANSLATING,
      JobStatus.GENERATING_SPEECH,
      JobStatus.ASSEMBLING_AUDIO
    ];
    const processingJobs = jobs.filter(job => processingStatuses.includes(job.status)).length;
    const completedJobs = jobs.filter(job => job.status === JobStatus.COMPLETED).length;
    const failedJobs = jobs.filter(job => job.status === JobStatus.FAILED).length;

    // Calculate average wait time for queued jobs
    const queuedJobsArray = jobs.filter(job => job.status === JobStatus.UPLOADED);
    const averageWaitTime = queuedJobsArray.length > 0
      ? queuedJobsArray.reduce((sum, job) => sum + (now.getTime() - job.createdAt.getTime()), 0) / queuedJobsArray.length
      : 0;

    return {
      totalJobs: jobs.length,
      queuedJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      averageWaitTime: Math.round(averageWaitTime / 1000) // Convert to seconds
    };
  }

  /**
   * Start processing jobs from the queue
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      try {
        await this.processNextJob();
      } catch (error) {
        this.logger.error('Error in job processing loop:', error);
      }
    }, 1000); // Check every second

    this.logger.info('Job queue processing started');
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob(): Promise<void> {
    if (this.processingJobs.size >= this.config.maxConcurrentJobs) {
      return; // Already at max capacity
    }

    // Find the next job to process (highest priority, oldest first)
    const queuedJobs = Array.from(this.jobQueue.values())
      .filter(job => job.status === JobStatus.UPLOADED)
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.createdAt.getTime() - b.createdAt.getTime(); // Older first
      });

    if (queuedJobs.length === 0) {
      return; // No jobs to process
    }

    const job = queuedJobs[0];
    this.processingJobs.add(job.id);

    this.logger.info(`Starting processing for job ${job.id}`);
    this.emit('jobStarted', job);

    // The actual processing will be handled by the ProcessingPipeline
    // This service just manages the queue and status updates
  }

  /**
   * Handle job failure and retry logic
   */
  private async handleJobFailure(job: QueuedJob): Promise<void> {
    if (job.retryCount < job.maxRetries) {
      job.retryCount++;
      job.status = JobStatus.UPLOADED; // Reset to queued for retry
      job.progress = 0;
      job.updatedAt = new Date();

      // Add delay before retry
      setTimeout(async () => {
        await this.updateJobInDatabase(job);
        this.logger.info(`Job ${job.id} scheduled for retry (attempt ${job.retryCount}/${job.maxRetries})`);
        this.emit('jobRetry', job);
      }, this.config.retryDelay);
    } else {
      this.logger.error(`Job ${job.id} failed permanently after ${job.retryCount} retries`);
      this.emit('jobFailed', job);
    }
  }

  /**
   * Persist job to database
   */
  private async persistJobToDatabase(job: QueuedJob): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('dubbing_jobs')
        .insert({
          id: job.id,
          user_id: job.userId,
          title: job.title,
          status: job.status,
          progress: job.progress,
          input_video_file_id: job.inputFiles.videoFileId || null,
          input_srt_file_id: job.inputFiles.srtFileId || null,
          processing_metrics: job.processingMetrics,
          error_message: job.errorMessage,
          created_at: job.createdAt.toISOString(),
          updated_at: job.updatedAt.toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to persist job ${job.id} to database:`, error);
      throw error;
    }
  }

  /**
   * Update job in database
   */
  private async updateJobInDatabase(job: QueuedJob): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('dubbing_jobs')
        .update({
          status: job.status,
          progress: job.progress,
          output_audio_file_id: job.outputFiles.dubbedAudioFileId || null,
          output_srt_file_id: job.outputFiles.translatedSrtFileId || null,
          processing_metrics: job.processingMetrics,
          error_message: job.errorMessage,
          updated_at: job.updatedAt.toISOString()
        })
        .eq('id', job.id);

      if (error) {
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to update job ${job.id} in database:`, error);
      throw error;
    }
  }

  /**
   * Delete job from database
   */
  private async deleteJobFromDatabase(jobId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('dubbing_jobs')
        .delete()
        .eq('id', jobId);

      if (error) {
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to delete job ${jobId} from database:`, error);
      throw error;
    }
  }

  /**
   * Start cleanup process for old jobs
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldJobs();
      } catch (error) {
        this.logger.error('Error in cleanup process:', error);
      }
    }, this.config.cleanupInterval);

    this.logger.info('Job cleanup process started');
  }

  /**
   * Clean up old completed/failed jobs
   */
  private async cleanupOldJobs(): Promise<void> {
    const cutoffDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
    const jobsToCleanup: string[] = [];

    for (const [jobId, job] of this.jobQueue.entries()) {
      if (
        (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) &&
        job.updatedAt < cutoffDate
      ) {
        jobsToCleanup.push(jobId);
      }
    }

    for (const jobId of jobsToCleanup) {
      this.jobQueue.delete(jobId);
    }

    if (jobsToCleanup.length > 0) {
      this.logger.info(`Cleaned up ${jobsToCleanup.length} old jobs from memory`);
    }
  }

  /**
   * Load jobs from database on startup
   */
  async loadJobsFromDatabase(): Promise<void> {
    try {
      const { data: jobs, error } = await this.supabase
        .from('dubbing_jobs')
        .select('*')
        .in('status', [JobStatus.UPLOADED, JobStatus.EXTRACTING_AUDIO, JobStatus.TRANSCRIBING, 
                      JobStatus.TRANSLATING, JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO]);

      if (error) {
        throw error;
      }

      for (const dbJob of jobs || []) {
        const job: QueuedJob = {
          id: dbJob.id,
          userId: dbJob.user_id,
          title: dbJob.title,
          status: dbJob.status as JobStatus,
          progress: dbJob.progress,
          priority: 0, // Default priority for loaded jobs
          createdAt: new Date(dbJob.created_at),
          updatedAt: new Date(dbJob.updated_at),
          inputFiles: {
            ...(dbJob.input_video_file_id && { videoFileId: dbJob.input_video_file_id }),
            ...(dbJob.input_srt_file_id && { srtFileId: dbJob.input_srt_file_id })
          },
          outputFiles: {
            dubbedAudioFileId: dbJob.output_audio_file_id,
            translatedSrtFileId: dbJob.output_srt_file_id
          },
          processingMetrics: dbJob.processing_metrics || {
            costBreakdown: {
              transcriptionCost: 0,
              translationCost: 0,
              ttsCost: 0,
              processingCost: 0,
              totalCost: 0
            }
          },
          errorMessage: dbJob.error_message,
          retryCount: 0,
          maxRetries: this.config.maxRetries
        };

        this.jobQueue.set(job.id, job);

        // Add to processing set if job was in progress
        if (job.status !== JobStatus.UPLOADED) {
          this.processingJobs.add(job.id);
        }
      }

      this.logger.info(`Loaded ${jobs?.length || 0} jobs from database`);
    } catch (error) {
      this.logger.error('Failed to load jobs from database:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Wait for current processing jobs to complete or timeout
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processingJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.logger.info('Job queue service shut down');
  }
}
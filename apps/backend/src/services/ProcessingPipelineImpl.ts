import { ProcessingPipeline, PipelineConfig, PipelineStep } from './ProcessingPipeline';
import { ProcessingJob, ProcessingJobImpl, VideoFile, AudioFile, TranslationResult, CostMetrics } from '../models';
import { JobStatus, RecoveryAction } from '../types/common';
import { VideoProcessingService } from './VideoProcessingService';
import { TranscriptionService } from './TranscriptionService';
import { TTSRouter } from './TTSRouter';
import { AudioAssemblyService, AudioTrack } from './AudioAssemblyService';
import { VideoAssemblyService } from './VideoAssemblyService';
import { QualityAssuranceEngine } from './QualityAssuranceEngine';
import { CostTrackingService } from './CostTrackingService';
import { DefaultErrorHandler } from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export class ProcessingPipelineImpl implements ProcessingPipeline {
  private jobs: Map<string, ProcessingJob> = new Map();
  private jobQueue: ProcessingJob[] = [];
  private activeJobs: Set<string> = new Set();
  private errorHandler: DefaultErrorHandler;
  private pipelineSteps: PipelineStep[];
  private processingInterval: NodeJS.Timeout | null = null;
  
  // Circuit breaker state
  private circuitBreakerState: Map<string, {
    failures: number;
    lastFailure: Date;
    isOpen: boolean;
  }> = new Map();
  
  // Health monitoring
  private healthMetrics = {
    totalJobsProcessed: 0,
    successfulJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    lastHealthCheck: new Date()
  };

  constructor(
    private config: PipelineConfig,
    private videoProcessingService: VideoProcessingService,
    private transcriptionService: TranscriptionService,
    private ttsRouter: TTSRouter,
    private audioAssemblyService: AudioAssemblyService,
    private videoAssemblyService: VideoAssemblyService,
    private qualityAssuranceEngine: QualityAssuranceEngine,
    private costTrackingService: CostTrackingService
  ) {
    this.errorHandler = new DefaultErrorHandler();
    this.pipelineSteps = this.createPipelineSteps();
    this.startJobProcessor();
  }

  async processVideo(inputVideo: VideoFile): Promise<ProcessingJob> {
    try {
      // Create initial cost metrics
      const initialCostMetrics: CostMetrics = {
        googleTTSCharacters: 0,
        googleTTSCost: 0,
        coquiTTSUsage: 0,
        computeTime: 0,
        totalCost: 0
      };

      // Create processing job
      const job = new ProcessingJobImpl(
        uuidv4(),
        JobStatus.PENDING,
        inputVideo,
        initialCostMetrics
      );

      // Validate job
      if (!job.validate()) {
        throw new Error('Invalid processing job created');
      }

      // Store job and add to queue
      this.jobs.set(job.id, job);
      this.jobQueue.push(job);

      return job;
    } catch (error) {
      throw new Error(`Failed to create processing job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getJobStatus(jobId: string): Promise<ProcessingJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return job;
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    job.status = JobStatus.CANCELLED;
    job.completedAt = new Date();
    this.activeJobs.delete(jobId);

    // Remove from queue if still pending
    const queueIndex = this.jobQueue.findIndex(queuedJob => queuedJob.id === jobId);
    if (queueIndex !== -1) {
      this.jobQueue.splice(queueIndex, 1);
    }
  }

  async retryJob(jobId: string): Promise<ProcessingJob> {
    const originalJob = this.jobs.get(jobId);
    if (!originalJob) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (originalJob.status !== JobStatus.FAILED) {
      throw new Error(`Can only retry failed jobs. Current status: ${originalJob.status}`);
    }

    // Create a new job for retry with same input video
    const retryJob = await this.processVideo(originalJob.inputVideo);
    
    // Copy any relevant metadata from original job
    (retryJob as any).originalJobId = originalJob.id;
    (retryJob as any).retryCount = ((originalJob as any).retryCount || 0) + 1;
    
    return retryJob;
  }

  private createPipelineSteps(): PipelineStep[] {
    return [
      {
        name: 'Audio Extraction',
        execute: async (job: ProcessingJob) => {
          job.updateProgress(10);
          const audioFile = await this.videoProcessingService.extractAudio(job.inputVideo);
          (job as any).audioFile = audioFile;
        }
      },
      {
        name: 'Transcription',
        execute: async (job: ProcessingJob) => {
          job.updateProgress(25);
          const audioFile = (job as any).audioFile as AudioFile;
          const transcription = await this.transcriptionService.transcribeAudio(audioFile);
          (job as any).transcription = transcription;
        }
      },
      {
        name: 'Translation',
        execute: async (job: ProcessingJob) => {
          job.updateProgress(40);
          const transcription = (job as any).transcription;
          const translation = await this.transcriptionService.translateToTarget(transcription, 'bn');
          (job as any).translation = translation;
        }
      },
      {
        name: 'TTS Generation',
        execute: async (job: ProcessingJob) => {
          job.updateProgress(55);
          const translation = (job as any).translation as TranslationResult;
          const audioSegments = [];
          
          for (const segment of translation.segments) {
            const ttsService = await this.ttsRouter.selectTTSService({
              text: segment.translatedText,
              targetLanguage: 'bn',
              sessionId: job.id
            });
            
            const audioSegment = await this.ttsRouter.generateSpeech(segment.translatedText, ttsService);
            audioSegments.push(audioSegment);
          }
          
          (job as any).audioSegments = audioSegments;
        }
      },
      {
        name: 'Audio Assembly',
        execute: async (job: ProcessingJob) => {
          job.updateProgress(70);
          const audioSegments = (job as any).audioSegments;
          const audioTrack = await this.audioAssemblyService.assembleAudioTrack(audioSegments);
          (job as any).audioTrack = audioTrack;
        }
      },
      {
        name: 'Video Assembly',
        execute: async (job: ProcessingJob) => {
          job.updateProgress(85);
          const audioTrack = (job as any).audioTrack as AudioTrack;
          const outputVideo = await this.videoAssemblyService.combineVideoAudio(job.inputVideo, audioTrack);
          (job as any).outputVideo = outputVideo;
        }
      },
      {
        name: 'Quality Validation',
        execute: async (job: ProcessingJob) => {
          job.updateProgress(95);
          if (this.config.enableQualityValidation) {
            const outputVideo = (job as any).outputVideo;
            const qualityResult = await this.qualityAssuranceEngine.validateOutput(outputVideo);
            
            if (!qualityResult.passesThreshold) {
              throw new Error(`Quality validation failed: ${qualityResult.issues.join(', ')}`);
            }
          }
        }
      },
      {
        name: 'Cost Tracking',
        execute: async (job: ProcessingJob) => {
          const finalCosts = await this.costTrackingService.calculateJobCost(job.id);
          job.costTracking = finalCosts;
          job.updateProgress(100);
          
          const outputVideo = (job as any).outputVideo as VideoFile;
          job.markCompleted(outputVideo);
        }
      }
    ];
  }

  private startJobProcessor(): void {
    // Only start job processor in non-test environments
    if (process.env['NODE_ENV'] !== 'test') {
      this.processingInterval = setInterval(async () => {
        await this.processNextJob();
      }, 1000); // Check for new jobs every second
    }
  }

  // Monitoring methods for pipeline status
  getQueueLength(): number {
    return this.jobQueue.length;
  }

  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  getAllJobs(): ProcessingJob[] {
    return Array.from(this.jobs.values());
  }

  getJobsByStatus(status: JobStatus): ProcessingJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  // Cleanup method for graceful shutdown
  async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for active jobs to complete or timeout
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await this.sleep(1000);
    }

    // Cancel remaining jobs
    for (const jobId of this.activeJobs) {
      try {
        await this.cancelJob(jobId);
      } catch (error) {
        console.warn(`Failed to cancel job ${jobId} during shutdown:`, error);
      }
    }

    // Clear all data structures
    this.jobs.clear();
    this.jobQueue.length = 0;
    this.activeJobs.clear();
    this.circuitBreakerState.clear();
  }

  private async processNextJob(): Promise<void> {
    // Check if we can process more jobs
    if (this.activeJobs.size >= this.config.maxConcurrentJobs || this.jobQueue.length === 0) {
      return;
    }

    const job = this.jobQueue.shift();
    if (!job) return;

    this.activeJobs.add(job.id);
    job.status = JobStatus.PROCESSING;
    
    const startTime = Date.now();

    try {
      await this.executeJobWithTimeout(job);
      
      // Record success metrics
      const processingTime = Date.now() - startTime;
      this.updateHealthMetrics(job, processingTime);
      this.recordSuccess('pipeline');
      
    } catch (error) {
      // Record failure metrics
      const processingTime = Date.now() - startTime;
      this.recordFailure('pipeline');
      
      await this.handleJobError(job, error);
      this.updateHealthMetrics(job, processingTime);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private async executeJobWithTimeout(job: ProcessingJob): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout')), this.config.jobTimeoutMs);
    });

    const executionPromise = this.executeJob(job);

    await Promise.race([executionPromise, timeoutPromise]);
  }

  private async executeJob(job: ProcessingJob): Promise<void> {
    this.setRetryCount(job, 0);
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.setRetryCount(job, attempt - 1);
        
        for (let stepIndex = 0; stepIndex < this.pipelineSteps.length; stepIndex++) {
          const step = this.pipelineSteps[stepIndex];
          
          try {
            await step.execute(job);
          } catch (stepError) {
            // Try step-specific recovery if available
            if (step.rollback) {
              try {
                console.log(`Rolling back step: ${step.name} for job ${job.id}`);
                await step.rollback(job);
              } catch (rollbackError) {
                console.warn(`Rollback failed for step ${step.name}:`, rollbackError);
              }
            }
            
            // Check if this is a recoverable error
            const recoveryAction = await this.errorHandler.handleProcessingError(stepError, {
              jobId: job.id,
              step: step.name,
              retryCount: attempt - 1
            });
            
            if (recoveryAction === RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS && attempt < this.config.retryAttempts) {
              console.log(`Retrying step ${step.name} for job ${job.id} with different parameters`);
              // Reset progress to beginning of failed step
              const previousProgress = stepIndex === 0 ? 0 : this.getProgressForStep(stepIndex - 1);
              job.updateProgress(previousProgress);
              throw stepError; // Will trigger retry of entire job
            }
            
            throw stepError; // Re-throw if not recoverable
          }
        }
        
        return; // Success
      } catch (error) {
        if (attempt === this.config.retryAttempts) {
          throw error; // Final attempt failed
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        console.log(`Job ${job.id} attempt ${attempt} failed, retrying in ${delay}ms`);
        await this.sleep(delay);
        
        // Reset progress for retry
        job.progress = 0;
      }
    }
  }

  private getProgressForStep(stepIndex: number): number {
    const progressSteps = [0, 10, 25, 40, 55, 70, 85, 95, 100];
    return progressSteps[stepIndex] || 0;
  }

  private async handleJobError(job: ProcessingJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Use error handler for categorization and recovery recommendations
    let recoveryAction: RecoveryAction;
    try {
      recoveryAction = await this.errorHandler.handleProcessingError(error, {
        jobId: job.id,
        step: this.getCurrentStep(job),
        retryCount: this.getRetryCount(job)
      });
    } catch (handlerError) {
      console.warn(`Error handler failed:`, handlerError);
      recoveryAction = RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
    }
    
    // Apply recovery action
    switch (recoveryAction) {
      case RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS:
        if (this.getRetryCount(job) < this.config.retryAttempts) {
          console.log(`Retrying job ${job.id} with different parameters`);
          // Reset job for retry with modified parameters
          job.progress = 0;
          this.jobQueue.unshift(job); // Add to front of queue for immediate retry
          return;
        }
        break;
      
      case RecoveryAction.FALLBACK_TO_ALTERNATIVE_SERVICE:
        console.log(`Attempting fallback for job ${job.id}`);
        // This would be handled by individual services (e.g., TTS router fallback)
        break;
      
      case RecoveryAction.MANUAL_INTERVENTION_REQUIRED:
        console.warn(`Manual intervention required for job ${job.id}`);
        break;
      
      case RecoveryAction.ABORT_PROCESSING:
      default:
        console.error(`Aborting job ${job.id}`);
        break;
    }
    
    job.markFailed(`${errorMessage}. Recovery action: ${recoveryAction}.`);
    
    // Log error for monitoring
    console.error(`Job ${job.id} failed:`, error);
    
    // Cleanup temporary files
    try {
      await this.videoProcessingService.cleanupTempFiles(job.id);
    } catch (cleanupError) {
      console.warn(`Failed to cleanup files for job ${job.id}:`, cleanupError);
    }
  }

  private getCurrentStep(job: ProcessingJob): string {
    // Determine current step based on progress
    if (job.progress < 10) return 'Audio Extraction';
    if (job.progress < 25) return 'Transcription';
    if (job.progress < 40) return 'Translation';
    if (job.progress < 55) return 'TTS Generation';
    if (job.progress < 70) return 'Audio Assembly';
    if (job.progress < 85) return 'Video Assembly';
    if (job.progress < 95) return 'Quality Validation';
    return 'Cost Tracking';
  }

  private getRetryCount(job: ProcessingJob): number {
    // This would be tracked in job metadata in a real implementation
    return (job as any).retryCount || 0;
  }

  private setRetryCount(job: ProcessingJob, count: number): void {
    (job as any).retryCount = count;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit breaker methods
  private isCircuitOpen(serviceName: string): boolean {
    const state = this.circuitBreakerState.get(serviceName);
    if (!state) return false;
    
    // Reset circuit if enough time has passed
    const timeSinceLastFailure = Date.now() - state.lastFailure.getTime();
    if (timeSinceLastFailure > 60000) { // 1 minute reset time
      state.failures = 0;
      state.isOpen = false;
    }
    
    return state.isOpen;
  }

  private recordFailure(serviceName: string): void {
    let state = this.circuitBreakerState.get(serviceName);
    if (!state) {
      state = { failures: 0, lastFailure: new Date(), isOpen: false };
      this.circuitBreakerState.set(serviceName, state);
    }
    
    state.failures++;
    state.lastFailure = new Date();
    
    // Open circuit if too many failures
    if (state.failures >= 5) {
      state.isOpen = true;
      console.warn(`Circuit breaker opened for service: ${serviceName}`);
    }
  }

  private recordSuccess(serviceName: string): void {
    const state = this.circuitBreakerState.get(serviceName);
    if (state) {
      state.failures = Math.max(0, state.failures - 1);
      if (state.failures === 0) {
        state.isOpen = false;
      }
    }
  }

  // Health monitoring methods
  updateHealthMetrics(job: ProcessingJob, processingTime: number): void {
    this.healthMetrics.totalJobsProcessed++;
    
    if (job.status === JobStatus.COMPLETED) {
      this.healthMetrics.successfulJobs++;
    } else if (job.status === JobStatus.FAILED) {
      this.healthMetrics.failedJobs++;
    }
    
    // Update average processing time
    const totalTime = this.healthMetrics.averageProcessingTime * (this.healthMetrics.totalJobsProcessed - 1) + processingTime;
    this.healthMetrics.averageProcessingTime = totalTime / this.healthMetrics.totalJobsProcessed;
    
    this.healthMetrics.lastHealthCheck = new Date();
  }

  getHealthStatus(): {
    isHealthy: boolean;
    metrics: {
      totalJobsProcessed: number;
      successfulJobs: number;
      failedJobs: number;
      averageProcessingTime: number;
      lastHealthCheck: Date;
    };
    circuitBreakerStatus: Array<{ service: string; isOpen: boolean; failures: number }>;
  } {
    const successRate = this.healthMetrics.totalJobsProcessed > 0 
      ? this.healthMetrics.successfulJobs / this.healthMetrics.totalJobsProcessed 
      : 1;
    
    const isHealthy = successRate > 0.8 && this.activeJobs.size < this.config.maxConcurrentJobs;
    
    const circuitBreakerStatus = Array.from(this.circuitBreakerState.entries()).map(([service, state]) => ({
      service,
      isOpen: state.isOpen,
      failures: state.failures
    }));
    
    return {
      isHealthy,
      metrics: { ...this.healthMetrics },
      circuitBreakerStatus
    };
  }

  // Enhanced monitoring methods
  getPipelineStatistics(): {
    queueLength: number;
    activeJobs: number;
    totalJobs: number;
    successRate: number;
    averageProcessingTime: number;
    jobsByStatus: Record<JobStatus, number>;
  } {
    const jobsByStatus = Object.values(JobStatus).reduce((acc, status) => {
      acc[status] = this.getJobsByStatus(status).length;
      return acc;
    }, {} as Record<JobStatus, number>);

    const successRate = this.healthMetrics.totalJobsProcessed > 0 
      ? this.healthMetrics.successfulJobs / this.healthMetrics.totalJobsProcessed 
      : 0;

    return {
      queueLength: this.getQueueLength(),
      activeJobs: this.getActiveJobCount(),
      totalJobs: this.jobs.size,
      successRate,
      averageProcessingTime: this.healthMetrics.averageProcessingTime,
      jobsByStatus
    };
  }
}
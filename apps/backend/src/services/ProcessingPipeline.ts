import { ProcessingJob, VideoFile } from '../models';

export interface ProcessingPipeline {
  processVideo(inputVideo: VideoFile): Promise<ProcessingJob>;
  getJobStatus(jobId: string): Promise<ProcessingJob>;
  cancelJob(jobId: string): Promise<void>;
  retryJob(jobId: string): Promise<ProcessingJob>;
}

export interface PipelineConfig {
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
  retryAttempts: number;
  tempDirectory: string;
  enableQualityValidation: boolean;
}

export interface PipelineStep {
  name: string;
  execute(job: ProcessingJob): Promise<void>;
  rollback?(job: ProcessingJob): Promise<void>;
}
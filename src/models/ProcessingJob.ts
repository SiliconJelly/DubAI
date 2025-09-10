import { JobStatus } from '../types/common';
import { VideoFile } from './VideoFile';
import { CostMetrics } from './CostMetrics';

export interface ProcessingJob {
  id: string;
  status: JobStatus;
  inputVideo: VideoFile;
  outputVideo?: VideoFile | undefined;
  progress: number;
  createdAt: Date;
  completedAt?: Date | undefined;
  errorMessage?: string | undefined;
  costTracking: CostMetrics;
  
  // Methods for job management
  validate(): boolean;
  updateProgress(progress: number): void;
  markCompleted(outputVideo: VideoFile): void;
  markFailed(errorMessage: string): void;
  getDuration(): number;
}

export class ProcessingJobImpl implements ProcessingJob {
  constructor(
    public id: string,
    public status: JobStatus,
    public inputVideo: VideoFile,
    public costTracking: CostMetrics,
    public outputVideo?: VideoFile,
    public progress: number = 0,
    public createdAt: Date = new Date(),
    public completedAt?: Date,
    public errorMessage?: string
  ) {}

  validate(): boolean {
    return !!(
      this.id && 
      this.status && 
      this.inputVideo && 
      this.costTracking &&
      this.progress >= 0 && 
      this.progress <= 100 &&
      this.createdAt
    );
  }

  updateProgress(progress: number): void {
    this.progress = Math.min(100, Math.max(0, progress));
  }

  markCompleted(outputVideo: VideoFile): void {
    this.status = JobStatus.COMPLETED;
    this.outputVideo = outputVideo;
    this.completedAt = new Date();
    this.progress = 100;
  }

  markFailed(errorMessage: string): void {
    this.status = JobStatus.FAILED;
    this.errorMessage = errorMessage;
    this.completedAt = new Date();
  }

  getDuration(): number {
    if (!this.completedAt) return 0;
    return this.completedAt.getTime() - this.createdAt.getTime();
  }
}
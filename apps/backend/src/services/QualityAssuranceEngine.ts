import { QualityMetrics, ProcessingJob } from '../models';

export interface QualityAssuranceEngine {
  validateAudioQuality(audioBuffer: Buffer): Promise<number>;
  validateSynchronization(videoFile: string, audioFile: string): Promise<number>;
  generateQualityReport(job: ProcessingJob): Promise<QualityReport>;
  checkQualityThresholds(metrics: QualityMetrics): Promise<boolean>;
  validateOutput(outputVideo: any): Promise<QualityValidationResult>;
}

export interface QualityValidationResult {
  passesThreshold: boolean;
  overallScore: number;
  issues: string[];
  recommendations: string[];
}

export interface QualityReport {
  jobId: string;
  overallScore: number;
  metrics: QualityMetrics;
  issues: QualityIssue[];
  recommendations: string[];
  passedValidation: boolean;
}

export interface QualityIssue {
  type: 'audio_quality' | 'synchronization' | 'duration_mismatch';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp?: number;
}
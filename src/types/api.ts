import { ProcessingJob, QualityMetrics } from '../models';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

import { MulterFile } from './express';

export interface DubbingRequest {
  videoFile: MulterFile;
  targetLanguage: string;
  voicePreferences?: {
    gender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
    speakingRate?: number;
    pitch?: number;
  };
  qualitySettings?: {
    audioQuality: 'standard' | 'high' | 'premium';
    enableQualityValidation: boolean;
  };
}

export interface DubbingResponse {
  jobId: string;
  status: string;
  estimatedCompletionTime?: number;
  costEstimate?: number;
}

export interface JobStatusResponse {
  job: ProcessingJob;
  qualityMetrics?: QualityMetrics;
  downloadUrl?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    [serviceName: string]: {
      status: 'up' | 'down';
      responseTime?: number;
      lastCheck: Date;
    };
  };
  uptime: number;
}
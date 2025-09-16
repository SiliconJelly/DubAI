import { ProcessingJob, QualityMetrics } from '../models';
import { 
  ApiResponse, 
  JobStatus, 
  DubbingJob,
  CreateJobRequest,
  JobResponse,
  JobListResponse,
  FileUploadRequest,
  FileUploadResponse
} from '@dubai/shared';

// Re-export shared types for convenience
export { 
  ApiResponse, 
  JobStatus, 
  DubbingJob,
  CreateJobRequest,
  JobResponse,
  JobListResponse,
  FileUploadRequest,
  FileUploadResponse
} from '@dubai/shared';

import { MulterFile } from './express';
import { SupabaseClient } from '@supabase/supabase-js';
import { WebSocketService } from '../services/WebSocketService';

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

// Extended Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      supabase?: SupabaseClient;
      requestId?: string;
      startTime?: number;
      correlationId?: string;
      validate?: {
        schema: (schema: any, data: any) => any;
      };
    }
    
    interface Application {
      get(name: 'webSocketService'): WebSocketService;
      set(name: 'webSocketService', value: WebSocketService): void;
    }
  }
}
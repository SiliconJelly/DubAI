// Common types and enums used across the application

export interface Resolution {
  width: number;
  height: number;
}

export interface VideoMetadata {
  title?: string;
  description?: string;
  duration: number;
  codec: string;
  bitrate: number;
  frameRate: number;
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TTSServiceType {
  GOOGLE_CLOUD = 'google_cloud',
  COQUI_LOCAL = 'coqui_local'
}

export enum RecoveryAction {
  RETRY_WITH_DIFFERENT_PARAMS = 'retry_with_different_params',
  FALLBACK_TO_ALTERNATIVE_SERVICE = 'fallback_to_alternative_service',
  MANUAL_INTERVENTION_REQUIRED = 'manual_intervention_required',
  ABORT_PROCESSING = 'abort_processing'
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  resetDate: Date;
}

export interface UsageMetrics {
  charactersProcessed: number;
  processingTimeMs: number;
  apiCalls: number;
  errorCount: number;
}

export interface ModelInfo {
  name: string;
  version: string;
  language: string;
  size: number;
  loadedAt?: Date;
}
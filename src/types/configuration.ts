// Configuration types for the automated dubbing workflow system

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionTimeout: number;
  maxConnections: number;
}

export interface GoogleCloudConfig {
  projectId: string;
  keyFilename?: string | undefined;
  credentials?: any;
  quotaLimits: {
    charactersPerMonth: number;
    charactersPerMinute: number;
  };
  defaultVoiceSettings: {
    languageCode: string;
    voiceName: string;
    gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
    speakingRate: number;
    pitch: number;
    volumeGainDb: number;
  };
}

export interface CoquiTTSConfig {
  modelPath: string;
  cachePath: string;
  maxCacheSize: number;
  gpuEnabled: boolean;
  defaultVoiceSettings: {
    languageCode: string;
    voiceName: string;
    gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
    speakingRate: number;
    pitch: number;
    volumeGainDb: number;
    temperature: number;
    lengthPenalty: number;
  };
}

export interface ABTestingConfig {
  enabled: boolean;
  googleTTSWeight: number;
  coquiTTSWeight: number;
  sessionDuration: number; // in minutes
  minimumSampleSize: number;
  confidenceLevel: number;
}

export interface TTSServiceConfig {
  googleCloud: GoogleCloudConfig;
  coquiTTS: CoquiTTSConfig;
  abTesting: ABTestingConfig;
  quotaThresholds: {
    googleTTS: number;
    warningThreshold: number;
  };
  fallbackEnabled: boolean;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface ProcessingConfig {
  tempDirectory: string;
  maxFileSize: number; // in bytes
  supportedVideoFormats: string[];
  supportedAudioFormats: string[];
  ffmpegPath?: string | undefined;
  whisperModelPath?: string | undefined;
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
}

export interface QualityConfig {
  audioQualityThreshold: number;
  synchronizationToleranceMs: number;
  minimumConfidenceScore: number;
  enableQualityChecks: boolean;
  qualityMetricsEnabled: boolean;
}

export interface CostTrackingConfig {
  enabled: boolean;
  alertThresholds: {
    dailyCost: number;
    monthlyCost: number;
    perVideoCost: number;
  };
  currency: string;
  costPerCharacter: {
    googleTTS: number;
    computeTime: number;
  };
}

export interface SecurityConfig {
  apiKeyEncryption: boolean;
  fileEncryption: boolean;
  maxUploadSize: number;
  allowedOrigins: string[];
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableFileLogging: boolean;
  logDirectory: string;
  maxLogFileSize: number;
  maxLogFiles: number;
  enableConsoleLogging: boolean;
}

export interface ApplicationConfig {
  environment: 'development' | 'staging' | 'production';
  port: number;
  host: string;
  database: DatabaseConfig;
  ttsServices: TTSServiceConfig;
  processing: ProcessingConfig;
  quality: QualityConfig;
  costTracking: CostTrackingConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: ConfigurationError[];
  warnings: ConfigurationWarning[];
}

export interface ConfigurationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ConfigurationWarning {
  field: string;
  message: string;
  recommendation?: string;
}

export interface EnvironmentOverride {
  path: string;
  value: any;
  source: 'env' | 'file' | 'default';
}

export enum ConfigurationSource {
  DEFAULT = 'default',
  ENVIRONMENT = 'environment',
  CONFIG_FILE = 'config_file',
  RUNTIME = 'runtime'
}
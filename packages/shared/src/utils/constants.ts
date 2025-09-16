// API Endpoints
export const API_ENDPOINTS = {
  JOBS: '/api/jobs',
  FILES: '/api/files',
  AUTH: '/api/auth',
  HEALTH: '/api/health'
} as const;

// File Constraints
export const FILE_CONSTRAINTS = {
  VIDEO: {
    MAX_SIZE: 500 * 1024 * 1024, // 500MB
    ALLOWED_TYPES: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime']
  },
  SRT: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['text/plain', 'application/x-subrip']
  }
} as const;

// Processing Constants
export const PROCESSING_CONSTANTS = {
  MAX_CONCURRENT_JOBS: 5,
  JOB_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  PROGRESS_UPDATE_INTERVAL_MS: 1000, // 1 second
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000 // 5 seconds
} as const;

// WebSocket Events
export const WS_EVENTS = {
  JOB_UPDATE: 'job_update',
  ERROR: 'error',
  SYSTEM_MESSAGE: 'system_message',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect'
} as const;
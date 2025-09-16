export class DubbingWorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'DubbingWorkflowError';
  }
}

export class VideoProcessingError extends DubbingWorkflowError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'VIDEO_PROCESSING_ERROR', 422);
    this.name = 'VideoProcessingError';
  }
}

export class TranscriptionError extends DubbingWorkflowError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'TRANSCRIPTION_ERROR', 422);
    this.name = 'TranscriptionError';
  }
}

export class TTSError extends DubbingWorkflowError {
  constructor(message: string, public service: string, public originalError?: Error) {
    super(message, 'TTS_ERROR', 422);
    this.name = 'TTSError';
  }
}

export class AssemblyError extends DubbingWorkflowError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'ASSEMBLY_ERROR', 422);
    this.name = 'AssemblyError';
  }
}

export class VideoAssemblyError extends AssemblyError {
  constructor(message: string, public override originalError?: Error) {
    super(message, originalError);
    this.name = 'VideoAssemblyError';
  }
}

export class QuotaExceededError extends TTSError {
  constructor(service: string, limit: number) {
    super(`Quota exceeded for ${service}. Limit: ${limit}`, service);
    this.code = 'QUOTA_EXCEEDED';
    this.statusCode = 429;
    this.name = 'QuotaExceededError';
  }
}

export interface ErrorContext {
  userId?: string;
  jobId?: string;
  operation?: string;
  additionalInfo?: any;
}

export class ValidationError extends DubbingWorkflowError {
  public details: string[];

  constructor(message: string, details: string[] = [], statusCode: number = 400) {
    super(message, 'VALIDATION_ERROR', statusCode);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class ProcessingError extends DubbingWorkflowError {
  public stage: string;
  public recoverable: boolean;

  constructor(message: string, stage: string, recoverable: boolean = true, statusCode: number = 500) {
    super(message, 'PROCESSING_ERROR', statusCode);
    this.name = 'ProcessingError';
    this.stage = stage;
    this.recoverable = recoverable;
  }
}

export class MovieAnalysisError extends DubbingWorkflowError {
  constructor(message: string, public analysisStage?: string, originalError?: Error) {
    super(message, 'MOVIE_ANALYSIS_ERROR', 422);
    this.name = 'MovieAnalysisError';
  }
}
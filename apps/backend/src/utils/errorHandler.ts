import { Request, Response } from 'express';
import { RecoveryAction } from '../types/common';
import { 
  DubbingWorkflowError, 
  VideoProcessingError, 
  TranscriptionError, 
  TTSError, 
  AssemblyError,
  ValidationError,
  ProcessingError,
  MovieAnalysisError,
  ErrorContext
} from '../types/errors';

export interface ErrorHandler {
  handleTranscriptionError(error: TranscriptionError): Promise<RecoveryAction>;
  handleTTSError(error: TTSError): Promise<RecoveryAction>;
  handleAssemblyError(error: AssemblyError): Promise<RecoveryAction>;
  handleProcessingError(error: unknown, context?: any): Promise<RecoveryAction>;
}

export class DefaultErrorHandler implements ErrorHandler {
  private errorCounts: Map<string, number> = new Map();
  private lastErrorTime: Map<string, number> = new Map();

  // Express error handling
  handleExpressError(error: Error, req?: Request, res?: Response): void {
    const errorKey = this.getErrorKey(error);
    const now = Date.now();
    
    // Track error frequency
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    this.lastErrorTime.set(errorKey, now);

    // Log error with context
    this.logError(error, req);

    if (res && !res.headersSent) {
      this.sendErrorResponse(error, res);
    }
  }

  private getErrorKey(error: Error): string {
    return `${error.name}:${error.message.substring(0, 50)}`;
  }

  private logError(error: Error, req?: Request): void {
    const logData: any = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      request: req ? {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      } : undefined
    };

    if (error instanceof DubbingWorkflowError) {
      logData.error.code = error.code;
      logData.error.statusCode = error.statusCode;
    }

    console.error('Error occurred:', JSON.stringify(logData, null, 2));
  }

  private sendErrorResponse(error: Error, res: Response): void {
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An internal error occurred';
    let details: any = undefined;

    if (error instanceof ValidationError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
      details = { validationErrors: error.details };
    } else if (error instanceof ProcessingError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
      details = { 
        stage: error.stage, 
        recoverable: error.recoverable,
        suggestion: this.getRecoverySuggestion(error)
      };
    } else if (error instanceof DubbingWorkflowError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  private getRecoverySuggestion(error: ProcessingError): string {
    switch (error.stage) {
      case 'TRANSCRIBING':
        return 'Try uploading a different SRT file or check if the original audio quality is sufficient';
      case 'TRANSLATING':
        return 'The translation service may be temporarily unavailable. Please try again in a few minutes';
      case 'ANALYZING':
        return 'Movie analysis failed. The translation may still be available without detailed analysis';
      case 'GENERATING_SRT':
        return 'SRT generation failed. Please contact support with your job ID';
      default:
        return 'Please try again or contact support if the problem persists';
    }
  }

  getErrorStats(): { errorKey: string; count: number; lastOccurrence: Date }[] {
    const stats: { errorKey: string; count: number; lastOccurrence: Date }[] = [];
    
    for (const [errorKey, count] of this.errorCounts.entries()) {
      const lastTime = this.lastErrorTime.get(errorKey);
      if (lastTime) {
        stats.push({
          errorKey,
          count,
          lastOccurrence: new Date(lastTime)
        });
      }
    }
    
    return stats.sort((a, b) => b.count - a.count);
  }

  clearErrorStats(): void {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }
  async handleTranscriptionError(error: TranscriptionError): Promise<RecoveryAction> {
    // Check if it's a temporary issue that can be retried
    if (this.isRetryableError(error)) {
      return RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
    }

    // Check if it's a model-specific issue
    if (error.message.includes('model') || error.message.includes('whisper')) {
      return RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
    }

    return RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
  }

  async handleTTSError(error: TTSError): Promise<RecoveryAction> {
    // Check if it's a quota issue
    if (error.message.includes('quota') || error.message.includes('limit')) {
      return RecoveryAction.FALLBACK_TO_ALTERNATIVE_SERVICE;
    }

    // Check if it's a network/API issue
    if (this.isNetworkError(error)) {
      return RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
    }

    // Check if it's a service-specific issue
    if (error.service === 'google_cloud' && this.isRetryableError(error)) {
      return RecoveryAction.FALLBACK_TO_ALTERNATIVE_SERVICE;
    }

    return RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
  }

  async handleAssemblyError(error: AssemblyError): Promise<RecoveryAction> {
    // Check if it's a file system issue
    if (error.message.includes('ENOSPC') || error.message.includes('disk')) {
      return RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
    }

    // Check if it's a temporary processing issue
    if (this.isRetryableError(error)) {
      return RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
    }

    return RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
  }

  async handleProcessingError(error: unknown, context?: any): Promise<RecoveryAction> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle specific error types
    if (error instanceof TranscriptionError) {
      return this.handleTranscriptionError(error);
    }
    
    if (error instanceof TTSError) {
      return this.handleTTSError(error);
    }
    
    if (error instanceof AssemblyError) {
      return this.handleAssemblyError(error);
    }
    
    if (error instanceof VideoProcessingError) {
      // Handle video processing errors
      if (this.isRetryableError(error)) {
        return RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
      }
      return RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
    }

    // Handle generic errors
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
    }
    
    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      return RecoveryAction.FALLBACK_TO_ALTERNATIVE_SERVICE;
    }
    
    if (errorMessage.includes('disk') || errorMessage.includes('space')) {
      return RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
    }

    // Default to manual intervention for unknown errors
    return RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
  }

  private isRetryableError(error: DubbingWorkflowError): boolean {
    const retryableMessages = [
      'timeout',
      'connection',
      'network',
      'temporary',
      'busy',
      'unavailable'
    ];

    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  private isNetworkError(error: DubbingWorkflowError): boolean {
    const networkMessages = [
      'network',
      'connection',
      'timeout',
      'dns',
      'unreachable'
    ];

    return networkMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }
}

export function createErrorResponse(error: DubbingWorkflowError): {
  success: false;
  error: string;
  code: string;
  statusCode: number;
} {
  return {
    success: false,
    error: error.message,
    code: error.code,
    statusCode: error.statusCode
  };
}
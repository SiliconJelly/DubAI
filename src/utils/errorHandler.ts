import { RecoveryAction } from '../types/common';
import { 
  DubbingWorkflowError, 
  VideoProcessingError, 
  TranscriptionError, 
  TTSError, 
  AssemblyError 
} from '../types/errors';

export interface ErrorHandler {
  handleTranscriptionError(error: TranscriptionError): Promise<RecoveryAction>;
  handleTTSError(error: TTSError): Promise<RecoveryAction>;
  handleAssemblyError(error: AssemblyError): Promise<RecoveryAction>;
  handleProcessingError(error: unknown, context?: any): Promise<RecoveryAction>;
}

export class DefaultErrorHandler implements ErrorHandler {
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
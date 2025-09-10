"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaExceededError = exports.AssemblyError = exports.TTSError = exports.TranscriptionError = exports.VideoProcessingError = exports.DubbingWorkflowError = void 0;
class DubbingWorkflowError extends Error {
    constructor(message, code, statusCode = 500) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'DubbingWorkflowError';
    }
}
exports.DubbingWorkflowError = DubbingWorkflowError;
class VideoProcessingError extends DubbingWorkflowError {
    constructor(message, originalError) {
        super(message, 'VIDEO_PROCESSING_ERROR', 422);
        this.originalError = originalError;
        this.name = 'VideoProcessingError';
    }
}
exports.VideoProcessingError = VideoProcessingError;
class TranscriptionError extends DubbingWorkflowError {
    constructor(message, originalError) {
        super(message, 'TRANSCRIPTION_ERROR', 422);
        this.originalError = originalError;
        this.name = 'TranscriptionError';
    }
}
exports.TranscriptionError = TranscriptionError;
class TTSError extends DubbingWorkflowError {
    constructor(message, service, originalError) {
        super(message, 'TTS_ERROR', 422);
        this.service = service;
        this.originalError = originalError;
        this.name = 'TTSError';
    }
}
exports.TTSError = TTSError;
class AssemblyError extends DubbingWorkflowError {
    constructor(message, originalError) {
        super(message, 'ASSEMBLY_ERROR', 422);
        this.originalError = originalError;
        this.name = 'AssemblyError';
    }
}
exports.AssemblyError = AssemblyError;
class QuotaExceededError extends DubbingWorkflowError {
    constructor(service, limit) {
        super(`Quota exceeded for ${service}. Limit: ${limit}`, 'QUOTA_EXCEEDED', 429);
        this.name = 'QuotaExceededError';
    }
}
exports.QuotaExceededError = QuotaExceededError;

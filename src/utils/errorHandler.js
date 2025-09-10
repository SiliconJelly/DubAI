"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultErrorHandler = void 0;
exports.createErrorResponse = createErrorResponse;
const common_1 = require("../types/common");
class DefaultErrorHandler {
    async handleTranscriptionError(error) {
        // Check if it's a temporary issue that can be retried
        if (this.isRetryableError(error)) {
            return common_1.RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
        }
        // Check if it's a model-specific issue
        if (error.message.includes('model') || error.message.includes('whisper')) {
            return common_1.RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
        }
        return common_1.RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
    }
    async handleTTSError(error) {
        // Check if it's a quota issue
        if (error.message.includes('quota') || error.message.includes('limit')) {
            return common_1.RecoveryAction.FALLBACK_TO_ALTERNATIVE_SERVICE;
        }
        // Check if it's a network/API issue
        if (this.isNetworkError(error)) {
            return common_1.RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
        }
        // Check if it's a service-specific issue
        if (error.service === 'google_cloud' && this.isRetryableError(error)) {
            return common_1.RecoveryAction.FALLBACK_TO_ALTERNATIVE_SERVICE;
        }
        return common_1.RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
    }
    async handleAssemblyError(error) {
        // Check if it's a file system issue
        if (error.message.includes('ENOSPC') || error.message.includes('disk')) {
            return common_1.RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
        }
        // Check if it's a temporary processing issue
        if (this.isRetryableError(error)) {
            return common_1.RecoveryAction.RETRY_WITH_DIFFERENT_PARAMS;
        }
        return common_1.RecoveryAction.MANUAL_INTERVENTION_REQUIRED;
    }
    isRetryableError(error) {
        const retryableMessages = [
            'timeout',
            'connection',
            'network',
            'temporary',
            'busy',
            'unavailable'
        ];
        return retryableMessages.some(msg => error.message.toLowerCase().includes(msg));
    }
    isNetworkError(error) {
        const networkMessages = [
            'network',
            'connection',
            'timeout',
            'dns',
            'unreachable'
        ];
        return networkMessages.some(msg => error.message.toLowerCase().includes(msg));
    }
}
exports.DefaultErrorHandler = DefaultErrorHandler;
function createErrorResponse(error) {
    return {
        success: false,
        error: error.message,
        code: error.code,
        statusCode: error.statusCode
    };
}

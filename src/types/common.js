"use strict";
// Common types and enums used across the application
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryAction = exports.TTSServiceType = exports.JobStatus = void 0;
var JobStatus;
(function (JobStatus) {
    JobStatus["PENDING"] = "pending";
    JobStatus["PROCESSING"] = "processing";
    JobStatus["COMPLETED"] = "completed";
    JobStatus["FAILED"] = "failed";
    JobStatus["CANCELLED"] = "cancelled";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var TTSServiceType;
(function (TTSServiceType) {
    TTSServiceType["GOOGLE_CLOUD"] = "google_cloud";
    TTSServiceType["COQUI_LOCAL"] = "coqui_local";
})(TTSServiceType || (exports.TTSServiceType = TTSServiceType = {}));
var RecoveryAction;
(function (RecoveryAction) {
    RecoveryAction["RETRY_WITH_DIFFERENT_PARAMS"] = "retry_with_different_params";
    RecoveryAction["FALLBACK_TO_ALTERNATIVE_SERVICE"] = "fallback_to_alternative_service";
    RecoveryAction["MANUAL_INTERVENTION_REQUIRED"] = "manual_intervention_required";
    RecoveryAction["ABORT_PROCESSING"] = "abort_processing";
})(RecoveryAction || (exports.RecoveryAction = RecoveryAction = {}));

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingJobImpl = void 0;
const common_1 = require("../types/common");
class ProcessingJobImpl {
    constructor(id, status, inputVideo, costTracking, outputVideo, progress = 0, createdAt = new Date(), completedAt, errorMessage) {
        this.id = id;
        this.status = status;
        this.inputVideo = inputVideo;
        this.costTracking = costTracking;
        this.outputVideo = outputVideo;
        this.progress = progress;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
        this.errorMessage = errorMessage;
    }
    validate() {
        return !!(this.id &&
            this.status &&
            this.inputVideo &&
            this.costTracking &&
            this.progress >= 0 &&
            this.progress <= 100 &&
            this.createdAt);
    }
    updateProgress(progress) {
        this.progress = Math.min(100, Math.max(0, progress));
    }
    markCompleted(outputVideo) {
        this.status = common_1.JobStatus.COMPLETED;
        this.outputVideo = outputVideo;
        this.completedAt = new Date();
        this.progress = 100;
    }
    markFailed(errorMessage) {
        this.status = common_1.JobStatus.FAILED;
        this.errorMessage = errorMessage;
        this.completedAt = new Date();
    }
    getDuration() {
        if (!this.completedAt)
            return 0;
        return this.completedAt.getTime() - this.createdAt.getTime();
    }
}
exports.ProcessingJobImpl = ProcessingJobImpl;

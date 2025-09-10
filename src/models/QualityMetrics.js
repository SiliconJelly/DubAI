"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityMetricsImpl = void 0;
class QualityMetricsImpl {
    constructor(audioQuality, synchronizationAccuracy, processingTime, userSatisfaction) {
        this.audioQuality = audioQuality;
        this.synchronizationAccuracy = synchronizationAccuracy;
        this.processingTime = processingTime;
        this.userSatisfaction = userSatisfaction;
    }
    validate() {
        return this.audioQuality >= 0 &&
            this.audioQuality <= 1 &&
            this.synchronizationAccuracy >= 0 &&
            this.synchronizationAccuracy <= 1 &&
            this.processingTime >= 0 &&
            (this.userSatisfaction === undefined ||
                (this.userSatisfaction >= 0 && this.userSatisfaction <= 1));
    }
    getOverallScore() {
        const weights = {
            audioQuality: 0.4,
            synchronizationAccuracy: 0.4,
            userSatisfaction: 0.2
        };
        let score = this.audioQuality * weights.audioQuality +
            this.synchronizationAccuracy * weights.synchronizationAccuracy;
        if (this.userSatisfaction !== undefined) {
            score += this.userSatisfaction * weights.userSatisfaction;
        }
        else {
            // Redistribute weight if user satisfaction is not available
            score = score / (weights.audioQuality + weights.synchronizationAccuracy);
        }
        return Math.min(1, Math.max(0, score));
    }
}
exports.QualityMetricsImpl = QualityMetricsImpl;

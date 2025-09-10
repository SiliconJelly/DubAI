import { ModelInfo } from '../types/common';

export interface QualityMetrics {
  audioQuality: number;
  synchronizationAccuracy: number;
  processingTime: number;
  userSatisfaction?: number | undefined;
}

export class QualityMetricsImpl implements QualityMetrics {
  constructor(
    public audioQuality: number,
    public synchronizationAccuracy: number,
    public processingTime: number,
    public userSatisfaction?: number
  ) {}

  validate(): boolean {
    return this.audioQuality >= 0 && 
           this.audioQuality <= 1 &&
           this.synchronizationAccuracy >= 0 && 
           this.synchronizationAccuracy <= 1 &&
           this.processingTime >= 0 &&
           (this.userSatisfaction === undefined || 
            (this.userSatisfaction >= 0 && this.userSatisfaction <= 1));
  }

  getOverallScore(): number {
    const weights = {
      audioQuality: 0.4,
      synchronizationAccuracy: 0.4,
      userSatisfaction: 0.2
    };

    let score = this.audioQuality * weights.audioQuality + 
                this.synchronizationAccuracy * weights.synchronizationAccuracy;

    if (this.userSatisfaction !== undefined) {
      score += this.userSatisfaction * weights.userSatisfaction;
    } else {
      // Redistribute weight if user satisfaction is not available
      score = score / (weights.audioQuality + weights.synchronizationAccuracy);
    }

    return Math.min(1, Math.max(0, score));
  }
}
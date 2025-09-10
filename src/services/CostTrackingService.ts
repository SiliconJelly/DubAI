import { CostMetrics } from '../models';
import { UsageMetrics } from '../types/common';
import { TTSServiceType } from '../types/common';

export interface CostTrackingService {
  trackUsage(service: TTSServiceType, usage: UsageMetrics): Promise<void>;
  getCostMetrics(jobId: string): Promise<CostMetrics>;
  generateCostReport(startDate: Date, endDate: Date): Promise<CostReport>;
  checkQuotaStatus(service: TTSServiceType): Promise<boolean>;
  calculateJobCost(jobId: string): Promise<CostMetrics>;
}

export interface CostReport {
  totalCost: number;
  breakdown: {
    googleTTS: number;
    coquiTTS: number;
    compute: number;
  };
  usage: {
    totalJobs: number;
    totalCharacters: number;
    totalComputeTime: number;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}
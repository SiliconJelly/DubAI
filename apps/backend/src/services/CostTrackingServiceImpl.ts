import { CostTrackingService, CostReport } from './CostTrackingService';
import { CostMetrics, CostMetricsImpl } from '../models/CostMetrics';
import { UsageMetrics, TTSServiceType, QuotaStatus } from '../types/common';
import { v4 as uuidv4 } from 'uuid';

export interface CostTrackingServiceConfig {
  // Google Cloud TTS pricing (per character)
  googleTTSPricePerCharacter: number;
  
  // Local compute cost estimation (per second)
  localComputeCostPerSecond: number;
  
  // Quota limits
  googleTTSMonthlyQuota: number;
  
  // Alert thresholds (percentage of quota/budget)
  quotaAlertThreshold: number;
  costAlertThreshold: number;
  
  // Storage for persistent tracking
  storageDirectory: string;
}

export interface CostAlert {
  id: string;
  type: 'quota' | 'cost';
  service: TTSServiceType;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
}

export class CostTrackingServiceImpl implements CostTrackingService {
  private config: CostTrackingServiceConfig;
  private jobCosts: Map<string, CostMetricsImpl> = new Map();
  private totalUsage: Map<TTSServiceType, UsageMetrics> = new Map();
  private alerts: CostAlert[] = [];
  
  // Current period tracking (resets monthly)
  private currentPeriodStart: Date;
  private googleTTSUsageThisPeriod: number = 0;

  constructor(config: CostTrackingServiceConfig) {
    this.config = config;
    this.currentPeriodStart = this.getMonthStart(new Date());
    
    // Initialize usage tracking for each service
    this.totalUsage.set(TTSServiceType.GOOGLE_CLOUD, {
      charactersProcessed: 0,
      processingTimeMs: 0,
      apiCalls: 0,
      errorCount: 0
    });
    
    this.totalUsage.set(TTSServiceType.COQUI_LOCAL, {
      charactersProcessed: 0,
      processingTimeMs: 0,
      apiCalls: 0,
      errorCount: 0
    });
  }

  async trackUsage(service: TTSServiceType, usage: UsageMetrics): Promise<void> {
    try {
      // Update total usage for the service
      const currentUsage = this.totalUsage.get(service)!;
      currentUsage.charactersProcessed += usage.charactersProcessed;
      currentUsage.processingTimeMs += usage.processingTimeMs;
      currentUsage.apiCalls += usage.apiCalls;
      currentUsage.errorCount += usage.errorCount;

      // Calculate costs based on service type
      let cost = 0;
      if (service === TTSServiceType.GOOGLE_CLOUD) {
        cost = usage.charactersProcessed * this.config.googleTTSPricePerCharacter;
        this.googleTTSUsageThisPeriod += usage.charactersProcessed;
      } else if (service === TTSServiceType.COQUI_LOCAL) {
        const computeTimeSeconds = usage.processingTimeMs / 1000;
        cost = computeTimeSeconds * this.config.localComputeCostPerSecond;
      }

      // Check for alerts
      await this.checkAlerts(service, usage);

      console.log(`Tracked usage for ${service}: ${usage.charactersProcessed} characters, cost: $${cost.toFixed(4)}`);
    } catch (error) {
      console.error(`Failed to track usage for ${service}:`, error);
      throw error;
    }
  }

  async getCostMetrics(jobId: string): Promise<CostMetrics> {
    const metrics = this.jobCosts.get(jobId);
    if (!metrics) {
      // Return empty metrics if job not found
      return new CostMetricsImpl();
    }
    return metrics;
  }

  async generateCostReport(startDate: Date, endDate: Date): Promise<CostReport> {
    try {
      // Calculate costs for each service within the date range
      const googleUsage = this.totalUsage.get(TTSServiceType.GOOGLE_CLOUD)!;
      const coquiUsage = this.totalUsage.get(TTSServiceType.COQUI_LOCAL)!;

      const googleCost = googleUsage.charactersProcessed * this.config.googleTTSPricePerCharacter;
      const coquiCost = (coquiUsage.processingTimeMs / 1000) * this.config.localComputeCostPerSecond;
      const computeCost = coquiCost; // For now, compute cost is same as Coqui cost

      const totalCost = googleCost + coquiCost;
      const totalJobs = this.jobCosts.size;
      const totalCharacters = googleUsage.charactersProcessed + coquiUsage.charactersProcessed;
      const totalComputeTime = (googleUsage.processingTimeMs + coquiUsage.processingTimeMs) / 1000;

      return {
        totalCost,
        breakdown: {
          googleTTS: googleCost,
          coquiTTS: coquiCost,
          compute: computeCost
        },
        usage: {
          totalJobs,
          totalCharacters,
          totalComputeTime
        },
        period: {
          startDate,
          endDate
        }
      };
    } catch (error) {
      console.error('Failed to generate cost report:', error);
      throw error;
    }
  }

  async checkQuotaStatus(service: TTSServiceType): Promise<boolean> {
    try {
      if (service === TTSServiceType.GOOGLE_CLOUD) {
        const remaining = this.config.googleTTSMonthlyQuota - this.googleTTSUsageThisPeriod;
        return remaining > 0;
      }
      
      // Coqui TTS has no quota limits (local processing)
      return true;
    } catch (error) {
      console.error(`Failed to check quota status for ${service}:`, error);
      return false;
    }
  }

  // Additional methods for enhanced functionality

  async getQuotaStatus(service: TTSServiceType): Promise<QuotaStatus> {
    if (service === TTSServiceType.GOOGLE_CLOUD) {
      const used = this.googleTTSUsageThisPeriod;
      const limit = this.config.googleTTSMonthlyQuota;
      const remaining = Math.max(0, limit - used);
      const resetDate = this.getNextMonthStart();

      return {
        used,
        limit,
        remaining,
        resetDate
      };
    }

    // Coqui TTS has unlimited usage
    return {
      used: 0,
      limit: Number.MAX_SAFE_INTEGER,
      remaining: Number.MAX_SAFE_INTEGER,
      resetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    };
  }

  async addJobCost(jobId: string, metrics: CostMetrics): Promise<void> {
    this.jobCosts.set(jobId, new CostMetricsImpl(
      metrics.googleTTSCharacters,
      metrics.googleTTSCost,
      metrics.coquiTTSUsage,
      metrics.computeTime,
      metrics.totalCost
    ));
  }

  async getAlerts(): Promise<CostAlert[]> {
    return [...this.alerts];
  }

  async clearAlerts(): Promise<void> {
    this.alerts = [];
  }

  async resetMonthlyUsage(): Promise<void> {
    this.googleTTSUsageThisPeriod = 0;
    this.currentPeriodStart = this.getMonthStart(new Date());
    console.log('Monthly usage reset completed');
  }

  async calculateJobCost(job: any): Promise<CostMetrics> {
    try {
      // Get existing cost metrics for the job or create new ones
      let metrics = this.jobCosts.get(job.id);
      if (!metrics) {
        metrics = new CostMetricsImpl();
      }

      // Calculate costs based on job processing
      let googleTTSCost = 0;
      let coquiTTSUsage = 0;
      let computeTime = 0;

      // Estimate costs based on job duration and processing
      const jobDuration = job.getDuration ? job.getDuration() : 0;
      computeTime = jobDuration / 1000; // Convert to seconds

      // Estimate character count from input video duration (rough estimate)
      const estimatedCharacters = job.inputVideo?.duration ? Math.floor(job.inputVideo.duration * 10) : 0;

      // Assume 50/50 split between Google TTS and Coqui TTS for cost estimation
      const googleCharacters = Math.floor(estimatedCharacters * 0.5);
      const coquiCharacters = estimatedCharacters - googleCharacters;

      googleTTSCost = googleCharacters * this.config.googleTTSPricePerCharacter;
      coquiTTSUsage = (coquiCharacters / 10) * this.config.localComputeCostPerSecond; // Rough estimate

      const totalCost = googleTTSCost + coquiTTSUsage;

      const finalMetrics = new CostMetricsImpl(
        googleCharacters,
        googleTTSCost,
        coquiTTSUsage,
        computeTime,
        totalCost
      );

      // Store the calculated metrics
      this.jobCosts.set(job.id, finalMetrics);

      return finalMetrics;
    } catch (error) {
      console.error(`Failed to calculate job cost for ${job.id}:`, error);
      // Return empty metrics on error
      return new CostMetricsImpl();
    }
  }

  private async checkAlerts(service: TTSServiceType, usage: UsageMetrics): Promise<void> {
    // Check quota alerts for Google Cloud TTS
    if (service === TTSServiceType.GOOGLE_CLOUD) {
      const quotaUsagePercentage = (this.googleTTSUsageThisPeriod / this.config.googleTTSMonthlyQuota) * 100;
      
      if (quotaUsagePercentage >= this.config.quotaAlertThreshold) {
        const alert: CostAlert = {
          id: uuidv4(),
          type: 'quota',
          service,
          threshold: this.config.quotaAlertThreshold,
          currentValue: quotaUsagePercentage,
          message: `Google Cloud TTS quota usage at ${quotaUsagePercentage.toFixed(1)}% (${this.googleTTSUsageThisPeriod}/${this.config.googleTTSMonthlyQuota} characters)`,
          timestamp: new Date()
        };
        
        this.alerts.push(alert);
        console.warn('QUOTA ALERT:', alert.message);
      }
    }

    // Check cost alerts
    const currentCost = await this.calculateCurrentPeriodCost();
    const costThreshold = this.config.costAlertThreshold; // Assuming this is a dollar amount
    
    if (currentCost >= costThreshold) {
      const alert: CostAlert = {
        id: uuidv4(),
        type: 'cost',
        service,
        threshold: costThreshold,
        currentValue: currentCost,
        message: `Cost threshold exceeded: $${currentCost.toFixed(2)} >= $${costThreshold.toFixed(2)}`,
        timestamp: new Date()
      };
      
      this.alerts.push(alert);
      console.warn('COST ALERT:', alert.message);
    }
  }

  private async calculateCurrentPeriodCost(): Promise<number> {
    const googleUsage = this.totalUsage.get(TTSServiceType.GOOGLE_CLOUD)!;
    const coquiUsage = this.totalUsage.get(TTSServiceType.COQUI_LOCAL)!;

    const googleCost = googleUsage.charactersProcessed * this.config.googleTTSPricePerCharacter;
    const coquiCost = (coquiUsage.processingTimeMs / 1000) * this.config.localComputeCostPerSecond;

    return googleCost + coquiCost;
  }

  private getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}
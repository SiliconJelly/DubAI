import { CostTrackingServiceImpl, CostTrackingServiceConfig, CostAlert } from '../services/CostTrackingServiceImpl';
import { CostTrackingService, CostReport } from '../services/CostTrackingService';
import { CostMetrics, CostMetricsImpl } from '../models/CostMetrics';
import { UsageMetrics, TTSServiceType, QuotaStatus } from '../types/common';
import * as path from 'path';
import * as os from 'os';

describe('CostTrackingServiceImpl', () => {
  let service: CostTrackingService;
  let config: CostTrackingServiceConfig;

  beforeEach(() => {
    config = {
      googleTTSPricePerCharacter: 0.000016, // $16 per 1M characters
      localComputeCostPerSecond: 0.001, // $0.001 per second
      googleTTSMonthlyQuota: 4000000, // 4M characters
      quotaAlertThreshold: 80, // 80%
      costAlertThreshold: 50, // $50
      storageDirectory: path.join(os.tmpdir(), 'cost-tracking-test')
    };

    service = new CostTrackingServiceImpl(config);
  });

  describe('trackUsage', () => {
    it('should track Google Cloud TTS usage correctly', async () => {
      const usage: UsageMetrics = {
        charactersProcessed: 1000,
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);

      // Verify the usage was tracked (we can't directly access private members, 
      // but we can verify through other methods)
      const quotaStatus = await (service as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      expect(quotaStatus.used).toBe(1000);
      expect(quotaStatus.remaining).toBe(config.googleTTSMonthlyQuota - 1000);
    });

    it('should track Coqui TTS usage correctly', async () => {
      const usage: UsageMetrics = {
        charactersProcessed: 500,
        processingTimeMs: 3000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.COQUI_LOCAL, usage);

      // Coqui TTS should have unlimited quota
      const quotaStatus = await (service as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.COQUI_LOCAL);
      expect(quotaStatus.remaining).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle multiple usage tracking calls', async () => {
      const usage1: UsageMetrics = {
        charactersProcessed: 1000,
        processingTimeMs: 2000,
        apiCalls: 1,
        errorCount: 0
      };

      const usage2: UsageMetrics = {
        charactersProcessed: 1500,
        processingTimeMs: 3000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage1);
      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage2);

      const quotaStatus = await (service as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      expect(quotaStatus.used).toBe(2500); // 1000 + 1500
    });

    it('should generate quota alerts when threshold is exceeded', async () => {
      // Use a large amount that exceeds the alert threshold (80% of 4M = 3.2M)
      const usage: UsageMetrics = {
        charactersProcessed: 3300000, // Exceeds 80% threshold
        processingTimeMs: 10000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);

      const alerts = await (service as CostTrackingServiceImpl).getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const quotaAlert = alerts.find(alert => alert.type === 'quota');
      expect(quotaAlert).toBeDefined();
      expect(quotaAlert!.service).toBe(TTSServiceType.GOOGLE_CLOUD);
      expect(quotaAlert!.currentValue).toBeGreaterThan(80);
    });
  });

  describe('getCostMetrics', () => {
    it('should return empty metrics for unknown job', async () => {
      const metrics = await service.getCostMetrics('unknown-job-id');
      
      expect(metrics.googleTTSCharacters).toBe(0);
      expect(metrics.googleTTSCost).toBe(0);
      expect(metrics.coquiTTSUsage).toBe(0);
      expect(metrics.computeTime).toBe(0);
      expect(metrics.totalCost).toBe(0);
    });

    it('should return correct metrics for tracked job', async () => {
      const jobId = 'test-job-123';
      const testMetrics = new CostMetricsImpl(1000, 0.016, 5, 5, 0.021);

      await (service as CostTrackingServiceImpl).addJobCost(jobId, testMetrics);
      
      const retrievedMetrics = await service.getCostMetrics(jobId);
      expect(retrievedMetrics.googleTTSCharacters).toBe(1000);
      expect(retrievedMetrics.googleTTSCost).toBe(0.016);
      expect(retrievedMetrics.coquiTTSUsage).toBe(5);
      expect(retrievedMetrics.computeTime).toBe(5);
      expect(retrievedMetrics.totalCost).toBe(0.021);
    });
  });

  describe('generateCostReport', () => {
    it('should generate accurate cost report', async () => {
      // Track some usage first
      const googleUsage: UsageMetrics = {
        charactersProcessed: 100000,
        processingTimeMs: 5000,
        apiCalls: 2,
        errorCount: 0
      };

      const coquiUsage: UsageMetrics = {
        charactersProcessed: 50000,
        processingTimeMs: 10000, // 10 seconds
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, googleUsage);
      await service.trackUsage(TTSServiceType.COQUI_LOCAL, coquiUsage);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const report = await service.generateCostReport(startDate, endDate);

      // Verify calculations
      const expectedGoogleCost = 100000 * config.googleTTSPricePerCharacter; // 100k * $0.000016 = $1.6
      const expectedCoquiCost = 10 * config.localComputeCostPerSecond; // 10 seconds * $0.001 = $0.01
      
      expect(report.breakdown.googleTTS).toBeCloseTo(expectedGoogleCost, 6);
      expect(report.breakdown.coquiTTS).toBeCloseTo(expectedCoquiCost, 6);
      expect(report.totalCost).toBeCloseTo(expectedGoogleCost + expectedCoquiCost, 6);
      
      expect(report.usage.totalCharacters).toBe(150000); // 100k + 50k
      expect(report.usage.totalComputeTime).toBe(15); // (5000 + 10000) / 1000
      
      expect(report.period.startDate).toEqual(startDate);
      expect(report.period.endDate).toEqual(endDate);
    });

    it('should handle empty usage data', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const report = await service.generateCostReport(startDate, endDate);

      expect(report.totalCost).toBe(0);
      expect(report.breakdown.googleTTS).toBe(0);
      expect(report.breakdown.coquiTTS).toBe(0);
      expect(report.usage.totalCharacters).toBe(0);
      expect(report.usage.totalComputeTime).toBe(0);
    });
  });

  describe('checkQuotaStatus', () => {
    it('should return true for Google Cloud TTS when under quota', async () => {
      const usage: UsageMetrics = {
        charactersProcessed: 1000000, // 1M characters, well under 4M limit
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);
      
      const hasQuota = await service.checkQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      expect(hasQuota).toBe(true);
    });

    it('should return false for Google Cloud TTS when quota exceeded', async () => {
      const usage: UsageMetrics = {
        charactersProcessed: 5000000, // 5M characters, exceeds 4M limit
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);
      
      const hasQuota = await service.checkQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      expect(hasQuota).toBe(false);
    });

    it('should always return true for Coqui TTS (unlimited)', async () => {
      const hasQuota = await service.checkQuotaStatus(TTSServiceType.COQUI_LOCAL);
      expect(hasQuota).toBe(true);
    });
  });

  describe('getQuotaStatus', () => {
    it('should return correct quota status for Google Cloud TTS', async () => {
      const usage: UsageMetrics = {
        charactersProcessed: 1000000, // 1M characters
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);
      
      const quotaStatus = await (service as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      
      expect(quotaStatus.used).toBe(1000000);
      expect(quotaStatus.limit).toBe(config.googleTTSMonthlyQuota);
      expect(quotaStatus.remaining).toBe(config.googleTTSMonthlyQuota - 1000000);
      expect(quotaStatus.resetDate).toBeInstanceOf(Date);
    });

    it('should return unlimited quota for Coqui TTS', async () => {
      const quotaStatus = await (service as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.COQUI_LOCAL);
      
      expect(quotaStatus.used).toBe(0);
      expect(quotaStatus.limit).toBe(Number.MAX_SAFE_INTEGER);
      expect(quotaStatus.remaining).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('alert management', () => {
    it('should track and retrieve alerts', async () => {
      // Generate a quota alert by exceeding threshold
      const usage: UsageMetrics = {
        charactersProcessed: 3300000, // Exceeds 80% of 4M
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);
      
      const alerts = await (service as CostTrackingServiceImpl).getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const alert = alerts[0];
      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('quota');
      expect(alert.service).toBe(TTSServiceType.GOOGLE_CLOUD);
      expect(alert.timestamp).toBeInstanceOf(Date);
    });

    it('should clear alerts', async () => {
      // Generate an alert first
      const usage: UsageMetrics = {
        charactersProcessed: 3300000,
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);
      
      let alerts = await (service as CostTrackingServiceImpl).getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      await (service as CostTrackingServiceImpl).clearAlerts();
      
      alerts = await (service as CostTrackingServiceImpl).getAlerts();
      expect(alerts.length).toBe(0);
    });
  });

  describe('cost calculations', () => {
    it('should calculate Google Cloud TTS costs correctly', async () => {
      const characters = 1000000; // 1M characters
      const expectedCost = characters * config.googleTTSPricePerCharacter; // 1M * $0.000016 = $16

      const usage: UsageMetrics = {
        charactersProcessed: characters,
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);
      
      const report = await service.generateCostReport(new Date(), new Date());
      expect(report.breakdown.googleTTS).toBeCloseTo(expectedCost, 6);
    });

    it('should calculate Coqui TTS costs correctly', async () => {
      const processingTimeMs = 30000; // 30 seconds
      const expectedCost = (processingTimeMs / 1000) * config.localComputeCostPerSecond; // 30 * $0.001 = $0.03

      const usage: UsageMetrics = {
        charactersProcessed: 1000,
        processingTimeMs: processingTimeMs,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.COQUI_LOCAL, usage);
      
      const report = await service.generateCostReport(new Date(), new Date());
      expect(report.breakdown.coquiTTS).toBeCloseTo(expectedCost, 6);
    });
  });

  describe('monthly usage reset', () => {
    it('should reset monthly usage correctly', async () => {
      // Track some usage
      const usage: UsageMetrics = {
        charactersProcessed: 1000000,
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      await service.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);
      
      let quotaStatus = await (service as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      expect(quotaStatus.used).toBe(1000000);
      
      // Reset usage
      await (service as CostTrackingServiceImpl).resetMonthlyUsage();
      
      quotaStatus = await (service as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      expect(quotaStatus.used).toBe(0);
      expect(quotaStatus.remaining).toBe(config.googleTTSMonthlyQuota);
    });
  });

  describe('error handling', () => {
    it('should handle NaN costs gracefully in trackUsage', async () => {
      // Create a service with invalid config to trigger NaN costs
      const invalidConfig = { ...config, googleTTSPricePerCharacter: NaN };
      const invalidService = new CostTrackingServiceImpl(invalidConfig);

      const usage: UsageMetrics = {
        charactersProcessed: 1000,
        processingTimeMs: 5000,
        apiCalls: 1,
        errorCount: 0
      };

      // Should complete without throwing, but cost will be NaN
      await invalidService.trackUsage(TTSServiceType.GOOGLE_CLOUD, usage);
      
      // Verify that the service continues to function despite NaN cost
      const quotaStatus = await (invalidService as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      expect(quotaStatus.used).toBe(1000); // Usage should still be tracked
    });

    it('should handle invalid dates in generateCostReport', async () => {
      // This test ensures the service handles edge cases gracefully
      const startDate = new Date('invalid-date');
      const endDate = new Date('2024-01-31');

      // Should complete without throwing, even with invalid start date
      const report = await service.generateCostReport(startDate, endDate);
      
      // Verify the report structure is still valid
      expect(report.totalCost).toBe(0);
      expect(report.breakdown).toBeDefined();
      expect(report.usage).toBeDefined();
      expect(report.period.endDate).toEqual(endDate);
      expect(isNaN(report.period.startDate.getTime())).toBe(true); // Invalid date
    });

    it('should handle errors when checking quota status', async () => {
      // Test with a service that might have issues
      const result = await service.checkQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
      expect(typeof result).toBe('boolean');
    });
  });
});
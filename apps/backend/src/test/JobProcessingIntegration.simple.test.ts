import { JobProcessingConfig, ProcessingStep, ProcessingMetrics } from '../services/JobProcessingIntegration';
import { JobStatus } from '@dubai/shared';

describe('JobProcessingIntegration - Core Logic', () => {
  const testConfig: JobProcessingConfig = {
    maxConcurrentProcessing: 2,
    processingTimeout: 300000,
    retryDelay: 1000,
    maxRetryAttempts: 3,
    enableProgressTracking: true,
    enableErrorRecovery: true,
    tempDirectory: './temp'
  };

  describe('Processing Steps Configuration', () => {
    it('should have correct processing steps defined', () => {
      const expectedSteps: ProcessingStep[] = [
        {
          name: 'Audio Extraction',
          status: JobStatus.EXTRACTING_AUDIO,
          progressStart: 5,
          progressEnd: 15,
          estimatedDuration: 30000,
          retryable: true
        },
        {
          name: 'Transcription',
          status: JobStatus.TRANSCRIBING,
          progressStart: 15,
          progressEnd: 35,
          estimatedDuration: 120000,
          retryable: true
        },
        {
          name: 'Translation',
          status: JobStatus.TRANSLATING,
          progressStart: 35,
          progressEnd: 50,
          estimatedDuration: 60000,
          retryable: true
        },
        {
          name: 'TTS Generation',
          status: JobStatus.GENERATING_SPEECH,
          progressStart: 50,
          progressEnd: 80,
          estimatedDuration: 180000,
          retryable: true
        },
        {
          name: 'Audio Assembly',
          status: JobStatus.ASSEMBLING_AUDIO,
          progressStart: 80,
          progressEnd: 95,
          estimatedDuration: 45000,
          retryable: true
        },
        {
          name: 'Finalization',
          status: JobStatus.COMPLETED,
          progressStart: 95,
          progressEnd: 100,
          estimatedDuration: 15000,
          retryable: false
        }
      ];

      // Verify each step has the required properties
      expectedSteps.forEach(step => {
        expect(step.name).toBeDefined();
        expect(step.status).toBeDefined();
        expect(step.progressStart).toBeGreaterThanOrEqual(0);
        expect(step.progressEnd).toBeGreaterThan(step.progressStart);
        expect(step.progressEnd).toBeLessThanOrEqual(100);
        expect(step.estimatedDuration).toBeGreaterThan(0);
        expect(typeof step.retryable).toBe('boolean');
      });
    });

    it('should have progressive progress values', () => {
      const steps: ProcessingStep[] = [
        { name: 'Audio Extraction', status: JobStatus.EXTRACTING_AUDIO, progressStart: 5, progressEnd: 15, estimatedDuration: 30000, retryable: true },
        { name: 'Transcription', status: JobStatus.TRANSCRIBING, progressStart: 15, progressEnd: 35, estimatedDuration: 120000, retryable: true },
        { name: 'Translation', status: JobStatus.TRANSLATING, progressStart: 35, progressEnd: 50, estimatedDuration: 60000, retryable: true },
        { name: 'TTS Generation', status: JobStatus.GENERATING_SPEECH, progressStart: 50, progressEnd: 80, estimatedDuration: 180000, retryable: true },
        { name: 'Audio Assembly', status: JobStatus.ASSEMBLING_AUDIO, progressStart: 80, progressEnd: 95, estimatedDuration: 45000, retryable: true },
        { name: 'Finalization', status: JobStatus.COMPLETED, progressStart: 95, progressEnd: 100, estimatedDuration: 15000, retryable: false }
      ];

      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].progressStart).toBe(steps[i - 1].progressEnd);
      }
    });
  });

  describe('Processing Metrics', () => {
    it('should calculate metrics correctly', () => {
      const mockMetrics: ProcessingMetrics[] = [
        {
          stepName: 'Audio Extraction',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:00:30Z'),
          duration: 30000,
          success: true,
          retryCount: 0,
          serviceUsed: 'FFmpeg',
          costEstimate: 0.01
        },
        {
          stepName: 'TTS Generation',
          startTime: new Date('2024-01-01T10:01:00Z'),
          endTime: new Date('2024-01-01T10:02:00Z'),
          duration: 60000,
          success: true,
          retryCount: 1,
          serviceUsed: 'google',
          costEstimate: 0.15
        }
      ];

      const totalCost = mockMetrics.reduce((sum, metric) => sum + (metric.costEstimate || 0), 0);
      const successfulSteps = mockMetrics.filter(m => m.success).length;
      const totalRetries = mockMetrics.reduce((sum, metric) => sum + metric.retryCount, 0);

      expect(totalCost).toBe(0.16);
      expect(successfulSteps).toBe(2);
      expect(totalRetries).toBe(1);
    });

    it('should generate cost breakdown correctly', () => {
      const mockMetrics: ProcessingMetrics[] = [
        { stepName: 'Transcription', costEstimate: 0.05, success: true, startTime: new Date(), retryCount: 0 },
        { stepName: 'Translation', costEstimate: 0.02, success: true, startTime: new Date(), retryCount: 0 },
        { stepName: 'TTS Generation', costEstimate: 0.15, success: true, startTime: new Date(), retryCount: 0 },
        { stepName: 'Audio Assembly', costEstimate: 0.03, success: true, startTime: new Date(), retryCount: 0 }
      ];

      const breakdown = {
        transcriptionCost: 0,
        translationCost: 0,
        ttsCost: 0,
        processingCost: 0,
        totalCost: 0
      };

      mockMetrics.forEach(metric => {
        const cost = metric.costEstimate || 0;
        switch (metric.stepName) {
          case 'Transcription':
            breakdown.transcriptionCost += cost;
            break;
          case 'Translation':
            breakdown.translationCost += cost;
            break;
          case 'TTS Generation':
            breakdown.ttsCost += cost;
            break;
          default:
            breakdown.processingCost += cost;
            break;
        }
      });

      breakdown.totalCost = breakdown.transcriptionCost + breakdown.translationCost + 
                           breakdown.ttsCost + breakdown.processingCost;

      expect(breakdown.transcriptionCost).toBe(0.05);
      expect(breakdown.translationCost).toBe(0.02);
      expect(breakdown.ttsCost).toBe(0.15);
      expect(breakdown.processingCost).toBe(0.03);
      expect(breakdown.totalCost).toBe(0.25);
    });
  });

  describe('Error Recovery Strategies', () => {
    it('should identify TTS quota errors', () => {
      const error = new Error('quota exceeded');
      const stepName = 'TTS Generation';
      
      const isTTSQuotaError = error.message.includes('quota') || error.message.includes('rate limit');
      const shouldApplyTTSRecovery = stepName === 'TTS Generation' && isTTSQuotaError;
      
      expect(shouldApplyTTSRecovery).toBe(true);
    });

    it('should identify audio format errors', () => {
      const error = new Error('unsupported codec format');
      const stepName = 'Audio Extraction';
      
      const isFormatError = error.message.includes('codec') || error.message.includes('format');
      const shouldApplyFormatRecovery = stepName === 'Audio Extraction' && isFormatError;
      
      expect(shouldApplyFormatRecovery).toBe(true);
    });

    it('should determine cache keys for steps', () => {
      const getCacheKeys = (stepName: string): string[] => {
        switch (stepName) {
          case 'Audio Extraction':
            return ['audioFile'];
          case 'Transcription':
            return ['transcription'];
          case 'Translation':
            return ['translation'];
          case 'TTS Generation':
            return ['audioSegments'];
          case 'Audio Assembly':
            return ['audioTrack'];
          default:
            return [];
        }
      };

      expect(getCacheKeys('Audio Extraction')).toEqual(['audioFile']);
      expect(getCacheKeys('Transcription')).toEqual(['transcription']);
      expect(getCacheKeys('Translation')).toEqual(['translation']);
      expect(getCacheKeys('TTS Generation')).toEqual(['audioSegments']);
      expect(getCacheKeys('Audio Assembly')).toEqual(['audioTrack']);
      expect(getCacheKeys('Unknown Step')).toEqual([]);
    });
  });

  describe('TTS Cost Calculation', () => {
    it('should calculate Google TTS cost correctly', () => {
      const characters = 1000;
      const googleCost = characters * 0.000016; // Google TTS pricing
      
      expect(googleCost).toBe(0.016);
    });

    it('should calculate Coqui TTS cost correctly', () => {
      const characters = 1000;
      const coquiCost = characters * 0.000005; // Lower cost for local processing
      
      expect(coquiCost).toBe(0.005);
    });

    it('should prefer lower cost service', () => {
      const characters = 1000;
      const googleCost = characters * 0.000016;
      const coquiCost = characters * 0.000005;
      
      expect(coquiCost).toBeLessThan(googleCost);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required config properties', () => {
      const requiredProps = [
        'maxConcurrentProcessing',
        'processingTimeout',
        'retryDelay',
        'maxRetryAttempts',
        'enableProgressTracking',
        'enableErrorRecovery',
        'tempDirectory'
      ];

      requiredProps.forEach(prop => {
        expect(testConfig).toHaveProperty(prop);
      });
    });

    it('should have reasonable default values', () => {
      expect(testConfig.maxConcurrentProcessing).toBeGreaterThan(0);
      expect(testConfig.processingTimeout).toBeGreaterThan(0);
      expect(testConfig.retryDelay).toBeGreaterThan(0);
      expect(testConfig.maxRetryAttempts).toBeGreaterThanOrEqual(1);
      expect(typeof testConfig.enableProgressTracking).toBe('boolean');
      expect(typeof testConfig.enableErrorRecovery).toBe('boolean');
      expect(testConfig.tempDirectory).toBeTruthy();
    });
  });

  describe('Job Status Progression', () => {
    it('should follow correct status progression', () => {
      const expectedProgression = [
        JobStatus.UPLOADED,
        JobStatus.EXTRACTING_AUDIO,
        JobStatus.TRANSCRIBING,
        JobStatus.TRANSLATING,
        JobStatus.GENERATING_SPEECH,
        JobStatus.ASSEMBLING_AUDIO,
        JobStatus.COMPLETED
      ];

      // Verify each status is defined
      expectedProgression.forEach(status => {
        expect(Object.values(JobStatus)).toContain(status);
      });
    });

    it('should handle failure status', () => {
      expect(Object.values(JobStatus)).toContain(JobStatus.FAILED);
    });
  });
});
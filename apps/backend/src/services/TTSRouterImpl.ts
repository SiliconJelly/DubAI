import { TTSRouter, TTSRequest, TTSRouterConfig } from './TTSRouter';
import { GoogleTTSService } from './GoogleTTSService';
import { CoquiTTSService } from './CoquiTTSService';
import { AudioSegment, VoiceConfig, LocalVoiceConfig, AudioSegmentImpl } from '../models';
import { UsageMetrics } from '../types/common';
import { TTSServiceType } from '../types/common';
import { v4 as uuidv4 } from 'uuid';

export class TTSRouterImpl implements TTSRouter {
  private googleTTSService: GoogleTTSService;
  private coquiTTSService: CoquiTTSService;
  private config: TTSRouterConfig;
  private usageTracker: Map<TTSServiceType, UsageMetrics>;
  private abTestingController: ABTestingController;

  constructor(
    googleTTSService: GoogleTTSService,
    coquiTTSService: CoquiTTSService,
    config: TTSRouterConfig
  ) {
    this.googleTTSService = googleTTSService;
    this.coquiTTSService = coquiTTSService;
    this.config = config;
    this.usageTracker = new Map();
    this.abTestingController = new ABTestingController(config);
    
    // Initialize usage tracking
    this.initializeUsageTracking();
  }

  async selectTTSService(request: TTSRequest): Promise<TTSServiceType> {
    try {
      // Check if Google TTS quota is exceeded
      const quotaStatus = await this.googleTTSService.checkQuotaUsage();
      const isGoogleQuotaExceeded = quotaStatus.remaining < this.config.quotaThresholds.googleTTS;

      // If quota exceeded and fallback enabled, use Coqui TTS
      if (isGoogleQuotaExceeded && this.config.fallbackEnabled) {
        console.log('Google TTS quota exceeded, falling back to Coqui TTS');
        return TTSServiceType.COQUI_LOCAL;
      }

      // If A/B testing is disabled, use default service
      if (!this.config.abTestingEnabled) {
        return isGoogleQuotaExceeded ? TTSServiceType.COQUI_LOCAL : TTSServiceType.GOOGLE_CLOUD;
      }

      // Use A/B testing controller to select service
      return this.abTestingController.selectService(request.sessionId, isGoogleQuotaExceeded);
    } catch (error) {
      console.error('Error selecting TTS service:', error);
      // Fallback to Coqui TTS on error
      return TTSServiceType.COQUI_LOCAL;
    }
  }

  async generateSpeech(text: string, service: TTSServiceType): Promise<AudioSegment> {
    const startTime = Date.now();
    let audioBuffer: Buffer;
    let voiceConfig: VoiceConfig;

    try {
      switch (service) {
        case TTSServiceType.GOOGLE_CLOUD:
          voiceConfig = this.createGoogleVoiceConfig();
          audioBuffer = await this.googleTTSService.synthesizeSpeech(text, voiceConfig);
          break;
        
        case TTSServiceType.COQUI_LOCAL:
          const localVoiceConfig = this.createCoquiVoiceConfig();
          audioBuffer = await this.coquiTTSService.synthesizeSpeech(text, localVoiceConfig);
          voiceConfig = localVoiceConfig;
          break;
        
        default:
          throw new Error(`Unsupported TTS service: ${service}`);
      }

      const processingTime = Date.now() - startTime;
      
      // Track usage
      await this.trackUsage(service, {
        charactersProcessed: text.length,
        processingTimeMs: processingTime,
        apiCalls: 1,
        errorCount: 0
      });

      // Create audio segment
      const audioSegment = new AudioSegmentImpl(
        uuidv4(),
        text,
        audioBuffer,
        0, // startTime will be set by caller
        0, // endTime will be set by caller
        voiceConfig
      );

      return audioSegment;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Track error
      await this.trackUsage(service, {
        charactersProcessed: text.length,
        processingTimeMs: processingTime,
        apiCalls: 1,
        errorCount: 1
      });

      throw new Error(`TTS generation failed for service ${service}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async trackUsage(service: TTSServiceType, usage: UsageMetrics): Promise<void> {
    const currentUsage = this.usageTracker.get(service) || {
      charactersProcessed: 0,
      processingTimeMs: 0,
      apiCalls: 0,
      errorCount: 0
    };

    const updatedUsage: UsageMetrics = {
      charactersProcessed: currentUsage.charactersProcessed + usage.charactersProcessed,
      processingTimeMs: currentUsage.processingTimeMs + usage.processingTimeMs,
      apiCalls: currentUsage.apiCalls + usage.apiCalls,
      errorCount: currentUsage.errorCount + usage.errorCount
    };

    this.usageTracker.set(service, updatedUsage);
  }

  // Public methods for monitoring and configuration
  getUsageMetrics(service: TTSServiceType): UsageMetrics | undefined {
    return this.usageTracker.get(service);
  }

  getAllUsageMetrics(): Map<TTSServiceType, UsageMetrics> {
    return new Map(this.usageTracker);
  }

  updateConfig(newConfig: Partial<TTSRouterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.abTestingController.updateConfig(this.config);
  }

  getABTestingResults(): ABTestingResults {
    return this.abTestingController.getResults();
  }

  private initializeUsageTracking(): void {
    this.usageTracker.set(TTSServiceType.GOOGLE_CLOUD, {
      charactersProcessed: 0,
      processingTimeMs: 0,
      apiCalls: 0,
      errorCount: 0
    });

    this.usageTracker.set(TTSServiceType.COQUI_LOCAL, {
      charactersProcessed: 0,
      processingTimeMs: 0,
      apiCalls: 0,
      errorCount: 0
    });
  }

  private createGoogleVoiceConfig(): VoiceConfig {
    return {
      languageCode: 'bn-IN', // Bangla (India)
      voiceName: 'bn-IN-Wavenet-A',
      gender: 'FEMALE',
      speakingRate: 1.0,
      pitch: 0.0,
      volumeGainDb: 0.0
    };
  }

  private createCoquiVoiceConfig(): LocalVoiceConfig {
    return {
      languageCode: 'bn',
      voiceName: 'coqui-bangla-female',
      gender: 'FEMALE',
      speakingRate: 1.0,
      pitch: 0.0,
      volumeGainDb: 0.0,
      modelPath: './models/coqui-bangla',
      customSettings: {
        temperature: 0.7,
        length_penalty: 1.0
      }
    };
  }
}

// A/B Testing Controller
export class ABTestingController {
  private config: TTSRouterConfig;
  private sessionAssignments: Map<string, TTSServiceType>;
  private results: ABTestingResults;

  constructor(config: TTSRouterConfig) {
    this.config = config;
    this.sessionAssignments = new Map();
    this.results = {
      totalRequests: 0,
      googleTTSRequests: 0,
      coquiTTSRequests: 0,
      googleTTSSuccessRate: 0,
      coquiTTSSuccessRate: 0,
      averageProcessingTime: {
        googleTTS: 0,
        coquiTTS: 0
      }
    };
  }

  selectService(sessionId: string, isGoogleQuotaExceeded: boolean): TTSServiceType {
    // If Google quota is exceeded, force Coqui TTS
    if (isGoogleQuotaExceeded) {
      this.sessionAssignments.set(sessionId, TTSServiceType.COQUI_LOCAL);
      return TTSServiceType.COQUI_LOCAL;
    }

    // Check if session already has an assignment
    const existingAssignment = this.sessionAssignments.get(sessionId);
    if (existingAssignment) {
      return existingAssignment;
    }

    // Use weighted random selection
    const random = Math.random() * 100;
    const service = random < this.config.googleTTSWeight 
      ? TTSServiceType.GOOGLE_CLOUD 
      : TTSServiceType.COQUI_LOCAL;

    this.sessionAssignments.set(sessionId, service);
    this.updateResults(service);
    
    return service;
  }

  updateConfig(config: TTSRouterConfig): void {
    this.config = config;
  }

  getResults(): ABTestingResults {
    return { ...this.results };
  }

  recordSuccess(service: TTSServiceType, processingTime: number): void {
    if (service === TTSServiceType.GOOGLE_CLOUD) {
      this.results.googleTTSSuccessRate = this.calculateSuccessRate(service);
      this.results.averageProcessingTime.googleTTS = this.updateAverageProcessingTime(
        this.results.averageProcessingTime.googleTTS,
        processingTime,
        this.results.googleTTSRequests
      );
    } else {
      this.results.coquiTTSSuccessRate = this.calculateSuccessRate(service);
      this.results.averageProcessingTime.coquiTTS = this.updateAverageProcessingTime(
        this.results.averageProcessingTime.coquiTTS,
        processingTime,
        this.results.coquiTTSRequests
      );
    }
  }

  private updateResults(service: TTSServiceType): void {
    this.results.totalRequests++;
    if (service === TTSServiceType.GOOGLE_CLOUD) {
      this.results.googleTTSRequests++;
    } else {
      this.results.coquiTTSRequests++;
    }
  }

  private calculateSuccessRate(service: TTSServiceType): number {
    // This would be calculated based on actual success/failure tracking
    // For now, return a placeholder
    return 0.95; // 95% success rate
  }

  private updateAverageProcessingTime(currentAvg: number, newTime: number, requestCount: number): number {
    return (currentAvg * (requestCount - 1) + newTime) / requestCount;
  }
}

export interface ABTestingResults {
  totalRequests: number;
  googleTTSRequests: number;
  coquiTTSRequests: number;
  googleTTSSuccessRate: number;
  coquiTTSSuccessRate: number;
  averageProcessingTime: {
    googleTTS: number;
    coquiTTS: number;
  };
}
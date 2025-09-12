import { TTSRouter, TTSRequest, TTSRouterConfig } from './TTSRouter';
import { GoogleTTSService } from './GoogleTTSService';
import { AudioSegment, VoiceConfig, AudioSegmentImpl } from '../models';
import { UsageMetrics } from '../types/common';
import { TTSServiceType } from '../types/common';
import { v4 as uuidv4 } from 'uuid';

export class GoogleCloudTTSRouter implements TTSRouter {
  private googleTTSService: GoogleTTSService;
  private config: TTSRouterConfig;
  private usageTracker: UsageMetrics;

  constructor(
    googleTTSService: GoogleTTSService,
    config: TTSRouterConfig
  ) {
    this.googleTTSService = googleTTSService;
    this.config = config;
    this.usageTracker = {
      charactersProcessed: 0,
      processingTimeMs: 0,
      apiCalls: 0,
      errorCount: 0
    };
  }

  async selectTTSService(request: TTSRequest): Promise<TTSServiceType> {
    try {
      // Check if Google TTS quota is exceeded
      const quotaStatus = await this.googleTTSService.checkQuotaUsage();
      const isGoogleQuotaExceeded = quotaStatus.remaining < this.config.quotaThresholds.googleTTS;

      if (isGoogleQuotaExceeded) {
        throw new Error('Google Cloud TTS quota exceeded and no fallback service configured');
      }

      return TTSServiceType.GOOGLE_CLOUD;
    } catch (error) {
      console.error('Error selecting TTS service:', error);
      throw error;
    }
  }

  async generateSpeech(text: string, service: TTSServiceType): Promise<AudioSegment> {
    if (service !== TTSServiceType.GOOGLE_CLOUD) {
      throw new Error(`Unsupported TTS service: ${service}. Only Google Cloud TTS is supported in this implementation.`);
    }

    const startTime = Date.now();
    let audioBuffer: Buffer;
    let voiceConfig: VoiceConfig;

    try {
      voiceConfig = this.createGoogleVoiceConfig();
      audioBuffer = await this.googleTTSService.synthesizeSpeech(text, voiceConfig);

      const processingTime = Date.now() - startTime;
      
      // Track usage
      await this.trackUsage({
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
      await this.trackUsage({
        charactersProcessed: text.length,
        processingTimeMs: processingTime,
        apiCalls: 1,
        errorCount: 1
      });

      throw new Error(`Google Cloud TTS generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async trackUsage(usage: UsageMetrics): Promise<void> {
    this.usageTracker = {
      charactersProcessed: this.usageTracker.charactersProcessed + usage.charactersProcessed,
      processingTimeMs: this.usageTracker.processingTimeMs + usage.processingTimeMs,
      apiCalls: this.usageTracker.apiCalls + usage.apiCalls,
      errorCount: this.usageTracker.errorCount + usage.errorCount
    };
  }

  // Public methods for monitoring and configuration
  getUsageMetrics(): UsageMetrics {
    return { ...this.usageTracker };
  }

  updateConfig(newConfig: Partial<TTSRouterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get available Bangla voice configurations for Google Cloud TTS
  getBanglaVoiceConfigs(): VoiceConfig[] {
    return this.googleTTSService.getBanglaVoiceConfigs();
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
}
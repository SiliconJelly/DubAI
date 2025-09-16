import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { VoiceConfig } from '../models';
import { QuotaStatus, UsageMetrics } from '../types/common';
import { GoogleTTSService, Voice, GoogleTTSConfig } from './GoogleTTSService';
import { DefaultErrorHandler } from '../utils/errorHandler';
import { TTSError, QuotaExceededError } from '../types/errors';

export class GoogleTTSServiceImpl implements GoogleTTSService {
  private client: TextToSpeechClient;
  private config: GoogleTTSConfig;
  private quotaUsage: number = 0;
  private lastResetDate: Date = new Date();
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private errorHandler: DefaultErrorHandler;

  constructor(config: GoogleTTSConfig) {
    this.config = config;
    this.client = new TextToSpeechClient({
      projectId: config.projectId,
      keyFilename: config.keyFilename,
    });
    this.errorHandler = new DefaultErrorHandler();
  }

  async synthesizeSpeech(text: string, voiceConfig: VoiceConfig): Promise<Buffer> {
    try {
      // Apply rate limiting
      await this.applyRateLimit();
      
      // Check quota before processing
      const quotaStatus = await this.checkQuotaUsage();
      if (quotaStatus.remaining < text.length) {
        throw new QuotaExceededError('google_cloud_tts', quotaStatus.limit);
      }

      const request = {
        input: { text },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.voiceName,
          ssmlGender: voiceConfig.gender as any,
        },
        audioConfig: {
          audioEncoding: 'MP3' as any,
          speakingRate: voiceConfig.speakingRate,
          pitch: voiceConfig.pitch,
          volumeGainDb: voiceConfig.volumeGainDb,
          effectsProfileId: ['telephony-class-application'],
        },
      };

      const [response] = await this.retryWithExponentialBackoff(
        () => this.client.synthesizeSpeech(request),
        this.config.retryAttempts
      );

      if (!response.audioContent) {
        throw new TTSError('No audio content received from Google TTS', 'google_cloud_tts');
      }

      // Update quota usage
      this.quotaUsage += text.length;
      
      return Buffer.from(response.audioContent as Uint8Array);
    } catch (error) {
      if (error instanceof TTSError || error instanceof QuotaExceededError) {
        await this.errorHandler.handleTTSError(error);
        throw error;
      }
      const ttsError = new TTSError((error as Error).message, 'google_cloud_tts', error as Error);
      await this.errorHandler.handleTTSError(ttsError);
      throw ttsError;
    }
  }

  async checkQuotaUsage(): Promise<QuotaStatus> {
    // Reset quota if it's a new month
    const now = new Date();
    if (now.getMonth() !== this.lastResetDate.getMonth() || 
        now.getFullYear() !== this.lastResetDate.getFullYear()) {
      this.quotaUsage = 0;
      this.lastResetDate = now;
    }

    const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    return {
      used: this.quotaUsage,
      limit: this.config.quotaLimit,
      remaining: Math.max(0, this.config.quotaLimit - this.quotaUsage),
      resetDate: nextResetDate,
    };
  }

  async listAvailableVoices(languageCode: string): Promise<Voice[]> {
    try {
      const [response] = await this.retryWithExponentialBackoff(
        () => this.client.listVoices({ languageCode }),
        this.config.retryAttempts
      );

      if (!response.voices) {
        return [];
      }

      return response.voices
        .filter(voice => voice.languageCodes?.includes(languageCode))
        .map(voice => ({
          name: voice.name || '',
          languageCode: languageCode,
          gender: (voice.ssmlGender as 'MALE' | 'FEMALE' | 'NEUTRAL') || 'NEUTRAL',
          naturalSampleRateHertz: voice.naturalSampleRateHertz || 22050,
        }));
    } catch (error) {
      const ttsError = new TTSError((error as Error).message, 'google_cloud_tts', error as Error);
      await this.errorHandler.handleTTSError(ttsError);
      throw ttsError;
    }
  }

  // Get Bangla voice configurations optimized for dubbing
  getBanglaVoiceConfigs(): VoiceConfig[] {
    return [
      {
        languageCode: 'bn-IN',
        voiceName: 'bn-IN-Wavenet-A',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      },
      {
        languageCode: 'bn-IN',
        voiceName: 'bn-IN-Wavenet-B',
        gender: 'MALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      },
      {
        languageCode: 'bn-IN',
        voiceName: 'bn-IN-Standard-A',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      },
      {
        languageCode: 'bn-IN',
        voiceName: 'bn-IN-Standard-B',
        gender: 'MALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      },
    ];
  }

  // Get usage metrics for cost tracking
  getUsageMetrics(): UsageMetrics {
    return {
      charactersProcessed: this.quotaUsage,
      processingTimeMs: 0, // This would be tracked separately
      apiCalls: this.requestCount,
      errorCount: 0, // This would be tracked by error handler
    };
  }

  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / this.config.rateLimitPerMinute; // ms between requests

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error as Error)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff: 2^attempt * 1000ms
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('invalid argument') ||
      message.includes('permission denied') ||
      message.includes('not found') ||
      message.includes('quota exceeded')
    );
  }
}
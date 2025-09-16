import { VoiceConfig } from '../models';
import { QuotaStatus } from '../types/common';

export interface Voice {
  name: string;
  languageCode: string;
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  naturalSampleRateHertz: number;
}

export interface GoogleTTSService {
  synthesizeSpeech(text: string, voiceConfig: VoiceConfig): Promise<Buffer>;
  checkQuotaUsage(): Promise<QuotaStatus>;
  listAvailableVoices(languageCode: string): Promise<Voice[]>;
}

export interface GoogleTTSConfig {
  projectId: string;
  keyFilename: string;
  quotaLimit: number;
  rateLimitPerMinute: number;
  retryAttempts: number;
}
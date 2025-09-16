import { AudioSegment } from '../models';
import { UsageMetrics } from '../types/common';
import { TTSServiceType } from '../types/common';

export interface TTSRequest {
  text: string;
  targetLanguage: string;
  voicePreferences?: any;
  sessionId: string;
}

export interface TTSRouter {
  selectTTSService(request: TTSRequest): Promise<TTSServiceType>;
  generateSpeech(text: string, service: TTSServiceType): Promise<AudioSegment>;
  trackUsage(service: TTSServiceType, usage: UsageMetrics): Promise<void>;
}

export interface TTSRouterConfig {
  abTestingEnabled: boolean;
  googleTTSWeight: number;
  coquiTTSWeight: number;
  quotaThresholds: {
    googleTTS: number;
  };
  fallbackEnabled: boolean;
}
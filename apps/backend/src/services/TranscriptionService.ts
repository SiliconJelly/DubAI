import { AudioFile, TranscriptionResult, TranslationResult, SRTFile } from '../models';

export interface TranscriptionService {
  transcribeAudio(audioFile: AudioFile): Promise<TranscriptionResult>;
  translateToTarget(transcription: TranscriptionResult, targetLang: string): Promise<TranslationResult>;
  translateWithTimestampPreservation(originalAudio: AudioFile, transcription: TranscriptionResult, targetLang: string): Promise<TranslationResult>;
  generateSRT(translation: TranslationResult): Promise<SRTFile>;
}

export interface TranscriptionConfig {
  whisperModelPath: string;
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3';
  language: string;
  temperature: number;
  maxRetries: number;
}
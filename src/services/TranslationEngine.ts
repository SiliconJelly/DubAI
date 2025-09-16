import { SRTFile, TranscriptionResult, TranslationResult } from '../models';
import { MovieAnalysis } from '../models/MovieAnalysis';

export interface TranslationEngineResult {
  id: string;
  originalSRT: SRTFile;
  translatedSRT: SRTFile;
  movieAnalysis: MovieAnalysis;
  processingMetrics: TranslationProcessingMetrics;
  createdAt: Date;
}

export interface TranslationProcessingMetrics {
  transcriptionTime: number;
  translationTime: number;
  analysisTime: number;
  totalProcessingTime: number;
  whisperModelUsed: string;
  segmentsProcessed: number;
  charactersProcessed: number;
  confidence: number;
}

export interface TranslationEngineConfig {
  whisperConfig: {
    modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3';
    temperature: number;
    maxRetries: number;
  };
  analysisConfig: {
    enableCharacterAnalysis: boolean;
    enableSentimentAnalysis: boolean;
    enableThemeExtraction: boolean;
    enableGenreClassification: boolean;
    enableSceneAnalysis: boolean;
    enableCulturalContext: boolean;
  };
  cacheConfig: {
    enableCaching: boolean;
    cacheDirectory: string;
    cacheTTL: number; // Time to live in seconds
  };
  progressCallback?: (progress: TranslationProgress) => void;
}

export interface TranslationProgress {
  stage: 'INITIALIZING' | 'TRANSCRIBING' | 'TRANSLATING' | 'ANALYZING' | 'GENERATING_SRT' | 'COMPLETED' | 'FAILED';
  progress: number; // 0-100
  message: string;
  currentSegment?: number;
  totalSegments?: number;
  estimatedTimeRemaining?: number;
}

export interface TranslationEngine {
  translateSRTWithAnalysis(
    englishSRT: SRTFile, 
    targetLanguage: string,
    movieMetadata?: MovieMetadata
  ): Promise<TranslationEngineResult>;
  
  getTranslationProgress(jobId: string): Promise<TranslationProgress | null>;
  getCachedResult(srtHash: string): Promise<TranslationEngineResult | null>;
  clearCache(): Promise<void>;
}

export interface MovieMetadata {
  title?: string;
  year?: number;
  genre?: string[];
  director?: string;
  cast?: string[];
  plot?: string;
}

export const DEFAULT_TRANSLATION_ENGINE_CONFIG: TranslationEngineConfig = {
  whisperConfig: {
    modelSize: 'large-v3',
    temperature: 0.0,
    maxRetries: 3
  },
  analysisConfig: {
    enableCharacterAnalysis: true,
    enableSentimentAnalysis: true,
    enableThemeExtraction: true,
    enableGenreClassification: true,
    enableSceneAnalysis: true,
    enableCulturalContext: true
  },
  cacheConfig: {
    enableCaching: true,
    cacheDirectory: './cache/translations',
    cacheTTL: 86400 // 24 hours
  }
};
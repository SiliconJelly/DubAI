import { TranscriptionResult, TranslationResult } from '../models';
import { MovieAnalysis, CharacterProfile, VoiceProfile, SentimentScore, SceneBreakdown, CulturalNote } from '../models/MovieAnalysis';

export interface MovieAnalysisService {
  analyzeFromTranscription(transcription: TranscriptionResult): Promise<MovieAnalysis>;
  analyzeFromTranslation(translation: TranslationResult): Promise<MovieAnalysis>;
  generateCharacterProfiles(dialogues: string[], speakers?: string[]): Promise<CharacterProfile[]>;
  analyzeSentiment(text: string): Promise<SentimentScore>;
  extractThemes(text: string): Promise<string[]>;
  classifyGenre(text: string, themes: string[]): Promise<string[]>;
  identifyKeyScenes(transcription: TranscriptionResult): Promise<SceneBreakdown[]>;
  generateCulturalContext(text: string, targetLanguage: string): Promise<CulturalNote[]>;
}

export interface MovieAnalysisConfig {
  enableCharacterAnalysis: boolean;
  enableSentimentAnalysis: boolean;
  enableThemeExtraction: boolean;
  enableGenreClassification: boolean;
  enableSceneAnalysis: boolean;
  enableCulturalContext: boolean;
  confidenceThreshold: number;
  maxCharacters: number;
  maxThemes: number;
  maxScenes: number;
}

export const DEFAULT_MOVIE_ANALYSIS_CONFIG: MovieAnalysisConfig = {
  enableCharacterAnalysis: true,
  enableSentimentAnalysis: true,
  enableThemeExtraction: true,
  enableGenreClassification: true,
  enableSceneAnalysis: true,
  enableCulturalContext: true,
  confidenceThreshold: 0.6,
  maxCharacters: 10,
  maxThemes: 5,
  maxScenes: 20
};
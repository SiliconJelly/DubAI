import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SRTFile, TranscriptionResult, TranslationResult } from '../models';
import { MovieAnalysis } from '../models/MovieAnalysis';
import { 
  TranslationEngine, 
  TranslationEngineResult, 
  TranslationEngineConfig, 
  TranslationProgress, 
  TranslationProcessingMetrics,
  MovieMetadata,
  DEFAULT_TRANSLATION_ENGINE_CONFIG 
} from './TranslationEngine';
import { TranscriptionService } from './TranscriptionService';
import { MovieAnalysisService } from './MovieAnalysisService';
import { FileManager } from '../utils/fileManager';

export class TranslationEngineImpl implements TranslationEngine {
  private config: TranslationEngineConfig;
  private transcriptionService: TranscriptionService;
  private movieAnalysisService: MovieAnalysisService;
  private fileManager: FileManager;
  private progressMap: Map<string, TranslationProgress> = new Map();
  private cacheMap: Map<string, TranslationEngineResult> = new Map();

  constructor(
    transcriptionService: TranscriptionService,
    movieAnalysisService: MovieAnalysisService,
    fileManager: FileManager,
    config: TranslationEngineConfig = DEFAULT_TRANSLATION_ENGINE_CONFIG
  ) {
    this.transcriptionService = transcriptionService;
    this.movieAnalysisService = movieAnalysisService;
    this.fileManager = fileManager;
    this.config = config;
    
    this.initializeCache();
  }

  async translateSRTWithAnalysis(
    englishSRT: SRTFile,
    targetLanguage: string,
    movieMetadata?: MovieMetadata
  ): Promise<TranslationEngineResult> {
    const jobId = uuidv4();
    const startTime = Date.now();
    
    try {
      // Check cache first
      const srtHash = this.generateSRTHash(englishSRT);
      if (this.config.cacheConfig.enableCaching) {
        const cachedResult = await this.getCachedResult(srtHash);
        if (cachedResult) {
          this.updateProgress(jobId, {
            stage: 'COMPLETED',
            progress: 100,
            message: 'Retrieved from cache'
          });
          return cachedResult;
        }
      }

      // Initialize progress tracking
      this.updateProgress(jobId, {
        stage: 'INITIALIZING',
        progress: 0,
        message: 'Starting translation process...'
      });

      // Step 1: Convert SRT to audio for Whisper processing (simulated)
      this.updateProgress(jobId, {
        stage: 'TRANSCRIBING',
        progress: 10,
        message: 'Preparing audio for transcription...'
      });

      // Create a mock audio file from SRT for Whisper processing
      const mockAudioFile = await this.createMockAudioFromSRT(englishSRT);
      
      // Step 2: Transcribe original audio to get baseline
      this.updateProgress(jobId, {
        stage: 'TRANSCRIBING',
        progress: 20,
        message: 'Transcribing original audio...',
        totalSegments: englishSRT.segments.length
      });

      const transcriptionResult = await this.transcriptionService.transcribeAudio(mockAudioFile);
      
      // Step 3: Translate to target language
      this.updateProgress(jobId, {
        stage: 'TRANSLATING',
        progress: 40,
        message: `Translating to ${targetLanguage}...`,
        currentSegment: 0,
        totalSegments: transcriptionResult.segments.length
      });

      const translationResult = await this.transcriptionService.translateWithTimestampPreservation(
        mockAudioFile,
        transcriptionResult,
        targetLanguage
      );

      // Step 4: Perform movie analysis
      this.updateProgress(jobId, {
        stage: 'ANALYZING',
        progress: 70,
        message: 'Analyzing movie content and characters...'
      });

      const movieAnalysis = await this.movieAnalysisService.analyzeFromTranslation(translationResult);
      
      // Enhance analysis with movie metadata if provided
      if (movieMetadata) {
        this.enhanceAnalysisWithMetadata(movieAnalysis, movieMetadata);
      }

      // Step 5: Generate final SRT file
      this.updateProgress(jobId, {
        stage: 'GENERATING_SRT',
        progress: 90,
        message: 'Generating final SRT file...'
      });

      const translatedSRT = await this.transcriptionService.generateSRT(translationResult);

      // Calculate processing metrics
      const processingMetrics: TranslationProcessingMetrics = {
        transcriptionTime: 0, // Would be measured in real implementation
        translationTime: 0,   // Would be measured in real implementation
        analysisTime: movieAnalysis.processingTime,
        totalProcessingTime: Date.now() - startTime,
        whisperModelUsed: this.config.whisperConfig.modelSize,
        segmentsProcessed: translationResult.segments.length,
        charactersProcessed: translationResult.translatedText.length,
        confidence: movieAnalysis.confidence
      };

      const result: TranslationEngineResult = {
        id: jobId,
        originalSRT: englishSRT,
        translatedSRT,
        movieAnalysis,
        processingMetrics,
        createdAt: new Date()
      };

      // Cache the result
      if (this.config.cacheConfig.enableCaching) {
        await this.cacheResult(srtHash, result);
      }

      // Final progress update
      this.updateProgress(jobId, {
        stage: 'COMPLETED',
        progress: 100,
        message: 'Translation and analysis completed successfully!'
      });

      // Clean up temporary files
      await this.fileManager.deleteFile(mockAudioFile.path);

      return result;

    } catch (error) {
      this.updateProgress(jobId, {
        stage: 'FAILED',
        progress: 0,
        message: `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  async getTranslationProgress(jobId: string): Promise<TranslationProgress | null> {
    return this.progressMap.get(jobId) || null;
  }

  async getCachedResult(srtHash: string): Promise<TranslationEngineResult | null> {
    // Check in-memory cache first
    if (this.cacheMap.has(srtHash)) {
      return this.cacheMap.get(srtHash)!;
    }

    // Check file system cache
    if (this.config.cacheConfig.enableCaching) {
      try {
        const cacheFilePath = path.join(this.config.cacheConfig.cacheDirectory, `${srtHash}.json`);
        const cacheData = await fs.readFile(cacheFilePath, 'utf-8');
        const cachedResult = JSON.parse(cacheData) as TranslationEngineResult;
        
        // Check if cache is still valid
        const cacheAge = Date.now() - new Date(cachedResult.createdAt).getTime();
        if (cacheAge < this.config.cacheConfig.cacheTTL * 1000) {
          this.cacheMap.set(srtHash, cachedResult);
          return cachedResult;
        } else {
          // Cache expired, delete it
          await fs.unlink(cacheFilePath);
        }
      } catch (error) {
        // Cache file doesn't exist or is corrupted
        console.warn('Failed to read cache file:', error);
      }
    }

    return null;
  }

  async clearCache(): Promise<void> {
    this.cacheMap.clear();
    
    if (this.config.cacheConfig.enableCaching) {
      try {
        const cacheDir = this.config.cacheConfig.cacheDirectory;
        const files = await fs.readdir(cacheDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(cacheDir, file));
          }
        }
      } catch (error) {
        console.warn('Failed to clear cache directory:', error);
      }
    }
  }

  private async initializeCache(): Promise<void> {
    if (this.config.cacheConfig.enableCaching) {
      try {
        await fs.mkdir(this.config.cacheConfig.cacheDirectory, { recursive: true });
      } catch (error) {
        console.warn('Failed to create cache directory:', error);
      }
    }
  }

  private generateSRTHash(srt: SRTFile): string {
    const content = srt.content + JSON.stringify(this.config.whisperConfig);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async cacheResult(srtHash: string, result: TranslationEngineResult): Promise<void> {
    // Store in memory cache
    this.cacheMap.set(srtHash, result);

    // Store in file system cache
    if (this.config.cacheConfig.enableCaching) {
      try {
        const cacheFilePath = path.join(this.config.cacheConfig.cacheDirectory, `${srtHash}.json`);
        await fs.writeFile(cacheFilePath, JSON.stringify(result, null, 2));
      } catch (error) {
        console.warn('Failed to write cache file:', error);
      }
    }
  }

  private async createMockAudioFromSRT(srt: SRTFile): Promise<any> {
    // In a real implementation, this would either:
    // 1. Use the original video file to extract audio
    // 2. Use text-to-speech to generate audio from SRT text
    // 3. Use a pre-existing audio file associated with the SRT
    
    // For now, we'll create a mock audio file reference
    const mockAudioPath = await this.fileManager.createTempFile('wav');
    
    return {
      id: uuidv4(),
      filename: 'mock-audio.wav',
      path: mockAudioPath,
      format: 'wav',
      duration: srt.totalDuration,
      sampleRate: 44100,
      channels: 2
    };
  }

  private enhanceAnalysisWithMetadata(analysis: MovieAnalysis, metadata: MovieMetadata): void {
    // Enhance the analysis with provided movie metadata
    if (metadata.genre && metadata.genre.length > 0) {
      // Merge with detected genres, giving priority to metadata
      analysis.genreClassification = [...new Set([...metadata.genre, ...analysis.genreClassification])];
    }

    if (metadata.cast && metadata.cast.length > 0) {
      // Update character profiles with known cast information
      metadata.cast.forEach((actorName, index) => {
        if (index < analysis.characterAnalysis.length) {
          analysis.characterAnalysis[index].name = actorName;
          analysis.characterAnalysis[index].description = 
            `${actorName} - ${analysis.characterAnalysis[index].description}`;
        }
      });
    }

    if (metadata.plot) {
      // Enhance summary with plot information
      analysis.summary = `${metadata.plot} ${analysis.summary}`;
    }

    // Add metadata-based themes
    if (metadata.genre) {
      const genreThemes = this.extractThemesFromGenres(metadata.genre);
      analysis.themes = [...new Set([...genreThemes, ...analysis.themes])];
    }
  }

  private extractThemesFromGenres(genres: string[]): string[] {
    const genreThemeMap: { [key: string]: string[] } = {
      'Action': ['action', 'adventure', 'conflict'],
      'Romance': ['love', 'relationship', 'emotion'],
      'Comedy': ['humor', 'comedy', 'entertainment'],
      'Drama': ['drama', 'emotion', 'conflict'],
      'Thriller': ['suspense', 'mystery', 'tension'],
      'Horror': ['fear', 'suspense', 'supernatural'],
      'Sci-Fi': ['technology', 'future', 'science'],
      'Fantasy': ['magic', 'adventure', 'supernatural']
    };

    const themes: string[] = [];
    genres.forEach(genre => {
      const genreThemes = genreThemeMap[genre];
      if (genreThemes) {
        themes.push(...genreThemes);
      }
    });

    return [...new Set(themes)];
  }

  private updateProgress(jobId: string, progress: TranslationProgress): void {
    this.progressMap.set(jobId, progress);
    
    // Call progress callback if provided
    if (this.config.progressCallback) {
      this.config.progressCallback(progress);
    }

    // Clean up completed/failed jobs after some time
    if (progress.stage === 'COMPLETED' || progress.stage === 'FAILED') {
      setTimeout(() => {
        this.progressMap.delete(jobId);
      }, 300000); // 5 minutes
    }
  }
}
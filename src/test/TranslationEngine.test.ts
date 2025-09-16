import { TranslationEngineImpl } from '../services/TranslationEngineImpl';
import { TranslationEngineConfig, DEFAULT_TRANSLATION_ENGINE_CONFIG } from '../services/TranslationEngine';
import { TranscriptionService } from '../services/TranscriptionService';
import { MovieAnalysisService } from '../services/MovieAnalysisService';
import { FileManager } from '../utils/fileManager';
import { SRTFileImpl } from '../models/SRTFile';
import { TranscriptionResultImpl } from '../models/TranscriptionResult';
import { TranslationResultImpl } from '../models/TranslationResult';
import { MovieAnalysisImpl } from '../models/MovieAnalysis';

// Mock implementations
class MockTranscriptionService implements TranscriptionService {
  async transcribeAudio(audioFile: any): Promise<any> {
    return new TranscriptionResultImpl(
      'test-transcription-id',
      [
        { text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.9 },
        { text: 'How are you?', startTime: 2, endTime: 4, confidence: 0.8 }
      ],
      'en',
      0.85
    );
  }

  async translateToTarget(transcription: any, targetLang: string): Promise<any> {
    return new TranslationResultImpl(
      'test-translation-id',
      'Hello world How are you?',
      'হ্যালো ওয়ার্ল্ড আপনি কেমন আছেন?',
      [
        { originalText: 'Hello world', translatedText: 'হ্যালো ওয়ার্ল্ড', startTime: 0, endTime: 2, confidence: 0.9 },
        { originalText: 'How are you?', translatedText: 'আপনি কেমন আছেন?', startTime: 2, endTime: 4, confidence: 0.8 }
      ],
      targetLang
    );
  }

  async translateWithTimestampPreservation(originalAudio: any, transcription: any, targetLang: string): Promise<any> {
    return this.translateToTarget(transcription, targetLang);
  }

  async generateSRT(translation: any): Promise<any> {
    const segments = translation.segments.map((seg: any, index: number) => ({
      index: index + 1,
      startTime: this.formatTime(seg.startTime),
      endTime: this.formatTime(seg.endTime),
      text: seg.translatedText
    }));

    const content = segments
      .map((seg: any) => `${seg.index}\n${seg.startTime} --> ${seg.endTime}\n${seg.text}\n`)
      .join('\n');

    return new SRTFileImpl('test-srt-id', content, segments, 4);
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}

class MockMovieAnalysisService implements MovieAnalysisService {
  async analyzeFromTranscription(transcription: any): Promise<any> {
    return this.createMockAnalysis();
  }

  async analyzeFromTranslation(translation: any): Promise<any> {
    return this.createMockAnalysis();
  }

  async generateCharacterProfiles(dialogues: string[]): Promise<any[]> {
    return [
      {
        name: 'Speaker1',
        description: 'Main character',
        personality: ['friendly', 'curious'],
        voiceCharacteristics: {
          gender: 'NEUTRAL',
          ageRange: 'adult',
          accent: 'neutral',
          tone: ['neutral'],
          speakingRate: 150,
          pitch: 0
        },
        dialogueCount: 2,
        screenTime: 4,
        importance: 'MAIN'
      }
    ];
  }

  async analyzeSentiment(text: string): Promise<any> {
    return {
      overall: 0.2,
      segments: [
        { startTime: 0, endTime: 2, sentiment: 0.3, emotion: 'positive' },
        { startTime: 2, endTime: 4, sentiment: 0.1, emotion: 'neutral' }
      ]
    };
  }

  async extractThemes(text: string): Promise<string[]> {
    return ['friendship', 'conversation'];
  }

  async classifyGenre(text: string, themes: string[]): Promise<string[]> {
    return ['Drama', 'General'];
  }

  async identifyKeyScenes(transcription: any): Promise<any[]> {
    return [
      {
        startTime: 0,
        endTime: 4,
        description: 'Opening conversation',
        importance: 'MEDIUM',
        characters: ['Speaker1']
      }
    ];
  }

  async generateCulturalContext(text: string, targetLanguage: string): Promise<any[]> {
    return [
      {
        text: 'greeting',
        context: 'social customs',
        suggestion: 'Use appropriate Bangla greeting customs'
      }
    ];
  }

  private createMockAnalysis(): any {
    return new MovieAnalysisImpl(
      'test-analysis-id',
      'A friendly conversation between characters',
      ['friendship', 'conversation'],
      [
        {
          name: 'Speaker1',
          description: 'Main character',
          personality: ['friendly', 'curious'],
          voiceCharacteristics: {
            gender: 'NEUTRAL' as const,
            ageRange: 'adult',
            accent: 'neutral',
            tone: ['neutral'],
            speakingRate: 150,
            pitch: 0
          },
          dialogueCount: 2,
          screenTime: 4,
          importance: 'MAIN' as const
        }
      ],
      ['Drama', 'General'],
      {
        overall: 0.2,
        segments: [
          { startTime: 0, endTime: 2, sentiment: 0.3, emotion: 'positive' },
          { startTime: 2, endTime: 4, sentiment: 0.1, emotion: 'neutral' }
        ]
      },
      [
        {
          startTime: 0,
          endTime: 4,
          description: 'Opening conversation',
          importance: 'MEDIUM' as const,
          characters: ['Speaker1']
        }
      ],
      [
        {
          text: 'greeting',
          context: 'social customs',
          suggestion: 'Use appropriate Bangla greeting customs'
        }
      ],
      1000,
      0.85
    );
  }
}

class MockFileManager extends FileManager {
  constructor() {
    super({ tempDirectory: './temp', outputDirectory: './output', cleanupIntervalHours: 24 });
  }

  override async createTempFile(extension: string): Promise<string> {
    return `./temp/mock-file.${extension}`;
  }

  override async deleteFile(filePath: string): Promise<void> {
    // Mock deletion
  }
}

describe('TranslationEngineImpl', () => {
  let translationEngine: TranslationEngineImpl;
  let mockTranscriptionService: MockTranscriptionService;
  let mockMovieAnalysisService: MockMovieAnalysisService;
  let mockFileManager: MockFileManager;
  let config: TranslationEngineConfig;

  beforeEach(() => {
    mockTranscriptionService = new MockTranscriptionService();
    mockMovieAnalysisService = new MockMovieAnalysisService();
    mockFileManager = new MockFileManager();
    
    config = {
      ...DEFAULT_TRANSLATION_ENGINE_CONFIG,
      cacheConfig: {
        enableCaching: false, // Disable caching for tests
        cacheDirectory: './test-cache',
        cacheTTL: 3600
      }
    };

    translationEngine = new TranslationEngineImpl(
      mockTranscriptionService,
      mockMovieAnalysisService,
      mockFileManager,
      config
    );
  });

  describe('translateSRTWithAnalysis', () => {
    it('should successfully translate SRT file with movie analysis', async () => {
      const mockSRT = new SRTFileImpl(
        'test-srt-id',
        '1\n00:00:00,000 --> 00:00:02,000\nHello world\n\n2\n00:00:02,000 --> 00:00:04,000\nHow are you?\n',
        [
          { index: 1, startTime: '00:00:00,000', endTime: '00:00:02,000', text: 'Hello world' },
          { index: 2, startTime: '00:00:02,000', endTime: '00:00:04,000', text: 'How are you?' }
        ],
        4
      );

      const result = await translationEngine.translateSRTWithAnalysis(mockSRT, 'bn');

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.originalSRT).toBe(mockSRT);
      expect(result.translatedSRT).toBeDefined();
      expect(result.movieAnalysis).toBeDefined();
      expect(result.processingMetrics).toBeDefined();
      
      // Check translated SRT content
      expect(result.translatedSRT.content).toContain('হ্যালো ওয়ার্ল্ড');
      expect(result.translatedSRT.content).toContain('আপনি কেমন আছেন?');
      
      // Check movie analysis
      expect(result.movieAnalysis.summary).toContain('conversation');
      expect(result.movieAnalysis.themes).toContain('friendship');
      expect(result.movieAnalysis.characterAnalysis).toHaveLength(1);
      expect(result.movieAnalysis.genreClassification).toContain('Drama');
      
      // Check processing metrics
      expect(result.processingMetrics.segmentsProcessed).toBe(2);
      expect(result.processingMetrics.whisperModelUsed).toBe('large-v3');
      expect(result.processingMetrics.confidence).toBeGreaterThan(0);
    });

    it('should enhance analysis with movie metadata when provided', async () => {
      const mockSRT = new SRTFileImpl(
        'test-srt-id',
        '1\n00:00:00,000 --> 00:00:02,000\nHello world\n',
        [{ index: 1, startTime: '00:00:00,000', endTime: '00:00:02,000', text: 'Hello world' }],
        2
      );

      const movieMetadata = {
        title: 'Test Movie',
        year: 2023,
        genre: ['Action', 'Adventure'],
        cast: ['John Doe', 'Jane Smith'],
        plot: 'An exciting adventure story'
      };

      const result = await translationEngine.translateSRTWithAnalysis(mockSRT, 'bn', movieMetadata);

      expect(result.movieAnalysis.genreClassification).toContain('Action');
      expect(result.movieAnalysis.genreClassification).toContain('Adventure');
      expect(result.movieAnalysis.summary).toContain('An exciting adventure story');
      expect(result.movieAnalysis.characterAnalysis[0].name).toBe('John Doe');
    });

    it('should handle translation errors gracefully', async () => {
      const mockSRT = new SRTFileImpl('test-srt-id', 'invalid content', [], 0);
      
      // Mock transcription service to throw error
      jest.spyOn(mockTranscriptionService, 'transcribeAudio').mockRejectedValue(
        new Error('Transcription failed')
      );

      await expect(
        translationEngine.translateSRTWithAnalysis(mockSRT, 'bn')
      ).rejects.toThrow('Transcription failed');
    });

    it('should track progress during translation', async () => {
      const mockSRT = new SRTFileImpl(
        'test-srt-id',
        '1\n00:00:00,000 --> 00:00:02,000\nHello world\n',
        [{ index: 1, startTime: '00:00:00,000', endTime: '00:00:02,000', text: 'Hello world' }],
        2
      );

      const progressUpdates: any[] = [];
      const configWithCallback = {
        ...config,
        progressCallback: (progress: any) => progressUpdates.push(progress)
      };

      const engineWithCallback = new TranslationEngineImpl(
        mockTranscriptionService,
        mockMovieAnalysisService,
        mockFileManager,
        configWithCallback
      );

      await engineWithCallback.translateSRTWithAnalysis(mockSRT, 'bn');

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].stage).toBe('INITIALIZING');
      expect(progressUpdates[progressUpdates.length - 1].stage).toBe('COMPLETED');
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100);
    });
  });

  describe('getTranslationProgress', () => {
    it('should return null for non-existent job', async () => {
      const progress = await translationEngine.getTranslationProgress('non-existent-job');
      expect(progress).toBeNull();
    });
  });

  describe('caching', () => {
    it('should cache and retrieve translation results when caching is enabled', async () => {
      const cachingConfig = {
        ...config,
        cacheConfig: {
          enableCaching: true,
          cacheDirectory: './test-cache',
          cacheTTL: 3600
        }
      };

      const cachingEngine = new TranslationEngineImpl(
        mockTranscriptionService,
        mockMovieAnalysisService,
        mockFileManager,
        cachingConfig
      );

      const mockSRT = new SRTFileImpl(
        'test-srt-id',
        '1\n00:00:00,000 --> 00:00:02,000\nHello world\n',
        [{ index: 1, startTime: '00:00:00,000', endTime: '00:00:02,000', text: 'Hello world' }],
        2
      );

      // First translation should process normally
      const result1 = await cachingEngine.translateSRTWithAnalysis(mockSRT, 'bn');
      
      // Second translation with same SRT should be faster (from cache)
      const startTime = Date.now();
      const result2 = await cachingEngine.translateSRTWithAnalysis(mockSRT, 'bn');
      const endTime = Date.now();

      expect(result1.translatedSRT.content).toBe(result2.translatedSRT.content);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast from cache
    });

    it('should clear cache successfully', async () => {
      await expect(translationEngine.clearCache()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle transcription service errors', async () => {
      const mockSRT = new SRTFileImpl('test-srt-id', 'test content', [], 0);
      
      jest.spyOn(mockTranscriptionService, 'transcribeAudio').mockRejectedValue(
        new Error('Whisper model not found')
      );

      await expect(
        translationEngine.translateSRTWithAnalysis(mockSRT, 'bn')
      ).rejects.toThrow('Whisper model not found');
    });

    it('should handle movie analysis service errors', async () => {
      const mockSRT = new SRTFileImpl('test-srt-id', 'test content', [], 0);
      
      jest.spyOn(mockMovieAnalysisService, 'analyzeFromTranslation').mockRejectedValue(
        new Error('Analysis failed')
      );

      await expect(
        translationEngine.translateSRTWithAnalysis(mockSRT, 'bn')
      ).rejects.toThrow('Analysis failed');
    });
  });
});

describe('TranslationEngine Integration', () => {
  it('should integrate all components correctly', async () => {
    const mockTranscriptionService = new MockTranscriptionService();
    const mockMovieAnalysisService = new MockMovieAnalysisService();
    const mockFileManager = new MockFileManager();

    const engine = new TranslationEngineImpl(
      mockTranscriptionService,
      mockMovieAnalysisService,
      mockFileManager
    );

    const mockSRT = new SRTFileImpl(
      'integration-test-id',
      '1\n00:00:00,000 --> 00:00:02,000\nHello world\n\n2\n00:00:02,000 --> 00:00:04,000\nHow are you?\n',
      [
        { index: 1, startTime: '00:00:00,000', endTime: '00:00:02,000', text: 'Hello world' },
        { index: 2, startTime: '00:00:02,000', endTime: '00:00:04,000', text: 'How are you?' }
      ],
      4
    );

    const result = await engine.translateSRTWithAnalysis(mockSRT, 'bn');

    // Verify complete integration
    expect(result.originalSRT).toBe(mockSRT);
    expect(result.translatedSRT.segments).toHaveLength(2);
    expect(result.movieAnalysis.characterAnalysis).toHaveLength(1);
    expect(result.processingMetrics.totalProcessingTime).toBeGreaterThan(0);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});
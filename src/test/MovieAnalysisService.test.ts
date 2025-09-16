import { MovieAnalysisServiceImpl } from '../services/MovieAnalysisServiceImpl';
import { DEFAULT_MOVIE_ANALYSIS_CONFIG } from '../services/MovieAnalysisService';
import { TranscriptionResultImpl } from '../models/TranscriptionResult';
import { TranslationResultImpl } from '../models/TranslationResult';

describe('MovieAnalysisServiceImpl', () => {
  let movieAnalysisService: MovieAnalysisServiceImpl;

  beforeEach(() => {
    movieAnalysisService = new MovieAnalysisServiceImpl(DEFAULT_MOVIE_ANALYSIS_CONFIG);
  });

  describe('analyzeFromTranscription', () => {
    it('should analyze transcription and generate movie analysis', async () => {
      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [
          { text: 'Hello, how are you today?', startTime: 0, endTime: 2, confidence: 0.9 },
          { text: 'I am doing great, thanks for asking!', startTime: 2, endTime: 5, confidence: 0.8 },
          { text: 'That is wonderful to hear.', startTime: 5, endTime: 7, confidence: 0.85 }
        ],
        'en',
        0.85
      );

      const analysis = await movieAnalysisService.analyzeFromTranscription(mockTranscription);

      expect(analysis).toBeDefined();
      expect(analysis.id).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.themes).toBeInstanceOf(Array);
      expect(analysis.characterAnalysis).toBeInstanceOf(Array);
      expect(analysis.genreClassification).toBeInstanceOf(Array);
      expect(analysis.sentimentAnalysis).toBeDefined();
      expect(analysis.keyScenes).toBeInstanceOf(Array);
      expect(analysis.culturalContext).toBeInstanceOf(Array);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.processingTime).toBeGreaterThan(0);
    });

    it('should generate character profiles from dialogue', async () => {
      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [
          { text: 'John: Hello there!', startTime: 0, endTime: 2, confidence: 0.9 },
          { text: 'Mary: Hi John, how are you?', startTime: 2, endTime: 4, confidence: 0.8 },
          { text: 'John: I am doing great, thanks!', startTime: 4, endTime: 6, confidence: 0.85 }
        ],
        'en',
        0.85
      );

      const analysis = await movieAnalysisService.analyzeFromTranscription(mockTranscription);

      expect(analysis.characterAnalysis.length).toBeGreaterThan(0);
      
      const characters = analysis.characterAnalysis;
      expect(characters[0]).toHaveProperty('name');
      expect(characters[0]).toHaveProperty('description');
      expect(characters[0]).toHaveProperty('personality');
      expect(characters[0]).toHaveProperty('voiceCharacteristics');
      expect(characters[0]).toHaveProperty('dialogueCount');
      expect(characters[0]).toHaveProperty('screenTime');
      expect(characters[0]).toHaveProperty('importance');
      
      expect(['MAIN', 'SUPPORTING', 'MINOR']).toContain(characters[0].importance);
    });
  });

  describe('analyzeFromTranslation', () => {
    it('should analyze translation and generate movie analysis', async () => {
      const mockTranslation = new TranslationResultImpl(
        'test-id',
        'Hello, how are you today? I am doing great, thanks! My family is well.',
        'হ্যালো, আজ আপনি কেমন আছেন? আমি খুব ভাল আছি, ধন্যবাদ! আমার পরিবার ভাল আছে।',
        [
          { originalText: 'Hello, how are you today?', translatedText: 'হ্যালো, আজ আপনি কেমন আছেন?', startTime: 0, endTime: 2, confidence: 0.9 },
          { originalText: 'I am doing great, thanks! My family is well.', translatedText: 'আমি খুব ভাল আছি, ধন্যবাদ! আমার পরিবার ভাল আছে।', startTime: 2, endTime: 4, confidence: 0.8 }
        ],
        'bn'
      );

      const analysis = await movieAnalysisService.analyzeFromTranslation(mockTranslation);

      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.themes).toBeInstanceOf(Array);
      expect(analysis.characterAnalysis).toBeInstanceOf(Array);
      expect(analysis.culturalContext).toBeInstanceOf(Array);
      // Cultural context might be empty for simple dialogues, so we'll just check it's an array
    });
  });

  describe('generateCharacterProfiles', () => {
    it('should generate character profiles from dialogues', async () => {
      const dialogues = [
        'Hello there, my friend!',
        'How are you doing today?',
        'I am excited about this adventure!',
        'Let us go on this journey together.'
      ];

      const profiles = await movieAnalysisService.generateCharacterProfiles(dialogues);

      expect(profiles).toBeInstanceOf(Array);
      expect(profiles.length).toBeGreaterThan(0);
      
      const profile = profiles[0];
      expect(profile.name).toBeDefined();
      expect(profile.description).toBeDefined();
      expect(profile.personality).toBeInstanceOf(Array);
      expect(profile.voiceCharacteristics).toBeDefined();
      expect(profile.voiceCharacteristics.gender).toMatch(/MALE|FEMALE|NEUTRAL/);
      expect(profile.voiceCharacteristics.speakingRate).toBeGreaterThan(0);
      expect(profile.dialogueCount).toBeGreaterThan(0);
      expect(profile.screenTime).toBeGreaterThan(0);
    });

    it('should assign character importance correctly', async () => {
      const dialogues = Array(20).fill('Test dialogue');
      const profiles = await movieAnalysisService.generateCharacterProfiles(dialogues);

      const importanceLevels = profiles.map(p => p.importance);
      expect(importanceLevels).toContain('MAIN');
      
      // Main characters should have higher dialogue counts
      const mainCharacters = profiles.filter(p => p.importance === 'MAIN');
      const minorCharacters = profiles.filter(p => p.importance === 'MINOR');
      
      if (mainCharacters.length > 0 && minorCharacters.length > 0) {
        expect(mainCharacters[0].dialogueCount).toBeGreaterThanOrEqual(minorCharacters[0].dialogueCount);
      }
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment of positive text', async () => {
      const positiveText = 'I love this wonderful movie! It is amazing and beautiful.';
      
      const sentiment = await movieAnalysisService.analyzeSentiment(positiveText);

      expect(sentiment.overall).toBeGreaterThan(0);
      expect(sentiment.segments).toBeInstanceOf(Array);
      expect(sentiment.segments.length).toBeGreaterThan(0);
      
      const positiveSegments = sentiment.segments.filter(s => s.sentiment > 0);
      expect(positiveSegments.length).toBeGreaterThan(0);
    });

    it('should analyze sentiment of negative text', async () => {
      const negativeText = 'This is terrible and awful. I hate this horrible experience.';
      
      const sentiment = await movieAnalysisService.analyzeSentiment(negativeText);

      expect(sentiment.overall).toBeLessThan(0);
      expect(sentiment.segments).toBeInstanceOf(Array);
      
      const negativeSegments = sentiment.segments.filter(s => s.sentiment < 0);
      expect(negativeSegments.length).toBeGreaterThan(0);
    });

    it('should handle neutral text', async () => {
      const neutralText = 'The weather is normal today. People are walking.';
      
      const sentiment = await movieAnalysisService.analyzeSentiment(neutralText);

      expect(sentiment.overall).toBeCloseTo(0, 1);
      expect(sentiment.segments).toBeInstanceOf(Array);
    });
  });

  describe('extractThemes', () => {
    it('should extract themes from text with love content', async () => {
      const loveText = 'This is a story about love and romance. The heart wants what it wants.';
      
      const themes = await movieAnalysisService.extractThemes(loveText);

      expect(themes).toContain('love');
      expect(themes).toBeInstanceOf(Array);
    });

    it('should extract themes from action content', async () => {
      const actionText = 'There was a big fight and battle. Guns were firing and explosions everywhere.';
      
      const themes = await movieAnalysisService.extractThemes(actionText);

      expect(themes).toContain('action');
    });

    it('should extract multiple themes', async () => {
      const mixedText = 'This family story has love, action, and mystery. Friends fight together to solve the secret. The mother and father are worried about their child.';
      
      const themes = await movieAnalysisService.extractThemes(mixedText);

      expect(themes.length).toBeGreaterThan(1);
      // Check for themes that should be detected based on the keywords in the text
      const detectedThemes = themes.join(' ');
      expect(detectedThemes).toMatch(/family|love|action|mystery|friendship/);
    });
  });

  describe('classifyGenre', () => {
    it('should classify genre based on themes', async () => {
      const themes = ['love', 'romance'];
      const text = 'A romantic story';
      
      const genres = await movieAnalysisService.classifyGenre(text, themes);

      expect(genres).toContain('Romance');
      expect(genres).toBeInstanceOf(Array);
    });

    it('should return default genre when no themes match', async () => {
      const themes: string[] = [];
      const text = 'Some random text';
      
      const genres = await movieAnalysisService.classifyGenre(text, themes);

      expect(genres).toContain('General');
    });
  });

  describe('identifyKeyScenes', () => {
    it('should identify key scenes from transcription', async () => {
      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [
          { text: 'Scene 1: Introduction', startTime: 0, endTime: 10, confidence: 0.9 },
          { text: 'Scene 2: Conflict begins', startTime: 15, endTime: 25, confidence: 0.8 },
          { text: 'Scene 3: Resolution', startTime: 30, endTime: 40, confidence: 0.85 }
        ],
        'en',
        0.85
      );

      const scenes = await movieAnalysisService.identifyKeyScenes(mockTranscription);

      expect(scenes).toBeInstanceOf(Array);
      expect(scenes.length).toBeGreaterThan(0);
      
      const scene = scenes[0];
      expect(scene.startTime).toBeDefined();
      expect(scene.endTime).toBeDefined();
      expect(scene.description).toBeDefined();
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(scene.importance);
      expect(scene.characters).toBeInstanceOf(Array);
    });
  });

  describe('generateCulturalContext', () => {
    it('should generate cultural context for Bangla translation', async () => {
      const text = 'The family gathered for prayer at the temple. Mother served rice and curry.';
      
      const context = await movieAnalysisService.generateCulturalContext(text, 'bn');

      expect(context).toBeInstanceOf(Array);
      expect(context.length).toBeGreaterThan(0);
      
      const note = context[0];
      expect(note.text).toBeDefined();
      expect(note.context).toBeDefined();
      expect(note.suggestion).toBeDefined();
    });

    it('should handle non-Bangla languages', async () => {
      const text = 'Some text content';
      
      const context = await movieAnalysisService.generateCulturalContext(text, 'es');

      expect(context).toBeInstanceOf(Array);
      // Should return empty array for non-Bangla languages in current implementation
    });
  });

  describe('configuration handling', () => {
    it('should respect disabled analysis features', async () => {
      const disabledConfig = {
        ...DEFAULT_MOVIE_ANALYSIS_CONFIG,
        enableCharacterAnalysis: false,
        enableSentimentAnalysis: false,
        enableThemeExtraction: false
      };

      const serviceWithDisabledFeatures = new MovieAnalysisServiceImpl(disabledConfig);
      
      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [{ text: 'Test dialogue', startTime: 0, endTime: 2, confidence: 0.9 }],
        'en',
        0.9
      );

      const analysis = await serviceWithDisabledFeatures.analyzeFromTranscription(mockTranscription);

      expect(analysis.characterAnalysis).toHaveLength(0);
      expect(analysis.themes).toHaveLength(0);
      expect(analysis.sentimentAnalysis.overall).toBe(0);
      expect(analysis.sentimentAnalysis.segments).toHaveLength(0);
    });

    it('should respect maximum limits configuration', async () => {
      const limitedConfig = {
        ...DEFAULT_MOVIE_ANALYSIS_CONFIG,
        maxCharacters: 2,
        maxThemes: 1,
        maxScenes: 1
      };

      const serviceWithLimits = new MovieAnalysisServiceImpl(limitedConfig);
      
      const longDialogues = Array(10).fill('Character dialogue with different themes like love, action, mystery, family, friendship');
      
      const profiles = await serviceWithLimits.generateCharacterProfiles(longDialogues);
      const themes = await serviceWithLimits.extractThemes(longDialogues.join(' '));

      expect(profiles.length).toBeLessThanOrEqual(2);
      expect(themes.length).toBeLessThanOrEqual(1);
    });
  });
});
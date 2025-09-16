import { v4 as uuidv4 } from 'uuid';
import { TranscriptionResult, TranslationResult } from '../models';
import { 
  MovieAnalysis, 
  MovieAnalysisImpl,
  CharacterProfile, 
  VoiceProfile, 
  SentimentScore, 
  SceneBreakdown, 
  CulturalNote 
} from '../models/MovieAnalysis';
import { 
  MovieAnalysisService, 
  MovieAnalysisConfig, 
  DEFAULT_MOVIE_ANALYSIS_CONFIG 
} from './MovieAnalysisService';

export class MovieAnalysisServiceImpl implements MovieAnalysisService {
  private config: MovieAnalysisConfig;

  constructor(config: MovieAnalysisConfig = DEFAULT_MOVIE_ANALYSIS_CONFIG) {
    this.config = config;
  }

  async analyzeFromTranscription(transcription: TranscriptionResult): Promise<MovieAnalysis> {
    const startTime = Date.now();
    
    const fullText = transcription.segments.map(s => s.text).join(' ');
    const dialogues = transcription.segments.map(s => s.text);
    
    // Run analysis components in parallel for efficiency
    const [
      characterProfiles,
      sentimentAnalysis,
      themes,
      genres,
      keyScenes,
      culturalContext
    ] = await Promise.all([
      this.config.enableCharacterAnalysis ? this.generateCharacterProfiles(dialogues) : Promise.resolve([]),
      this.config.enableSentimentAnalysis ? this.analyzeSentiment(fullText) : Promise.resolve(this.getDefaultSentiment()),
      this.config.enableThemeExtraction ? this.extractThemes(fullText) : Promise.resolve([]),
      this.config.enableGenreClassification ? this.classifyGenre(fullText, []) : Promise.resolve([]),
      this.config.enableSceneAnalysis ? this.identifyKeyScenes(transcription) : Promise.resolve([]),
      this.config.enableCulturalContext ? this.generateCulturalContext(fullText, 'bn') : Promise.resolve([])
    ]);

    const summary = this.generateSummary(fullText, themes, characterProfiles);
    const processingTime = Date.now() - startTime;
    const confidence = this.calculateOverallConfidence(characterProfiles, sentimentAnalysis, themes);

    return new MovieAnalysisImpl(
      uuidv4(),
      summary,
      themes,
      characterProfiles,
      genres,
      sentimentAnalysis,
      keyScenes,
      culturalContext,
      processingTime,
      confidence,
      undefined // movieId
    );
  }

  async analyzeFromTranslation(translation: TranslationResult): Promise<MovieAnalysis> {
    const startTime = Date.now();
    
    const fullText = translation.translatedText;
    const dialogues = translation.segments.map(s => s.translatedText);
    
    // Run analysis on translated content
    const [
      characterProfiles,
      sentimentAnalysis,
      themes,
      genres,
      keyScenes,
      culturalContext
    ] = await Promise.all([
      this.config.enableCharacterAnalysis ? this.generateCharacterProfiles(dialogues) : Promise.resolve([]),
      this.config.enableSentimentAnalysis ? this.analyzeSentiment(fullText) : Promise.resolve(this.getDefaultSentiment()),
      this.config.enableThemeExtraction ? this.extractThemes(fullText) : Promise.resolve([]),
      this.config.enableGenreClassification ? this.classifyGenre(fullText, []) : Promise.resolve([]),
      this.config.enableSceneAnalysis ? this.identifyKeyScenesFromTranslation(translation) : Promise.resolve([]),
      this.config.enableCulturalContext ? this.generateCulturalContext(translation.originalText, translation.targetLanguage) : Promise.resolve([])
    ]);

    const summary = this.generateSummary(fullText, themes, characterProfiles);
    const processingTime = Date.now() - startTime;
    const confidence = this.calculateOverallConfidence(characterProfiles, sentimentAnalysis, themes);

    return new MovieAnalysisImpl(
      uuidv4(),
      summary,
      themes,
      characterProfiles,
      genres,
      sentimentAnalysis,
      keyScenes,
      culturalContext,
      processingTime,
      confidence,
      undefined // movieId
    );
  }

  async generateCharacterProfiles(dialogues: string[], speakers?: string[]): Promise<CharacterProfile[]> {
    const characters: Map<string, CharacterProfile> = new Map();
    
    // Simple character identification based on dialogue patterns
    for (let i = 0; i < dialogues.length; i++) {
      const dialogue = dialogues[i];
      const speaker = speakers?.[i] || this.identifySpeakerFromDialogue(dialogue, i);
      
      if (!characters.has(speaker)) {
        const voiceProfile = this.analyzeVoiceCharacteristics(dialogue);
        const personality = this.extractPersonalityTraits(dialogue);
        
        characters.set(speaker, {
          name: speaker,
          description: this.generateCharacterDescription(speaker, dialogue),
          personality,
          voiceCharacteristics: voiceProfile,
          dialogueCount: 1,
          screenTime: this.estimateScreenTime(dialogue),
          importance: 'MINOR'
        });
      } else {
        const existing = characters.get(speaker)!;
        existing.dialogueCount++;
        existing.screenTime += this.estimateScreenTime(dialogue);
      }
    }

    // Determine character importance based on dialogue count and screen time
    const characterList = Array.from(characters.values());
    this.assignCharacterImportance(characterList);
    
    // Sort by importance and limit results
    return characterList
      .sort((a, b) => this.getImportanceScore(b) - this.getImportanceScore(a))
      .slice(0, this.config.maxCharacters);
  }

  private identifySpeakerFromDialogue(dialogue: string, index: number): string {
    // Simple heuristic for speaker identification
    // In a real implementation, this would use more sophisticated NLP
    const commonNames = ['John', 'Mary', 'David', 'Sarah', 'Mike', 'Lisa', 'Tom', 'Anna'];
    const namePattern = /^([A-Z][a-z]+):/;
    const match = dialogue.match(namePattern);
    
    if (match) {
      return match[1];
    }
    
    // Fallback to generic speaker names
    return commonNames[index % commonNames.length] || `Speaker${index + 1}`;
  }

  private analyzeVoiceCharacteristics(dialogue: string): VoiceProfile {
    // Analyze dialogue for voice characteristics
    const words = dialogue.split(' ');
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    // Simple heuristics for voice characteristics
    const hasExclamation = dialogue.includes('!');
    const hasQuestion = dialogue.includes('?');
    const isUpperCase = dialogue === dialogue.toUpperCase();
    
    return {
      gender: this.inferGender(dialogue),
      ageRange: this.inferAgeRange(dialogue, avgWordLength),
      accent: 'neutral',
      tone: this.inferTone(hasExclamation, hasQuestion, isUpperCase),
      speakingRate: this.inferSpeakingRate(words.length),
      pitch: this.inferPitch(hasExclamation, isUpperCase)
    };
  }

  private inferGender(dialogue: string): 'MALE' | 'FEMALE' | 'NEUTRAL' {
    // Simple gender inference based on dialogue patterns
    const femaleIndicators = ['she', 'her', 'woman', 'girl', 'lady', 'mother', 'sister', 'daughter'];
    const maleIndicators = ['he', 'him', 'man', 'boy', 'guy', 'father', 'brother', 'son'];
    
    const lowerDialogue = dialogue.toLowerCase();
    const femaleScore = femaleIndicators.reduce((score, word) => 
      score + (lowerDialogue.includes(word) ? 1 : 0), 0);
    const maleScore = maleIndicators.reduce((score, word) => 
      score + (lowerDialogue.includes(word) ? 1 : 0), 0);
    
    if (femaleScore > maleScore) return 'FEMALE';
    if (maleScore > femaleScore) return 'MALE';
    return 'NEUTRAL';
  }

  private inferAgeRange(dialogue: string, avgWordLength: number): string {
    // Infer age based on vocabulary complexity and content
    if (avgWordLength < 4) return 'young';
    if (avgWordLength > 6) return 'mature';
    return 'adult';
  }

  private inferTone(hasExclamation: boolean, hasQuestion: boolean, isUpperCase: boolean): string[] {
    const tones: string[] = [];
    
    if (hasExclamation) tones.push('excited', 'emphatic');
    if (hasQuestion) tones.push('curious', 'inquisitive');
    if (isUpperCase) tones.push('loud', 'aggressive');
    
    if (tones.length === 0) tones.push('neutral', 'calm');
    
    return tones;
  }

  private inferSpeakingRate(wordCount: number): number {
    // Estimate speaking rate based on dialogue length
    // Normal speaking rate is around 150-160 words per minute
    if (wordCount < 5) return 120; // slower
    if (wordCount > 15) return 180; // faster
    return 150; // normal
  }

  private inferPitch(hasExclamation: boolean, isUpperCase: boolean): number {
    // Estimate pitch based on dialogue characteristics
    let pitch = 0; // neutral
    
    if (hasExclamation) pitch += 0.2;
    if (isUpperCase) pitch += 0.3;
    
    return Math.min(1, Math.max(-1, pitch));
  }

  private extractPersonalityTraits(dialogue: string): string[] {
    const traits: string[] = [];
    const lowerDialogue = dialogue.toLowerCase();
    
    // Simple personality trait extraction
    if (lowerDialogue.includes('please') || lowerDialogue.includes('thank')) {
      traits.push('polite');
    }
    if (lowerDialogue.includes('!')) {
      traits.push('expressive');
    }
    if (lowerDialogue.includes('?')) {
      traits.push('curious');
    }
    if (lowerDialogue.includes('sorry') || lowerDialogue.includes('apologize')) {
      traits.push('apologetic');
    }
    if (lowerDialogue.includes('love') || lowerDialogue.includes('care')) {
      traits.push('caring');
    }
    
    return traits.length > 0 ? traits : ['neutral'];
  }

  private generateCharacterDescription(name: string, dialogue: string): string {
    const words = dialogue.split(' ').length;
    const hasEmotionalWords = /love|hate|fear|joy|sad|happy|angry/i.test(dialogue);
    
    let description = `${name} appears in the dialogue`;
    
    if (words > 20) {
      description += ' as a talkative character';
    } else if (words < 5) {
      description += ' with brief, concise speech';
    }
    
    if (hasEmotionalWords) {
      description += ' who expresses emotions openly';
    }
    
    return description + '.';
  }

  private estimateScreenTime(dialogue: string): number {
    // Estimate screen time based on dialogue length
    // Assuming average speaking rate of 150 words per minute
    const words = dialogue.split(' ').length;
    return (words / 150) * 60; // seconds
  }

  private assignCharacterImportance(characters: CharacterProfile[]): void {
    // Sort by dialogue count and screen time to determine importance
    characters.sort((a, b) => (b.dialogueCount + b.screenTime) - (a.dialogueCount + a.screenTime));
    
    const total = characters.length;
    characters.forEach((char, index) => {
      if (index < total * 0.2) {
        char.importance = 'MAIN';
      } else if (index < total * 0.5) {
        char.importance = 'SUPPORTING';
      } else {
        char.importance = 'MINOR';
      }
    });
  }

  private getImportanceScore(character: CharacterProfile): number {
    const importanceScores = { MAIN: 3, SUPPORTING: 2, MINOR: 1 };
    return importanceScores[character.importance] * 100 + character.dialogueCount + character.screenTime;
  }

  async analyzeSentiment(text: string): Promise<SentimentScore> {
    // Simple sentiment analysis implementation
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const segments: SentimentScore['segments'] = [];
    
    let overallSentiment = 0;
    let currentTime = 0;
    
    for (const sentence of sentences) {
      const sentiment = this.calculateSentimentScore(sentence);
      const emotion = this.classifyEmotion(sentiment);
      const duration = this.estimateSentenceDuration(sentence);
      
      segments.push({
        startTime: currentTime,
        endTime: currentTime + duration,
        sentiment,
        emotion
      });
      
      overallSentiment += sentiment;
      currentTime += duration;
    }
    
    return {
      overall: sentences.length > 0 ? overallSentiment / sentences.length : 0,
      segments
    };
  }

  private calculateSentimentScore(text: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'happy', 'joy', 'beautiful', 'perfect'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 'fear', 'ugly', 'wrong'];
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 0.1;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 0.1;
    });
    
    return Math.min(1, Math.max(-1, score));
  }

  private classifyEmotion(sentiment: number): string {
    if (sentiment > 0.3) return 'positive';
    if (sentiment < -0.3) return 'negative';
    return 'neutral';
  }

  private estimateSentenceDuration(sentence: string): number {
    // Estimate duration based on sentence length (assuming 150 words per minute)
    const words = sentence.split(' ').length;
    return (words / 150) * 60; // seconds
  }

  async extractThemes(text: string): Promise<string[]> {
    const themes: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Theme detection based on keywords
    const themeKeywords = {
      'love': ['love', 'romance', 'relationship', 'heart', 'kiss', 'marry'],
      'action': ['fight', 'battle', 'war', 'gun', 'explosion', 'chase'],
      'mystery': ['mystery', 'secret', 'hidden', 'clue', 'detective', 'solve'],
      'family': ['family', 'mother', 'father', 'child', 'parent', 'home'],
      'friendship': ['friend', 'buddy', 'companion', 'together', 'support'],
      'adventure': ['journey', 'travel', 'explore', 'discover', 'quest'],
      'drama': ['emotion', 'conflict', 'struggle', 'pain', 'suffer'],
      'comedy': ['funny', 'laugh', 'joke', 'humor', 'silly']
    };
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword));
      if (matches.length >= 2) {
        themes.push(theme);
      }
    }
    
    return themes.slice(0, this.config.maxThemes);
  }

  async classifyGenre(text: string, themes: string[]): Promise<string[]> {
    const genres: string[] = [];
    
    // Genre classification based on themes and content
    if (themes.includes('love') || themes.includes('romance')) {
      genres.push('Romance');
    }
    if (themes.includes('action') || themes.includes('adventure')) {
      genres.push('Action');
    }
    if (themes.includes('mystery')) {
      genres.push('Mystery');
    }
    if (themes.includes('comedy')) {
      genres.push('Comedy');
    }
    if (themes.includes('drama') || themes.includes('family')) {
      genres.push('Drama');
    }
    
    // Default genre if none detected
    if (genres.length === 0) {
      genres.push('General');
    }
    
    return genres;
  }

  async identifyKeyScenes(transcription: TranscriptionResult): Promise<SceneBreakdown[]> {
    const scenes: SceneBreakdown[] = [];
    const segments = transcription.segments;
    
    // Group segments into scenes based on timing gaps and content changes
    let currentScene: SceneBreakdown | null = null;
    let sceneCharacters: Set<string> = new Set();
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];
      
      // Detect scene break based on timing gap (>5 seconds) or content change
      const isSceneBreak = !nextSegment || 
        (nextSegment.startTime - segment.endTime > 5) ||
        this.detectContentChange(segment.text, nextSegment?.text);
      
      if (!currentScene) {
        currentScene = {
          startTime: segment.startTime,
          endTime: segment.endTime,
          description: this.generateSceneDescription(segment.text),
          importance: 'MEDIUM',
          characters: []
        };
        sceneCharacters.clear();
      } else {
        currentScene.endTime = segment.endTime;
        currentScene.description += ' ' + this.generateSceneDescription(segment.text);
      }
      
      // Add characters mentioned in this segment
      const mentionedCharacters = this.extractCharacterMentions(segment.text);
      mentionedCharacters.forEach(char => sceneCharacters.add(char));
      
      if (isSceneBreak) {
        currentScene.characters = Array.from(sceneCharacters);
        currentScene.importance = this.assessSceneImportance(currentScene);
        scenes.push(currentScene);
        currentScene = null;
      }
    }
    
    return scenes.slice(0, this.config.maxScenes);
  }

  private async identifyKeyScenesFromTranslation(translation: TranslationResult): Promise<SceneBreakdown[]> {
    const scenes: SceneBreakdown[] = [];
    const segments = translation.segments;
    
    // Similar logic to identifyKeyScenes but using translation segments
    let currentScene: SceneBreakdown | null = null;
    let sceneCharacters: Set<string> = new Set();
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];
      
      const isSceneBreak = !nextSegment || 
        (nextSegment.startTime - segment.endTime > 5) ||
        this.detectContentChange(segment.translatedText, nextSegment?.translatedText);
      
      if (!currentScene) {
        currentScene = {
          startTime: segment.startTime,
          endTime: segment.endTime,
          description: this.generateSceneDescription(segment.translatedText),
          importance: 'MEDIUM',
          characters: []
        };
        sceneCharacters.clear();
      } else {
        currentScene.endTime = segment.endTime;
        currentScene.description += ' ' + this.generateSceneDescription(segment.translatedText);
      }
      
      const mentionedCharacters = this.extractCharacterMentions(segment.translatedText);
      mentionedCharacters.forEach(char => sceneCharacters.add(char));
      
      if (isSceneBreak) {
        currentScene.characters = Array.from(sceneCharacters);
        currentScene.importance = this.assessSceneImportance(currentScene);
        scenes.push(currentScene);
        currentScene = null;
      }
    }
    
    return scenes.slice(0, this.config.maxScenes);
  }

  private detectContentChange(text1: string, text2?: string): boolean {
    if (!text2) return true;
    
    // Simple content change detection based on topic shift
    const words1 = new Set(text1.toLowerCase().split(' '));
    const words2 = new Set(text2.toLowerCase().split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const similarity = intersection.size / union.size;
    return similarity < 0.3; // Low similarity indicates content change
  }

  private generateSceneDescription(text: string): string {
    // Generate a brief scene description from dialogue
    const words = text.split(' ').slice(0, 10).join(' ');
    return words + (text.split(' ').length > 10 ? '...' : '');
  }

  private extractCharacterMentions(text: string): string[] {
    // Extract character names mentioned in dialogue
    const namePattern = /\b[A-Z][a-z]+\b/g;
    const matches = text.match(namePattern) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  private assessSceneImportance(scene: SceneBreakdown): 'HIGH' | 'MEDIUM' | 'LOW' {
    const duration = scene.endTime - scene.startTime;
    const characterCount = scene.characters.length;
    
    if (duration > 60 && characterCount > 2) return 'HIGH';
    if (duration > 30 || characterCount > 1) return 'MEDIUM';
    return 'LOW';
  }

  async generateCulturalContext(text: string, targetLanguage: string): Promise<CulturalNote[]> {
    const notes: CulturalNote[] = [];
    
    if (targetLanguage === 'bn' || targetLanguage === 'bangla') {
      // Generate Bangla-specific cultural context
      const culturalPatterns = {
        'family relationships': /\b(mother|father|brother|sister|uncle|aunt)\b/gi,
        'religious references': /\b(god|prayer|temple|mosque|church)\b/gi,
        'food culture': /\b(rice|curry|fish|tea|sweets)\b/gi,
        'social customs': /\b(respect|elder|tradition|festival)\b/gi
      };
      
      for (const [context, pattern] of Object.entries(culturalPatterns)) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          notes.push({
            text: matches[0],
            context: context,
            suggestion: this.getBanglaContextSuggestion(context),
          });
        }
      }
    }
    
    return notes;
  }

  private getBanglaContextSuggestion(context: string): string {
    const suggestions = {
      'family relationships': 'Consider using appropriate Bangla honorifics and family terms',
      'religious references': 'Adapt religious references to be culturally appropriate for Bangla audience',
      'food culture': 'Use familiar Bangla food terms and cultural references',
      'social customs': 'Incorporate Bangla social customs and respectful language'
    };
    
    return suggestions[context as keyof typeof suggestions] || 'Consider cultural adaptation for Bangla audience';
  }

  private generateSummary(text: string, themes: string[], characters: CharacterProfile[]): string {
    const mainTheme = themes[0] || 'general';
    const mainCharacters = characters.filter(c => c.importance === 'MAIN').map(c => c.name);
    
    let summary = `This appears to be a ${mainTheme}-themed content`;
    
    if (mainCharacters.length > 0) {
      summary += ` featuring ${mainCharacters.slice(0, 3).join(', ')}`;
    }
    
    if (themes.length > 1) {
      summary += ` with elements of ${themes.slice(1, 3).join(' and ')}`;
    }
    
    summary += '.';
    
    return summary;
  }

  private calculateOverallConfidence(
    characters: CharacterProfile[], 
    sentiment: SentimentScore, 
    themes: string[]
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on analysis completeness
    if (characters.length > 0) confidence += 0.2;
    if (sentiment.segments.length > 0) confidence += 0.1;
    if (themes.length > 0) confidence += 0.2;
    
    return Math.min(1, confidence);
  }

  private getDefaultSentiment(): SentimentScore {
    return {
      overall: 0,
      segments: []
    };
  }
}
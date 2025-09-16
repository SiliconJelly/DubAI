import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  TranscriptionService, 
  TranscriptionConfig 
} from './TranscriptionService';
import { 
  AudioFile, 
  TranscriptionResult, 
  TranscriptionResultImpl,
  TranslationResult, 
  TranslationResultImpl,
  SRTFile,
  SRTFileImpl,
  TranscriptionSegment,
  TranslationSegment,
  SRTSegment
} from '../models';
import { TranscriptionError } from '../types/errors';
import { DefaultErrorHandler } from '../utils/errorHandler';
import { FileManager, FileManagerConfig } from '../utils/fileManager';
import { WHISPER_CONFIG } from '../utils/constants';

export class TranscriptionServiceImpl implements TranscriptionService {
  private errorHandler: DefaultErrorHandler;
  private config: TranscriptionConfig;
  private fileManager: FileManager;

  constructor(config: TranscriptionConfig, tempDirectory: string = './temp') {
    this.config = config;
    this.errorHandler = new DefaultErrorHandler();
    
    const fileManagerConfig: FileManagerConfig = {
      tempDirectory,
      outputDirectory: path.join(tempDirectory, 'output'),
      cleanupIntervalHours: 24
    };
    this.fileManager = new FileManager(fileManagerConfig);
  }

  async transcribeAudio(audioFile: AudioFile): Promise<TranscriptionResult> {
    let lastError: Error | null = null;
    const modelSizes = WHISPER_CONFIG.SUPPORTED_MODELS;
    let currentModelIndex = modelSizes.indexOf(this.config.modelSize);
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.runWhisperTranscription(audioFile, modelSizes[currentModelIndex] as any);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Try with a smaller model on retry
        if (currentModelIndex > 0) {
          currentModelIndex--;
        }
        
        // Wait before retry
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }
    
    throw new TranscriptionError(
      `Failed to transcribe audio after ${this.config.maxRetries} attempts: ${lastError?.message}`,
      lastError || undefined
    );
  }

  private async runWhisperTranscription(
    audioFile: AudioFile, 
    modelSize: string
  ): Promise<TranscriptionResult> {
    return new Promise(async (resolve, reject) => {
      const tempOutputPath = await this.fileManager.createTempFile('json');
      
      const whisperArgs = [
        '-m', 'whisper',
        audioFile.path,
        '--model', modelSize,
        '--language', this.config.language,
        '--temperature', this.config.temperature.toString(),
        '--output_format', 'json',
        '--output_dir', path.dirname(tempOutputPath),
        '--output_file', path.basename(tempOutputPath, '.json')
      ];

      const whisperProcess = spawn('python', whisperArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      whisperProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      whisperProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      whisperProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new TranscriptionError(`Whisper process failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const transcriptionData = await this.parseWhisperOutput(tempOutputPath);
          
          // Clean up temp file
          await this.fileManager.deleteFile(tempOutputPath);
          
          resolve(transcriptionData);
        } catch (error) {
          reject(new TranscriptionError(`Failed to parse Whisper output: ${error}`));
        }
      });

      whisperProcess.on('error', (error) => {
        reject(new TranscriptionError(`Failed to start Whisper process: ${error.message}`, error));
      });
    });
  }

  private async parseWhisperOutput(outputPath: string): Promise<TranscriptionResult> {
    try {
      const jsonContent = await fs.readFile(outputPath, 'utf-8');
      const whisperResult = JSON.parse(jsonContent);
      
      const segments: TranscriptionSegment[] = whisperResult.segments?.map((segment: any) => ({
        text: segment.text?.trim() || '',
        startTime: segment.start || 0,
        endTime: segment.end || 0,
        confidence: segment.confidence || 0.5
      })) || [];

      const overallConfidence = segments.length > 0 
        ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length
        : 0;

      return new TranscriptionResultImpl(
        uuidv4(),
        segments,
        whisperResult.language || this.config.language,
        overallConfidence
      );
    } catch (error) {
      throw new TranscriptionError(`Failed to parse Whisper JSON output: ${error}`);
    }
  } 
  async translateToTarget(
    transcription: TranscriptionResult, 
    targetLang: string
  ): Promise<TranslationResult> {
    // Validate target language
    if (!this.isSupportedTargetLanguage(targetLang)) {
      throw new TranscriptionError(`Unsupported target language: ${targetLang}. Currently supported: bn (Bangla)`);
    }

    let lastError: Error | null = null;
    const modelSizes = WHISPER_CONFIG.SUPPORTED_MODELS;
    let currentModelIndex = modelSizes.indexOf(this.config.modelSize);
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.runWhisperTranslation(transcription, targetLang, modelSizes[currentModelIndex] as any);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Try with a smaller model on retry
        if (currentModelIndex > 0) {
          currentModelIndex--;
        }
        
        // Wait before retry
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }
    
    throw new TranscriptionError(
      `Failed to translate to ${targetLang} after ${this.config.maxRetries} attempts: ${lastError?.message}`,
      lastError || undefined
    );
  }

  private async runWhisperTranslation(
    transcription: TranscriptionResult,
    targetLang: string,
    modelSize: string
  ): Promise<TranslationResult> {
    // For now, we'll simulate the translation process since we don't have the original audio
    // In a real implementation, this would use the original audio file
    const tempAudioPath = await this.createTempAudioFromTranscription(transcription);
    
    try {
      const translationResult = await this.runWhisperTranslationProcess(tempAudioPath, targetLang, modelSize);
      
      // Validate translation quality for Bangla
      if (targetLang === 'bn') {
        this.validateBanglaTranslation(translationResult);
      }
      
      return translationResult;
    } finally {
      // Clean up temporary audio file
      await this.fileManager.deleteFile(tempAudioPath);
    }
  }

  private async runWhisperTranslationProcess(
    audioPath: string,
    targetLang: string,
    modelSize: string
  ): Promise<TranslationResult> {
    return new Promise(async (resolve, reject) => {
      const tempOutputPath = await this.fileManager.createTempFile('json');
      
      const whisperArgs = [
        '-m', 'whisper',
        audioPath,
        '--model', modelSize,
        '--task', 'translate', // Use translation task
        '--language', this.config.language, // Source language
        '--temperature', this.config.temperature.toString(),
        '--output_format', 'json',
        '--output_dir', path.dirname(tempOutputPath),
        '--output_file', path.basename(tempOutputPath, '.json')
      ];

      const whisperProcess = spawn('python', whisperArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      whisperProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      whisperProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      whisperProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new TranscriptionError(`Whisper translation process failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const translationData = await this.parseWhisperTranslationOutput(tempOutputPath, targetLang);
          
          // Clean up temp file
          await this.fileManager.deleteFile(tempOutputPath);
          
          resolve(translationData);
        } catch (error) {
          reject(new TranscriptionError(`Failed to parse Whisper translation output: ${error}`));
        }
      });

      whisperProcess.on('error', (error) => {
        reject(new TranscriptionError(`Failed to start Whisper translation process: ${error.message}`, error));
      });
    });
  }

  private async parseWhisperTranslationOutput(outputPath: string, targetLang: string): Promise<TranslationResult> {
    try {
      const jsonContent = await fs.readFile(outputPath, 'utf-8');
      const whisperResult = JSON.parse(jsonContent);
      
      const translatedSegments: TranslationSegment[] = whisperResult.segments?.map((segment: any) => ({
        originalText: segment.original_text || segment.text || '',
        translatedText: segment.text?.trim() || '',
        startTime: segment.start || 0,
        endTime: segment.end || 0,
        confidence: segment.confidence || 0.5
      })) || [];

      const originalText = translatedSegments.map(s => s.originalText).join(' ');
      const translatedText = translatedSegments.map(s => s.translatedText).join(' ');

      return new TranslationResultImpl(
        uuidv4(),
        originalText,
        translatedText,
        translatedSegments,
        targetLang
      );
    } catch (error) {
      throw new TranscriptionError(`Failed to parse Whisper translation JSON output: ${error}`);
    }
  }

  private async createTempAudioFromTranscription(transcription: TranscriptionResult): Promise<string> {
    // This is a placeholder - in a real implementation, we would need access to the original audio file
    // For now, we'll create a mock audio file path for testing purposes
    const tempPath = await this.fileManager.createTempFile('wav');
    
    // In a real implementation, this would copy or reference the original audio file
    // For testing, we'll just return the temp path which will be used by the Whisper process
    return tempPath;
  }

  /**
   * Enhanced translation workflow that preserves original timestamps
   * and provides better integration with the existing transcription
   */
  async translateWithTimestampPreservation(
    originalAudio: AudioFile,
    transcription: TranscriptionResult,
    targetLang: string
  ): Promise<TranslationResult> {
    try {
      // Use the original audio file for translation to ensure timestamp accuracy
      const translationResult = await this.runWhisperTranslationFromAudio(originalAudio, targetLang);
      
      // Merge timestamps from original transcription to ensure perfect preservation
      const mergedResult = this.mergeTimestampsFromOriginal(translationResult, transcription);
      
      // Validate translation quality
      if (targetLang === 'bn') {
        this.validateBanglaTranslation(mergedResult);
      }
      
      return mergedResult;
    } catch (error) {
      // Fallback to segment-by-segment translation if direct translation fails
      console.warn('Direct translation failed, falling back to segment-based translation:', error);
      return this.translateToTarget(transcription, targetLang);
    }
  }

  private async runWhisperTranslationFromAudio(
    audioFile: AudioFile,
    targetLang: string
  ): Promise<TranslationResult> {
    let lastError: Error | null = null;
    const modelSizes = WHISPER_CONFIG.SUPPORTED_MODELS;
    let currentModelIndex = modelSizes.indexOf(this.config.modelSize);
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.runWhisperTranslationProcess(audioFile.path, targetLang, modelSizes[currentModelIndex] as any);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Try with a smaller model on retry
        if (currentModelIndex > 0) {
          currentModelIndex--;
        }
        
        // Wait before retry
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }
    
    throw new TranscriptionError(
      `Failed to translate audio to ${targetLang} after ${this.config.maxRetries} attempts: ${lastError?.message}`,
      lastError || undefined
    );
  }

  private mergeTimestampsFromOriginal(
    translation: TranslationResult,
    originalTranscription: TranscriptionResult
  ): TranslationResult {
    // Ensure we preserve the exact timestamps from the original transcription
    const mergedSegments: TranslationSegment[] = [];
    
    // Match segments by timing overlap
    for (let i = 0; i < originalTranscription.segments.length; i++) {
      const originalSegment = originalTranscription.segments[i];
      
      // Find the best matching translation segment
      const matchingTranslationSegment = this.findBestMatchingSegment(
        originalSegment,
        translation.segments
      );
      
      if (matchingTranslationSegment) {
        mergedSegments.push({
          originalText: originalSegment.text,
          translatedText: matchingTranslationSegment.translatedText,
          startTime: originalSegment.startTime, // Preserve original timing
          endTime: originalSegment.endTime,     // Preserve original timing
          confidence: Math.min(originalSegment.confidence, matchingTranslationSegment.confidence)
        });
      } else {
        // If no matching segment found, create a placeholder
        mergedSegments.push({
          originalText: originalSegment.text,
          translatedText: `[TRANSLATION_MISSING] ${originalSegment.text}`,
          startTime: originalSegment.startTime,
          endTime: originalSegment.endTime,
          confidence: 0.1
        });
      }
    }
    
    const originalText = mergedSegments.map(s => s.originalText).join(' ');
    const translatedText = mergedSegments.map(s => s.translatedText).join(' ');
    
    return new TranslationResultImpl(
      uuidv4(),
      originalText,
      translatedText,
      mergedSegments,
      translation.targetLanguage
    );
  }

  private findBestMatchingSegment(
    originalSegment: TranscriptionSegment,
    translationSegments: TranslationSegment[]
  ): TranslationSegment | null {
    let bestMatch: TranslationSegment | null = null;
    let bestOverlap = 0;
    
    for (const translationSegment of translationSegments) {
      const overlap = this.calculateTimeOverlap(
        originalSegment.startTime,
        originalSegment.endTime,
        translationSegment.startTime,
        translationSegment.endTime
      );
      
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = translationSegment;
      }
    }
    
    // Only return a match if there's significant overlap (>50%)
    const originalDuration = originalSegment.endTime - originalSegment.startTime;
    return bestOverlap > (originalDuration * 0.5) ? bestMatch : null;
  }

  private calculateTimeOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): number {
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);
    return Math.max(0, overlapEnd - overlapStart);
  }

  private isSupportedTargetLanguage(targetLang: string): boolean {
    // Currently supporting Bangla as specified in requirements
    const supportedLanguages = ['bn', 'bangla', 'bengali'];
    return supportedLanguages.includes(targetLang.toLowerCase());
  }

  private validateBanglaTranslation(translation: TranslationResult): void {
    // Bangla-specific validation and quality checks
    for (const segment of translation.segments) {
      // Check for common translation issues
      if (this.hasBanglaTranslationIssues(segment.translatedText)) {
        console.warn(`Potential translation quality issue detected in segment: "${segment.translatedText}"`);
      }
      
      // Validate confidence threshold
      if (segment.confidence < 0.6) {
        console.warn(`Low confidence translation detected: ${segment.confidence} for text: "${segment.translatedText}"`);
      }
    }
    
    // Log recommendation for Coqui TTS tuning
    console.info('Translation completed. For optimal TTS results, consider tuning Coqui TTS with Bangla-specific voice models when implementing TTS service.');
  }

  private hasBanglaTranslationIssues(text: string): boolean {
    // Basic checks for Bangla translation quality
    // Check for untranslated English words (basic heuristic)
    const englishWordPattern = /[a-zA-Z]{3,}/g;
    const englishWords = text.match(englishWordPattern);
    
    if (englishWords && englishWords.length > 0) {
      // Allow some common English words that might remain in Bangla text
      const allowedEnglishWords = ['ok', 'yes', 'no', 'hi', 'bye'];
      const problematicWords = englishWords.filter(word => 
        !allowedEnglishWords.includes(word.toLowerCase())
      );
      
      return problematicWords.length > 0;
    }
    
    return false;
  }

  async generateSRT(translation: TranslationResult): Promise<SRTFile> {
    const srtSegments: SRTSegment[] = translation.segments.map((segment, index) => ({
      index: index + 1,
      startTime: SRTFileImpl.formatTimeString(segment.startTime),
      endTime: SRTFileImpl.formatTimeString(segment.endTime),
      text: segment.translatedText
    }));

    const srtContent = srtSegments
      .map(segment => 
        `${segment.index}\n${segment.startTime} --> ${segment.endTime}\n${segment.text}\n`
      )
      .join('\n');

    const totalDuration = translation.segments.length > 0 
      ? translation.segments[translation.segments.length - 1].endTime 
      : 0;

    return new SRTFileImpl(
      uuidv4(),
      srtContent,
      srtSegments,
      totalDuration
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
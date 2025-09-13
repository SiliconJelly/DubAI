import { TTSRouter, TTSRequest, TTSRouterConfig } from './TTSRouter';
import { CoquiTTSService } from './CoquiTTSService';
import { AudioSegment, LocalVoiceConfig, AudioSegmentImpl } from '../models';
import { UsageMetrics } from '../types/common';
import { TTSServiceType } from '../types/common';
import { v4 as uuidv4 } from 'uuid';

export class CoquiTTSRouter implements TTSRouter {
  private coquiTTSService: CoquiTTSService;
  private config: TTSRouterConfig;
  private usageTracker: UsageMetrics;
  private modelCache: Map<string, boolean> = new Map();

  constructor(
    coquiTTSService: CoquiTTSService,
    config: TTSRouterConfig
  ) {
    this.coquiTTSService = coquiTTSService;
    this.config = config;
    this.usageTracker = {
      charactersProcessed: 0,
      processingTimeMs: 0,
      apiCalls: 0,
      errorCount: 0
    };
  }

  async selectTTSService(request: TTSRequest): Promise<TTSServiceType> {
    // Always use Coqui TTS in this implementation
    return TTSServiceType.COQUI_LOCAL;
  }

  async generateSpeech(text: string, service: TTSServiceType): Promise<AudioSegment> {
    if (service !== TTSServiceType.COQUI_LOCAL) {
      throw new Error(`Unsupported TTS service: ${service}. Only Coqui TTS is supported in this implementation.`);
    }

    const startTime = Date.now();
    let audioBuffer: Buffer;
    let voiceConfig: LocalVoiceConfig;

    try {
      voiceConfig = this.createCoquiVoiceConfig();
      
      // Ensure model is loaded
      await this.ensureModelLoaded(voiceConfig.modelPath);
      
      audioBuffer = await this.coquiTTSService.synthesizeSpeech(text, voiceConfig);

      const processingTime = Date.now() - startTime;
      
      // Track usage
      await this.trackUsage({
        charactersProcessed: text.length,
        processingTimeMs: processingTime,
        apiCalls: 1,
        errorCount: 0
      });

      // Create audio segment
      const audioSegment = new AudioSegmentImpl(
        uuidv4(),
        text,
        audioBuffer,
        0, // startTime will be set by caller
        0, // endTime will be set by caller
        voiceConfig
      );

      return audioSegment;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Track error
      await this.trackUsage({
        charactersProcessed: text.length,
        processingTimeMs: processingTime,
        apiCalls: 1,
        errorCount: 1
      });

      throw new Error(`Coqui TTS generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async trackUsage(usage: UsageMetrics): Promise<void> {
    this.usageTracker = {
      charactersProcessed: this.usageTracker.charactersProcessed + usage.charactersProcessed,
      processingTimeMs: this.usageTracker.processingTimeMs + usage.processingTimeMs,
      apiCalls: this.usageTracker.apiCalls + usage.apiCalls,
      errorCount: this.usageTracker.errorCount + usage.errorCount
    };
  }

  // Public methods for monitoring and configuration
  getUsageMetrics(): UsageMetrics {
    return { ...this.usageTracker };
  }

  updateConfig(newConfig: Partial<TTSRouterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Coqui TTS specific methods
  async loadModel(modelPath: string, configPath?: string, speakerWav?: string): Promise<void> {
    try {
      await this.coquiTTSService.loadModel(modelPath, configPath, speakerWav);
      this.modelCache.set(modelPath, true);
      console.log(`Coqui TTS model loaded successfully: ${modelPath}`);
    } catch (error) {
      this.modelCache.set(modelPath, false);
      throw new Error(`Failed to load Coqui TTS model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async unloadModel(): Promise<void> {
    await this.coquiTTSService.unloadModel();
    this.modelCache.clear();
  }

  // Get available Bangla voice configurations for Coqui TTS
  getBanglaVoiceConfigs(): LocalVoiceConfig[] {
    return [
      {
        languageCode: 'bn',
        voiceName: 'coqui-bangla-female-v1',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
        modelPath: './models/coqui-bangla-female',
        customSettings: {
          temperature: 0.7,
          length_penalty: 1.0,
          repetition_penalty: 1.1
        }
      },
      {
        languageCode: 'bn',
        voiceName: 'coqui-bangla-male-v1',
        gender: 'MALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
        modelPath: './models/coqui-bangla-male',
        customSettings: {
          temperature: 0.8,
          length_penalty: 1.0,
          repetition_penalty: 1.1
        }
      },
      {
        languageCode: 'bn',
        voiceName: 'coqui-bangla-finetuned',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
        modelPath: './models/coqui-bangla-finetuned',
        customSettings: {
          temperature: 0.6,
          length_penalty: 0.9,
          repetition_penalty: 1.05,
          // Fine-tuning specific settings
          use_griffin_lim: false,
          do_trim_silence: true,
          reference_wav: './reference_audio/bangla_speaker.wav'
        }
      }
    ];
  }

  // Fine-tuning specific methods
  async startFineTuning(datasetPath: string, outputModelPath: string, epochs: number = 100): Promise<void> {
    console.log(`Starting Coqui TTS fine-tuning with dataset: ${datasetPath}`);
    // This would integrate with the Python fine-tuning script
    // For now, we'll create a placeholder implementation
    throw new Error('Fine-tuning implementation requires Python integration - see utils/coqui_tts_bridge.py');
  }

  async validateFineTunedModel(modelPath: string, testTexts: string[]): Promise<ValidationResults> {
    const results: ValidationResults = {
      modelPath,
      testResults: [],
      averageQuality: 0,
      averageProcessingTime: 0
    };

    for (const text of testTexts) {
      const startTime = Date.now();
      try {
        const voiceConfig = this.createCoquiVoiceConfig(modelPath);
        await this.coquiTTSService.synthesizeSpeech(text, voiceConfig);
        
        const processingTime = Date.now() - startTime;
        results.testResults.push({
          text,
          success: true,
          processingTime,
          qualityScore: 0.85 // Placeholder - would use actual quality metrics
        });
      } catch (error) {
        results.testResults.push({
          text,
          success: false,
          processingTime: Date.now() - startTime,
          qualityScore: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    results.averageProcessingTime = results.testResults.reduce((sum, r) => sum + r.processingTime, 0) / results.testResults.length;
    results.averageQuality = results.testResults.reduce((sum, r) => sum + r.qualityScore, 0) / results.testResults.length;

    return results;
  }

  private async ensureModelLoaded(modelPath: string): Promise<void> {
    const isLoaded = this.modelCache.get(modelPath);
    if (!isLoaded) {
      await this.loadModel(modelPath);
    }
  }

  private createCoquiVoiceConfig(modelPath?: string): LocalVoiceConfig {
    return {
      languageCode: 'bn',
      voiceName: 'coqui-bangla-female',
      gender: 'FEMALE',
      speakingRate: 1.0,
      pitch: 0.0,
      volumeGainDb: 0.0,
      modelPath: modelPath || './models/coqui-bangla',
      customSettings: {
        temperature: 0.7,
        length_penalty: 1.0,
        repetition_penalty: 1.1
      }
    };
  }
}

export interface ValidationResults {
  modelPath: string;
  testResults: TestResult[];
  averageQuality: number;
  averageProcessingTime: number;
}

export interface TestResult {
  text: string;
  success: boolean;
  processingTime: number;
  qualityScore: number;
  error?: string;
}
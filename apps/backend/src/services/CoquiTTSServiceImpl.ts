import { promises as fs } from 'fs';
import path from 'path';
import { LocalVoiceConfig } from '../models';
import { ModelInfo, UsageMetrics } from '../types/common';
import { CoquiTTSService, CoquiTTSServiceConfig, CoquiModelConfig } from './CoquiTTSService';
import { PythonBridge, PythonBridgeConfig } from '../utils/pythonBridge';
import { TTSError } from '../types/errors';
import { DefaultErrorHandler } from '../utils/errorHandler';

export class CoquiTTSServiceImpl implements CoquiTTSService {
  private pythonBridge: PythonBridge;
  private config: CoquiTTSServiceConfig;
  private currentModel: CoquiModelConfig | null = null;
  private modelCache: Map<string, ModelInfo> = new Map();
  private usageMetrics: UsageMetrics = {
    charactersProcessed: 0,
    processingTimeMs: 0,
    apiCalls: 0,
    errorCount: 0,
  };
  private errorHandler: DefaultErrorHandler;
  private isInitialized = false;

  constructor(config: CoquiTTSServiceConfig) {
    this.config = config;
    this.errorHandler = new DefaultErrorHandler();
    
    // Use mock bridge for development/testing if TTS library is not available
    const useMockBridge = process.env['NODE_ENV'] === 'development' || process.env['COQUI_USE_MOCK'] === 'true';
    const scriptName = useMockBridge ? 'coqui_tts_bridge_mock.py' : 'coqui_tts_bridge.py';
    
    const bridgeConfig: PythonBridgeConfig = {
      pythonPath: config.pythonPath,
      scriptPath: path.join(__dirname, '../utils', scriptName),
      timeoutMs: config.synthesisTimeoutMs,
      maxRetries: 3,
    };
    
    this.pythonBridge = new PythonBridge(bridgeConfig);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.pythonBridge.initialize();
      
      // Load default Bangla model if specified
      if (this.config.banglaModelPath) {
        await this.loadModel(this.config.banglaModelPath);
      }
      
      this.isInitialized = true;
    } catch (error) {
      const ttsError = new TTSError(
        `Failed to initialize Coqui TTS service: ${(error as Error).message}`,
        'coqui_local',
        error as Error
      );
      await this.errorHandler.handleTTSError(ttsError);
      throw ttsError;
    }
  }

  async loadModel(modelPath: string): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Check if model is already loaded
      if (this.currentModel && this.currentModel.modelPath === modelPath) {
        return;
      }

      // Validate model path
      if (!modelPath.startsWith('tts_models/')) {
        // Local model file - check if it exists
        try {
          await fs.access(modelPath);
        } catch {
          throw new TTSError(`Model file not found: ${modelPath}`, 'coqui_local');
        }
      }

      // Load model via Python bridge
      const result = await this.pythonBridge.sendRequest('load_model', {
        model_path: modelPath,
        use_gpu: true, // Try GPU first, fallback to CPU handled in Python
      });

      if (!result.success) {
        throw new TTSError(result.error || 'Failed to load model', 'coqui_local');
      }

      // Update current model info
      this.currentModel = {
        modelPath,
        language: 'bn',
        useGpu: result.model_info?.use_gpu || false,
      };

      // Cache model info
      const modelInfo: ModelInfo = {
        name: result.model_info?.name || path.basename(modelPath),
        version: '1.0.0',
        language: result.model_info?.language || 'bn',
        size: 0, // Size would need to be calculated separately
        loadedAt: new Date(),
      };

      this.modelCache.set(modelPath, modelInfo);
      
      const loadTime = Date.now() - startTime;
      console.log(`Coqui TTS model loaded in ${loadTime}ms: ${modelPath}`);
      
    } catch (error) {
      const ttsError = error instanceof TTSError ? error : new TTSError(
        `Failed to load Coqui TTS model: ${(error as Error).message}`,
        'coqui_local',
        error as Error
      );
      await this.errorHandler.handleTTSError(ttsError);
      throw ttsError;
    }
  }

  async synthesizeSpeech(text: string, voiceConfig: LocalVoiceConfig): Promise<Buffer> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isModelLoaded()) {
        // Load default model if none is loaded
        const modelPath = voiceConfig.modelPath || this.config.banglaModelPath || this.config.defaultModelPath;
        await this.loadModel(modelPath);
      }

      const startTime = Date.now();
      this.usageMetrics.apiCalls++;

      // Prepare synthesis parameters
      const params = {
        text: text.trim(),
        language: voiceConfig.languageCode.split('-')[0], // Extract language code (e.g., 'bn' from 'bn-IN')
        speed: voiceConfig.speakingRate,
        speaker_wav: voiceConfig.customSettings?.['speakerWav'],
      };

      // Send synthesis request to Python bridge
      const result = await this.pythonBridge.sendRequest('synthesize_speech', params);

      if (!result.success) {
        this.usageMetrics.errorCount++;
        throw new TTSError(result.error || 'Speech synthesis failed', 'coqui_local');
      }

      // Decode base64 audio data
      const audioData = result.result?.audio_data || result.audio_data;
      if (!audioData) {
        throw new TTSError('No audio data received from synthesis', 'coqui_local');
      }
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.usageMetrics.processingTimeMs += processingTime;
      this.usageMetrics.charactersProcessed += text.length;

      console.log(`Coqui TTS synthesized ${text.length} characters in ${processingTime}ms`);
      
      return audioBuffer;

    } catch (error) {
      this.usageMetrics.errorCount++;
      const ttsError = error instanceof TTSError ? error : new TTSError(
        `Coqui TTS synthesis failed: ${(error as Error).message}`,
        'coqui_local',
        error as Error
      );
      await this.errorHandler.handleTTSError(ttsError);
      throw ttsError;
    }
  }

  async getModelInfo(): Promise<ModelInfo> {
    try {
      if (!this.isModelLoaded()) {
        throw new TTSError('No model is currently loaded', 'coqui_local');
      }

      const result = await this.pythonBridge.sendRequest('get_model_info', {});
      
      if (!result.success) {
        throw new TTSError(result.error || 'Failed to get model info', 'coqui_local');
      }

      const modelInfo = result.model_info;
      return {
        name: modelInfo.name || 'Unknown',
        version: '1.0.0',
        language: modelInfo.language || 'bn',
        size: 0,
        loadedAt: new Date(modelInfo.loaded_at || Date.now()),
      };

    } catch (error) {
      const ttsError = error instanceof TTSError ? error : new TTSError(
        `Failed to get model info: ${(error as Error).message}`,
        'coqui_local',
        error as Error
      );
      await this.errorHandler.handleTTSError(ttsError);
      throw ttsError;
    }
  }

  isModelLoaded(): boolean {
    return this.currentModel !== null && this.pythonBridge.isReady();
  }

  async unloadModel(): Promise<void> {
    try {
      if (!this.isModelLoaded()) {
        return;
      }

      const result = await this.pythonBridge.sendRequest('unload_model', {});
      
      if (!result.success) {
        throw new TTSError(result.error || 'Failed to unload model', 'coqui_local');
      }

      this.currentModel = null;
      console.log('Coqui TTS model unloaded successfully');

    } catch (error) {
      const ttsError = error instanceof TTSError ? error : new TTSError(
        `Failed to unload model: ${(error as Error).message}`,
        'coqui_local',
        error as Error
      );
      await this.errorHandler.handleTTSError(ttsError);
      throw ttsError;
    }
  }

  // Get Bangla voice configurations optimized for dubbing
  getBanglaVoiceConfigs(): LocalVoiceConfig[] {
    return [
      {
        languageCode: 'bn-IN',
        voiceName: 'coqui-bangla-female',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
        modelPath: this.config.banglaModelPath,
        customSettings: {
          useGpu: true,
          quality: 'high',
        },
      },
      {
        languageCode: 'bn-IN',
        voiceName: 'coqui-bangla-male',
        gender: 'MALE',
        speakingRate: 1.0,
        pitch: -2.0, // Slightly lower pitch for male voice
        volumeGainDb: 0.0,
        modelPath: this.config.banglaModelPath,
        customSettings: {
          useGpu: true,
          quality: 'high',
        },
      },
    ];
  }

  // Get usage metrics for cost tracking
  getUsageMetrics(): UsageMetrics {
    return { ...this.usageMetrics };
  }

  // Reset usage metrics (useful for monthly resets)
  resetUsageMetrics(): void {
    this.usageMetrics = {
      charactersProcessed: 0,
      processingTimeMs: 0,
      apiCalls: 0,
      errorCount: 0,
    };
  }

  // List available models
  async listAvailableModels(): Promise<string[]> {
    try {
      const result = await this.pythonBridge.sendRequest('list_available_models', {});
      
      if (!result.success) {
        throw new TTSError(result.error || 'Failed to list models', 'coqui_local');
      }

      return result.bangla_models || [];

    } catch (error) {
      const ttsError = error instanceof TTSError ? error : new TTSError(
        `Failed to list available models: ${(error as Error).message}`,
        'coqui_local',
        error as Error
      );
      await this.errorHandler.handleTTSError(ttsError);
      throw ttsError;
    }
  }

  // Cleanup resources
  async shutdown(): Promise<void> {
    try {
      if (this.isModelLoaded()) {
        await this.unloadModel();
      }
      
      await this.pythonBridge.shutdown();
      this.isInitialized = false;
      
      console.log('Coqui TTS service shut down successfully');
    } catch (error) {
      console.error('Error during Coqui TTS service shutdown:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pythonBridge.isReady()) {
        return false;
      }

      // Try a simple model info request
      const result = await this.pythonBridge.sendRequest('get_model_info', {});
      return result.success || result.error?.includes('No model loaded');
    } catch {
      return false;
    }
  }
}
import { CoquiTTSServiceImpl } from '../services/CoquiTTSServiceImpl';
import { CoquiTTSConfig } from '../services/CoquiTTSService';
import { LocalVoiceConfig } from '../models';
import { TTSError } from '../types/errors';
import { PythonBridge } from '../utils/pythonBridge';

// Mock the PythonBridge
jest.mock('../utils/pythonBridge');
const MockPythonBridge = PythonBridge as jest.MockedClass<typeof PythonBridge>;

// Mock the DefaultErrorHandler
jest.mock('../utils/errorHandler', () => ({
  DefaultErrorHandler: jest.fn().mockImplementation(() => ({
    handleTTSError: jest.fn(),
  })),
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
  },
}));

describe('CoquiTTSServiceImpl', () => {
  let service: CoquiTTSServiceImpl;
  let mockPythonBridge: jest.Mocked<PythonBridge>;
  let config: CoquiTTSConfig;

  beforeEach(() => {
    config = {
      pythonPath: 'python3',
      modelCachePath: '/tmp/coqui_models',
      maxConcurrentRequests: 3,
      modelLoadTimeoutMs: 30000,
      synthesisTimeoutMs: 10000,
      defaultModelPath: 'tts_models/multilingual/multi-dataset/xtts_v2',
      banglaModelPath: 'tts_models/bn/custom/bangla-model',
    };

    // Create mock instance
    mockPythonBridge = {
      initialize: jest.fn(),
      sendRequest: jest.fn(),
      shutdown: jest.fn(),
      isReady: jest.fn(),
    } as any;

    MockPythonBridge.mockImplementation(() => mockPythonBridge);

    service = new CoquiTTSServiceImpl(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize Python bridge successfully', async () => {
      mockPythonBridge.initialize.mockResolvedValue(undefined);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: {
          name: 'bangla-model',
          language: 'bn',
          use_gpu: true,
        },
      });

      await service.initialize();

      expect(mockPythonBridge.initialize).toHaveBeenCalled();
      expect(mockPythonBridge.sendRequest).toHaveBeenCalledWith('load_model', {
        model_path: config.banglaModelPath,
        use_gpu: true,
      });
    });

    it('should handle initialization failure', async () => {
      const error = new Error('Python bridge failed');
      mockPythonBridge.initialize.mockRejectedValue(error);

      await expect(service.initialize()).rejects.toThrow(TTSError);
      await expect(service.initialize()).rejects.toThrow('Failed to initialize Coqui TTS service');
    });

    it('should not reinitialize if already initialized', async () => {
      mockPythonBridge.initialize.mockResolvedValue(undefined);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: { name: 'test-model' },
      });

      await service.initialize();
      await service.initialize(); // Second call

      expect(mockPythonBridge.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('model loading', () => {
    beforeEach(async () => {
      mockPythonBridge.initialize.mockResolvedValue(undefined);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: { name: 'test-model' },
      });
      // Don't initialize here to avoid loading default model
      jest.clearAllMocks();
    });

    it('should load model successfully', async () => {
      const modelPath = 'tts_models/bn/custom/bangla-model';
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: {
          name: 'bangla-model',
          language: 'bn',
          use_gpu: true,
        },
      });

      await service.loadModel(modelPath);

      expect(mockPythonBridge.sendRequest).toHaveBeenCalledWith('load_model', {
        model_path: modelPath,
        use_gpu: true,
      });
    });

    it('should handle model loading failure', async () => {
      const modelPath = 'tts_models/invalid/model';
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: false,
        error: 'Model not found',
      });

      await expect(service.loadModel(modelPath)).rejects.toThrow(TTSError);
      await expect(service.loadModel(modelPath)).rejects.toThrow('Model not found');
    });

    it('should not reload the same model', async () => {
      const modelPath = 'tts_models/bn/custom/bangla-model';
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: { name: 'bangla-model' },
      });

      await service.loadModel(modelPath);
      await service.loadModel(modelPath); // Second call with same path

      expect(mockPythonBridge.sendRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('speech synthesis', () => {
    const voiceConfig: LocalVoiceConfig = {
      languageCode: 'bn-IN',
      voiceName: 'coqui-bangla-female',
      gender: 'FEMALE',
      speakingRate: 1.0,
      pitch: 0.0,
      volumeGainDb: 0.0,
      modelPath: 'tts_models/bn/custom/bangla-model',
    };

    beforeEach(async () => {
      mockPythonBridge.initialize.mockResolvedValue(undefined);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: { name: 'test-model' },
      });
      mockPythonBridge.isReady.mockReturnValue(true);
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should synthesize speech successfully', async () => {
      const text = 'আমি বাংলায় কথা বলি';
      const mockAudioData = Buffer.from('mock audio data').toString('base64');
      
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        audio_data: mockAudioData,
        audio_length: 1024,
        text_length: text.length,
      });

      const result = await service.synthesizeSpeech(text, voiceConfig);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('mock audio data');
      expect(mockPythonBridge.sendRequest).toHaveBeenCalledWith('synthesize_speech', {
        text,
        language: 'bn',
        speed: 1.0,
        speaker_wav: undefined,
      });
    });

    it('should handle synthesis failure', async () => {
      const text = 'Test text';
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: false,
        error: 'Synthesis failed',
      });

      await expect(service.synthesizeSpeech(text, voiceConfig)).rejects.toThrow(TTSError);
      await expect(service.synthesizeSpeech(text, voiceConfig)).rejects.toThrow('Synthesis failed');
    });

    it('should load default model if none is loaded', async () => {
      const text = 'Test text';
      service['isInitialized'] = true; // Mark as initialized
      service['currentModel'] = null; // Ensure no model is loaded
      mockPythonBridge.isReady.mockReturnValue(false);
      
      // Mock the sendRequest calls
      mockPythonBridge.sendRequest.mockImplementation((method: string) => {
        if (method === 'load_model') {
          return Promise.resolve({
            success: true,
            model_info: { name: 'default-model' },
          });
        } else if (method === 'synthesize_speech') {
          return Promise.resolve({
            success: true,
            audio_data: Buffer.from('audio').toString('base64'),
            audio_length: 1024,
            text_length: text.length,
          });
        }
        return Promise.resolve({ success: false });
      });

      const result = await service.synthesizeSpeech(text, voiceConfig);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPythonBridge.sendRequest).toHaveBeenCalledWith('load_model', {
        model_path: voiceConfig.modelPath,
        use_gpu: true,
      });
    });

    it('should update usage metrics', async () => {
      const text = 'Test text for metrics';
      service['isInitialized'] = true; // Mark as initialized
      service['currentModel'] = { modelPath: 'test', language: 'bn', useGpu: true }; // Mock loaded model
      mockPythonBridge.isReady.mockReturnValue(true);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        audio_data: Buffer.from('audio').toString('base64'),
      });

      const initialMetrics = service.getUsageMetrics();
      await service.synthesizeSpeech(text, voiceConfig);
      const updatedMetrics = service.getUsageMetrics();

      expect(updatedMetrics.charactersProcessed).toBe(initialMetrics.charactersProcessed + text.length);
      expect(updatedMetrics.apiCalls).toBe(initialMetrics.apiCalls + 1);
      expect(updatedMetrics.processingTimeMs).toBeGreaterThanOrEqual(initialMetrics.processingTimeMs);
    });
  });

  describe('model information', () => {
    beforeEach(async () => {
      mockPythonBridge.initialize.mockResolvedValue(undefined);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: { name: 'test-model' },
      });
      mockPythonBridge.isReady.mockReturnValue(true);
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should get model info successfully', async () => {
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: {
          name: 'bangla-model',
          language: 'bn',
          loaded_at: new Date().toISOString(),
        },
      });

      const modelInfo = await service.getModelInfo();

      expect(modelInfo.name).toBe('bangla-model');
      expect(modelInfo.language).toBe('bn');
      expect(modelInfo.loadedAt).toBeInstanceOf(Date);
    });

    it('should handle get model info failure', async () => {
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: false,
        error: 'No model loaded',
      });

      await expect(service.getModelInfo()).rejects.toThrow(TTSError);
    });

    it('should check if model is loaded', () => {
      mockPythonBridge.isReady.mockReturnValue(false);
      expect(service.isModelLoaded()).toBe(false); // No model loaded initially

      // After loading a model (mocked)
      service['currentModel'] = {
        modelPath: 'test-model',
        language: 'bn',
        useGpu: true,
      };
      mockPythonBridge.isReady.mockReturnValue(true);
      expect(service.isModelLoaded()).toBe(true);
    });
  });

  describe('model unloading', () => {
    beforeEach(async () => {
      mockPythonBridge.initialize.mockResolvedValue(undefined);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: { name: 'test-model' },
      });
      mockPythonBridge.isReady.mockReturnValue(true);
      await service.initialize();
      
      // Load a model
      service['currentModel'] = {
        modelPath: 'test-model',
        language: 'bn',
        useGpu: true,
      };
      jest.clearAllMocks();
    });

    it('should unload model successfully', async () => {
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        message: 'Model unloaded',
      });

      await service.unloadModel();

      expect(mockPythonBridge.sendRequest).toHaveBeenCalledWith('unload_model', {});
      expect(service.isModelLoaded()).toBe(false);
    });

    it('should handle unload failure', async () => {
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: false,
        error: 'Failed to unload',
      });

      await expect(service.unloadModel()).rejects.toThrow(TTSError);
    });

    it('should handle unload when no model is loaded', async () => {
      service['currentModel'] = null;
      mockPythonBridge.isReady.mockReturnValue(false);

      await service.unloadModel(); // Should not throw

      expect(mockPythonBridge.sendRequest).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should get Bangla voice configurations', () => {
      const configs = service.getBanglaVoiceConfigs();

      expect(configs).toHaveLength(2);
      expect(configs[0].gender).toBe('FEMALE');
      expect(configs[1].gender).toBe('MALE');
      expect(configs[0].languageCode).toBe('bn-IN');
      expect(configs[1].languageCode).toBe('bn-IN');
    });

    it('should reset usage metrics', () => {
      // Simulate some usage
      service['usageMetrics'].charactersProcessed = 100;
      service['usageMetrics'].apiCalls = 5;

      service.resetUsageMetrics();

      const metrics = service.getUsageMetrics();
      expect(metrics.charactersProcessed).toBe(0);
      expect(metrics.apiCalls).toBe(0);
      expect(metrics.processingTimeMs).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });

    it('should list available models', async () => {
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        bangla_models: ['model1', 'model2', 'model3'],
      });

      const models = await service.listAvailableModels();

      expect(models).toEqual(['model1', 'model2', 'model3']);
      expect(mockPythonBridge.sendRequest).toHaveBeenCalledWith('list_available_models', {});
    });

    it('should perform health check', async () => {
      mockPythonBridge.isReady.mockReturnValue(true);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
      });

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should fail health check when bridge is not ready', async () => {
      mockPythonBridge.isReady.mockReturnValue(false);

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      mockPythonBridge.initialize.mockResolvedValue(undefined);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
        model_info: { name: 'test-model' },
      });
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should shutdown gracefully', async () => {
      service['currentModel'] = {
        modelPath: 'test-model',
        language: 'bn',
        useGpu: true,
      };
      mockPythonBridge.isReady.mockReturnValue(true);
      mockPythonBridge.sendRequest.mockResolvedValue({
        success: true,
      });

      await service.shutdown();

      expect(mockPythonBridge.sendRequest).toHaveBeenCalledWith('unload_model', {});
      expect(mockPythonBridge.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      mockPythonBridge.shutdown.mockRejectedValue(new Error('Shutdown failed'));

      // Should not throw
      await service.shutdown();

      expect(mockPythonBridge.shutdown).toHaveBeenCalled();
    });
  });
});
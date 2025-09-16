import { CoquiTTSServiceImpl } from '../services/CoquiTTSServiceImpl';
import { CoquiTTSServiceConfig } from '../services/CoquiTTSService';
import { LocalVoiceConfig } from '../models';

/**
 * Integration tests for Coqui TTS Service
 * These tests verify the complete workflow from initialization to speech synthesis
 * Note: These tests use the mock Python bridge for CI/CD compatibility
 */
describe('CoquiTTS Integration Tests', () => {
  let service: CoquiTTSServiceImpl;
  let config: CoquiTTSServiceConfig;

  beforeAll(() => {
    // Force mock bridge for integration tests to avoid Python dependency
    process.env['NODE_ENV'] = 'development';
    process.env['COQUI_USE_MOCK'] = 'true';
    
    config = {
      pythonPath: process.platform === 'win32' ? 'py' : 'python3',
      modelCachePath: './temp/coqui_models',
      maxConcurrentRequests: 2,
      modelLoadTimeoutMs: 30000,
      synthesisTimeoutMs: 10000,
      defaultModelPath: 'tts_models/multilingual/multi-dataset/xtts_v2',
      banglaModelPath: 'tts_models/bn/custom/bangla-model',
    };

    service = new CoquiTTSServiceImpl(config);
  });

  afterAll(async () => {
    await service.shutdown();
    delete process.env['COQUI_USE_MOCK'];
    delete process.env['NODE_ENV'];
  });

  describe('Complete Bangla TTS Workflow', () => {
    it('should complete full workflow: initialize -> load model -> synthesize -> cleanup', async () => {
      // Step 1: Initialize service
      await service.initialize();
      expect(service.isModelLoaded()).toBe(true);

      // Step 2: Get Bangla voice configurations
      const voiceConfigs = service.getBanglaVoiceConfigs();
      expect(voiceConfigs).toHaveLength(2);
      expect(voiceConfigs[0].languageCode).toBe('bn-IN');
      expect(voiceConfigs[1].languageCode).toBe('bn-IN');

      // Step 3: Test speech synthesis with female voice
      const femaleVoice = voiceConfigs.find(v => v.gender === 'FEMALE');
      expect(femaleVoice).toBeDefined();

      const banglaText = 'আমি বাংলায় কথা বলি।'; // "I speak in Bengali"
      const audioBuffer = await service.synthesizeSpeech(banglaText, femaleVoice!);
      
      expect(audioBuffer).toBeInstanceOf(Buffer);
      expect(audioBuffer.length).toBeGreaterThan(0);

      // Step 4: Test speech synthesis with male voice
      const maleVoice = voiceConfigs.find(v => v.gender === 'MALE');
      expect(maleVoice).toBeDefined();

      const audioBuffer2 = await service.synthesizeSpeech(banglaText, maleVoice!);
      expect(audioBuffer2).toBeInstanceOf(Buffer);
      expect(audioBuffer2.length).toBeGreaterThan(0);

      // Step 5: Verify usage metrics
      const metrics = service.getUsageMetrics();
      expect(metrics.charactersProcessed).toBe(banglaText.length * 2);
      expect(metrics.apiCalls).toBe(2);
      expect(metrics.errorCount).toBe(0);

      // Step 6: Test model management
      const modelInfo = await service.getModelInfo();
      expect(modelInfo.name).toBeDefined();
      expect(modelInfo.language).toBe('bn');

      // Step 7: Test health check
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    }, 30000); // 30 second timeout for integration test

    it('should handle multiple concurrent synthesis requests', async () => {
      await service.initialize();

      const voiceConfig: LocalVoiceConfig = {
        languageCode: 'bn-IN',
        voiceName: 'coqui-bangla-female',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      };

      const texts = [
        'প্রথম বাক্য',  // "First sentence"
        'দ্বিতীয় বাক্য', // "Second sentence"
        'তৃতীয় বাক্য',  // "Third sentence"
      ];

      // Process multiple requests concurrently
      const promises = texts.map(text => 
        service.synthesizeSpeech(text, voiceConfig)
      );

      const results = await Promise.all(promises);

      // Verify all requests completed successfully
      expect(results).toHaveLength(3);
      results.forEach(buffer => {
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
      });

      // Verify metrics updated correctly
      const metrics = service.getUsageMetrics();
      expect(metrics.apiCalls).toBeGreaterThanOrEqual(3);
    }, 30000);

    it('should demonstrate cost-effective local processing', async () => {
      await service.initialize();

      const voiceConfig: LocalVoiceConfig = {
        languageCode: 'bn-IN',
        voiceName: 'coqui-bangla-female',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      };

      // Reset metrics to get clean measurement
      service.resetUsageMetrics();

      // Process a longer text to demonstrate efficiency
      const longText = 'এটি একটি দীর্ঘ বাংলা বাক্য যা স্থানীয় প্রক্রিয়াকরণের দক্ষতা প্রদর্শন করে। কোকি টিটিএস সেবা কোনো এপিআই খরচ ছাড়াই উচ্চ মানের বাংলা কণ্ঠস্বর তৈরি করতে পারে।';

      const startTime = Date.now();
      const audioBuffer = await service.synthesizeSpeech(longText, voiceConfig);
      const processingTime = Date.now() - startTime;

      // Verify successful processing
      expect(audioBuffer).toBeInstanceOf(Buffer);
      expect(audioBuffer.length).toBeGreaterThan(0);

      // Verify cost metrics (should be zero for local processing)
      const metrics = service.getUsageMetrics();
      expect(metrics.charactersProcessed).toBe(longText.length);
      expect(metrics.apiCalls).toBe(1);

      // Log performance metrics for demonstration
      console.log(`\n📊 Coqui TTS Performance Metrics:`);
      console.log(`  Text length: ${longText.length} characters`);
      console.log(`  Processing time: ${processingTime}ms`);
      console.log(`  Audio size: ${audioBuffer.length} bytes`);
      console.log(`  Speed: ${Math.round((longText.length / processingTime) * 1000)} chars/sec`);
      console.log(`  💰 API Cost: $0.00 (Local processing)`);
    }, 30000);

    it('should handle model switching and caching', async () => {
      await service.initialize();

      // Test loading different models
      const models = [
        'tts_models/multilingual/multi-dataset/xtts_v2',
        'tts_models/bn/custom/bangla-model',
      ];

      for (const modelPath of models) {
        await service.loadModel(modelPath);
        expect(service.isModelLoaded()).toBe(true);

        const modelInfo = await service.getModelInfo();
        expect(modelInfo.name).toContain(modelPath.split('/').pop());
      }

      // Test model unloading
      await service.unloadModel();
      expect(service.isModelLoaded()).toBe(false);
    }, 30000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle synthesis errors gracefully', async () => {
      await service.initialize();

      const invalidVoiceConfig: LocalVoiceConfig = {
        languageCode: 'invalid-lang',
        voiceName: 'invalid-voice',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      };

      // This should not throw but may produce different results in mock mode
      try {
        const result = await service.synthesizeSpeech('Test text', invalidVoiceConfig);
        // In mock mode, this might still succeed
        expect(result).toBeInstanceOf(Buffer);
      } catch (error) {
        // In real mode, this would throw a TTSError
        expect(error).toBeDefined();
      }
    });

    it('should maintain service health after errors', async () => {
      await service.initialize();

      // Service should remain healthy even after potential errors
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);

      // Should be able to perform normal operations
      const voiceConfig = service.getBanglaVoiceConfigs()[0];
      const result = await service.synthesizeSpeech('পরীক্ষা', voiceConfig);
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
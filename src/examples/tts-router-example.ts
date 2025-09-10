import { TTSRouterImpl } from '../services/TTSRouterImpl';
import { TTSRouterConfig } from '../services/TTSRouter';
import { GoogleTTSService } from '../services/GoogleTTSService';
import { CoquiTTSService } from '../services/CoquiTTSService';
import { TTSServiceType } from '../types/common';

// Mock implementations for demonstration
class MockGoogleTTSService implements GoogleTTSService {
  async synthesizeSpeech(text: string, voiceConfig: any): Promise<Buffer> {
    console.log(`Google TTS: Synthesizing "${text}" with voice ${voiceConfig.voiceName}`);
    return Buffer.from(`google-tts-audio-${text}`);
  }

  async checkQuotaUsage() {
    return {
      used: 1000,
      limit: 4000000,
      remaining: 3999000,
      resetDate: new Date()
    };
  }

  async listAvailableVoices(languageCode: string) {
    return [
      {
        name: 'bn-IN-Wavenet-A',
        languageCode: 'bn-IN',
        gender: 'FEMALE' as const,
        naturalSampleRateHertz: 24000
      }
    ];
  }
}

class MockCoquiTTSService implements CoquiTTSService {
  private modelLoaded = false;

  async loadModel(modelPath: string): Promise<void> {
    console.log(`Coqui TTS: Loading model from ${modelPath}`);
    this.modelLoaded = true;
  }

  async synthesizeSpeech(text: string, voiceConfig: any): Promise<Buffer> {
    console.log(`Coqui TTS: Synthesizing "${text}" with local model`);
    return Buffer.from(`coqui-tts-audio-${text}`);
  }

  async getModelInfo() {
    return {
      name: 'coqui-bangla-model',
      version: '1.0.0',
      language: 'bn',
      size: 500000000,
      loadedAt: new Date(),
    };
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  async unloadModel(): Promise<void> {
    console.log('Coqui TTS: Unloading model');
    this.modelLoaded = false;
  }
}

async function demonstrateTTSRouter() {
  console.log('=== TTS Router A/B Testing Demo ===\n');

  // Create mock services
  const googleTTS = new MockGoogleTTSService();
  const coquiTTS = new MockCoquiTTSService();

  // Configure TTS Router with A/B testing
  const config: TTSRouterConfig = {
    abTestingEnabled: true,
    googleTTSWeight: 60, // 60% Google TTS
    coquiTTSWeight: 40,  // 40% Coqui TTS
    quotaThresholds: {
      googleTTS: 1000
    },
    fallbackEnabled: true
  };

  const ttsRouter = new TTSRouterImpl(googleTTS, coquiTTS, config);

  // Simulate multiple requests to see A/B testing in action
  const testTexts = [
    'Hello, how are you today?',
    'This is a test of the TTS system.',
    'Welcome to our automated dubbing service.',
    'Thank you for using our platform.',
    'Have a great day!'
  ];

  console.log('1. Testing A/B Service Selection:');
  for (let i = 0; i < testTexts.length; i++) {
    const request = {
      text: testTexts[i],
      targetLanguage: 'bn',
      sessionId: `session-${i + 1}`
    };

    const selectedService = await ttsRouter.selectTTSService(request);
    console.log(`Session ${i + 1}: Selected ${selectedService}`);
  }

  console.log('\n2. Testing Speech Generation:');
  for (let i = 0; i < 3; i++) {
    const service = i % 2 === 0 ? TTSServiceType.GOOGLE_CLOUD : TTSServiceType.COQUI_LOCAL;
    try {
      const audioSegment = await ttsRouter.generateSpeech(testTexts[i], service);
      console.log(`Generated audio segment: ${audioSegment.id} (${audioSegment.text.length} chars)`);
    } catch (error) {
      console.error(`Failed to generate speech: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n3. Usage Metrics:');
  const googleMetrics = ttsRouter.getUsageMetrics(TTSServiceType.GOOGLE_CLOUD);
  const coquiMetrics = ttsRouter.getUsageMetrics(TTSServiceType.COQUI_LOCAL);

  console.log('Google TTS Metrics:', googleMetrics);
  console.log('Coqui TTS Metrics:', coquiMetrics);

  console.log('\n4. A/B Testing Results:');
  const abResults = ttsRouter.getABTestingResults();
  console.log('A/B Testing Results:', abResults);

  console.log('\n5. Testing Quota Fallback:');
  // Simulate quota exceeded scenario
  const quotaExceededConfig: TTSRouterConfig = {
    ...config,
    quotaThresholds: {
      googleTTS: 5000000 // Set threshold higher than available quota
    }
  };

  ttsRouter.updateConfig(quotaExceededConfig);

  const fallbackRequest = {
    text: 'This should fallback to Coqui TTS',
    targetLanguage: 'bn',
    sessionId: 'fallback-session'
  };

  const fallbackService = await ttsRouter.selectTTSService(fallbackRequest);
  console.log(`Fallback test: Selected ${fallbackService} (should be coqui_local)`);

  console.log('\n=== Demo Complete ===');
}

// Run the demonstration
if (require.main === module) {
  demonstrateTTSRouter().catch(console.error);
}

export { demonstrateTTSRouter };
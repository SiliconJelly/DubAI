import { CoquiTTSServiceImpl } from '../services/CoquiTTSServiceImpl';
import { CoquiTTSServiceConfig } from '../services/CoquiTTSService';
import { LocalVoiceConfig } from '../models';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Example usage of Coqui TTS Service for Bangla voice synthesis
 * This demonstrates local TTS processing with zero API costs
 */

async function runCoquiTTSExample() {
  console.log('🎤 Coqui TTS Service Example - Bangla Voice Synthesis');
  console.log('=' .repeat(60));

  // Configuration for Coqui TTS
  const config: CoquiTTSServiceConfig = {
    pythonPath: process.platform === 'win32' ? 'py' : 'python3', // Use 'py' on Windows, 'python3' on Unix
    modelCachePath: './temp/coqui_models',
    maxConcurrentRequests: 2,
    modelLoadTimeoutMs: 60000, // 1 minute for model loading
    synthesisTimeoutMs: 30000,  // 30 seconds for synthesis
    defaultModelPath: 'tts_models/multilingual/multi-dataset/xtts_v2',
    banglaModelPath: 'tts_models/multilingual/multi-dataset/xtts_v2', // Using multilingual model for Bangla
  };

  // Create service instance
  const coquiTTS = new CoquiTTSServiceImpl(config);

  try {
    // Initialize the service
    console.log('\n📋 Initializing Coqui TTS service...');
    await coquiTTS.initialize();
    console.log('✅ Service initialized successfully');

    // Check health
    const isHealthy = await coquiTTS.healthCheck();
    console.log(`🏥 Health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);

    // List available models
    console.log('\n📚 Listing available Bangla models...');
    try {
      const models = await coquiTTS.listAvailableModels();
      console.log(`Found ${models.length} Bangla models:`, models.slice(0, 3));
    } catch (error) {
      console.log('⚠️  Could not list models:', (error as Error).message);
    }

    // Get model information
    if (coquiTTS.isModelLoaded()) {
      console.log('\n📊 Current model information:');
      const modelInfo = await coquiTTS.getModelInfo();
      console.log(`  Name: ${modelInfo.name}`);
      console.log(`  Language: ${modelInfo.language}`);
      console.log(`  Loaded at: ${modelInfo.loadedAt?.toISOString()}`);
    }

    // Test voice configurations
    console.log('\n🎭 Available Bangla voice configurations:');
    const voiceConfigs = coquiTTS.getBanglaVoiceConfigs();
    voiceConfigs.forEach((config, index) => {
      console.log(`  ${index + 1}. ${config.voiceName} (${config.gender})`);
      console.log(`     Language: ${config.languageCode}`);
      console.log(`     Speaking Rate: ${config.speakingRate}`);
    });

    // Test text samples for synthesis
    const testTexts = [
      'আমি বাংলায় কথা বলি।', // "I speak in Bengali"
      'এটি একটি পরীক্ষা।',    // "This is a test"
      'স্বাগতম!',            // "Welcome!"
    ];

    // Synthesize speech with different voice configurations
    for (let i = 0; i < Math.min(voiceConfigs.length, 2); i++) {
      const voiceConfig = voiceConfigs[i];
      console.log(`\n🎵 Testing ${voiceConfig.voiceName} voice...`);

      for (let j = 0; j < Math.min(testTexts.length, 2); j++) {
        const text = testTexts[j];
        console.log(`  Synthesizing: "${text}"`);

        try {
          const startTime = Date.now();
          const audioBuffer = await coquiTTS.synthesizeSpeech(text, voiceConfig);
          const duration = Date.now() - startTime;

          console.log(`  ✅ Generated ${audioBuffer.length} bytes in ${duration}ms`);

          // Save audio file for testing
          const filename = `coqui_output_${i}_${j}.wav`;
          const outputPath = path.join('./temp', filename);
          
          // Ensure temp directory exists
          await fs.mkdir('./temp', { recursive: true });
          await fs.writeFile(outputPath, audioBuffer);
          console.log(`  💾 Saved to: ${outputPath}`);

        } catch (error) {
          console.log(`  ❌ Synthesis failed: ${(error as Error).message}`);
        }
      }
    }

    // Display usage metrics
    console.log('\n📈 Usage Metrics:');
    const metrics = coquiTTS.getUsageMetrics();
    console.log(`  Characters processed: ${metrics.charactersProcessed}`);
    console.log(`  API calls: ${metrics.apiCalls}`);
    console.log(`  Total processing time: ${metrics.processingTimeMs}ms`);
    console.log(`  Error count: ${metrics.errorCount}`);
    console.log(`  💰 Cost: $0.00 (Local processing - no API costs!)`);

    // Test model management
    console.log('\n🔄 Testing model management...');
    
    // Load a specific model (if different from current)
    try {
      console.log('  Loading specific model...');
      await coquiTTS.loadModel('tts_models/multilingual/multi-dataset/xtts_v2');
      console.log('  ✅ Model loaded successfully');
    } catch (error) {
      console.log(`  ⚠️  Model loading: ${(error as Error).message}`);
    }

    // Test unloading
    console.log('  Unloading model...');
    await coquiTTS.unloadModel();
    console.log('  ✅ Model unloaded');
    console.log(`  Model loaded status: ${coquiTTS.isModelLoaded()}`);

    // Performance comparison note
    console.log('\n⚡ Performance Notes:');
    console.log('  • First synthesis may be slower due to model loading');
    console.log('  • Subsequent syntheses are faster with cached model');
    console.log('  • GPU acceleration improves performance significantly');
    console.log('  • Local processing eliminates network latency');

    console.log('\n🎯 Coqui TTS Example completed successfully!');

  } catch (error) {
    console.error('\n❌ Example failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await coquiTTS.shutdown();
    console.log('✅ Cleanup completed');
  }
}

// Performance benchmarking function
async function benchmarkCoquiTTS() {
  console.log('\n🏃‍♂️ Performance Benchmark');
  console.log('=' .repeat(40));

  const config: CoquiTTSServiceConfig = {
    pythonPath: 'python3',
    modelCachePath: './temp/coqui_models',
    maxConcurrentRequests: 1,
    modelLoadTimeoutMs: 60000,
    synthesisTimeoutMs: 30000,
    defaultModelPath: 'tts_models/multilingual/multi-dataset/xtts_v2',
    banglaModelPath: 'tts_models/multilingual/multi-dataset/xtts_v2',
  };

  const coquiTTS = new CoquiTTSServiceImpl(config);

  try {
    await coquiTTS.initialize();
    
    const voiceConfig: LocalVoiceConfig = {
      languageCode: 'bn-IN',
      voiceName: 'coqui-bangla-female',
      gender: 'FEMALE',
      speakingRate: 1.0,
      pitch: 0.0,
      volumeGainDb: 0.0,
    };

    // Test different text lengths
    const testCases = [
      { name: 'Short', text: 'হ্যালো' }, // "Hello"
      { name: 'Medium', text: 'আমি বাংলায় কথা বলি এবং এটি একটি পরীক্ষা।' },
      { name: 'Long', text: 'এটি একটি দীর্ঘ বাক্য যা বিভিন্ন শব্দ এবং বাক্যাংশ রয়েছে। আমরা এই পরীক্ষার মাধ্যমে দেখব যে সিস্টেম কতটা ভাল কাজ করে।' },
    ];

    console.log('Text Length | Processing Time | Audio Size | Speed (chars/sec)');
    console.log('-'.repeat(65));

    for (const testCase of testCases) {
      const startTime = Date.now();
      const audioBuffer = await coquiTTS.synthesizeSpeech(testCase.text, voiceConfig);
      const duration = Date.now() - startTime;
      const speed = Math.round((testCase.text.length / duration) * 1000);

      console.log(`${testCase.name.padEnd(11)} | ${duration.toString().padStart(13)}ms | ${audioBuffer.length.toString().padStart(9)} B | ${speed.toString().padStart(13)}`);
    }

  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    await coquiTTS.shutdown();
  }
}

// Run the example
if (require.main === module) {
  runCoquiTTSExample()
    .then(() => {
      console.log('\n🎉 All examples completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Example execution failed:', error);
      process.exit(1);
    });
}

export { runCoquiTTSExample, benchmarkCoquiTTS };
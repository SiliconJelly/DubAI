import { GoogleTTSServiceImpl } from '../services/GoogleTTSServiceImpl';
import { GoogleTTSConfig } from '../services/GoogleTTSService';
import { VoiceConfigImpl } from '../models/VoiceConfig';
import * as fs from 'fs';
import * as path from 'path';

async function demonstrateGoogleTTS() {
  console.log('🎤 Google Cloud TTS Service Demo');
  console.log('================================');

  // Configuration for Google Cloud TTS
  const config: GoogleTTSConfig = {
    projectId: process.env['GOOGLE_CLOUD_PROJECT_ID'] || 'your-project-id',
    keyFilename: process.env['GOOGLE_CLOUD_KEY_FILE'] || 'path/to/service-account-key.json',
    quotaLimit: 4000000, // 4M characters per month (free tier)
    rateLimitPerMinute: 60,
    retryAttempts: 3,
  };

  try {
    // Initialize the service
    const ttsService = new GoogleTTSServiceImpl(config);
    console.log('✅ Google TTS Service initialized');

    // Check quota status
    console.log('\n📊 Checking quota status...');
    const quotaStatus = await ttsService.checkQuotaUsage();
    console.log(`Used: ${quotaStatus.used} characters`);
    console.log(`Remaining: ${quotaStatus.remaining} characters`);
    console.log(`Limit: ${quotaStatus.limit} characters`);
    console.log(`Resets on: ${quotaStatus.resetDate.toDateString()}`);

    // List available Bangla voices
    console.log('\n🎵 Available Bangla voices:');
    try {
      const voices = await ttsService.listAvailableVoices('bn-IN');
      voices.forEach((voice, index) => {
        console.log(`${index + 1}. ${voice.name} (${voice.gender}) - ${voice.naturalSampleRateHertz}Hz`);
      });
    } catch (error) {
      console.log('⚠️  Could not fetch voices (API key may not be configured)');
    }

    // Get predefined Bangla voice configurations
    console.log('\n🔧 Predefined Bangla voice configurations:');
    const banglaConfigs = ttsService.getBanglaVoiceConfigs();
    banglaConfigs.forEach((config, index) => {
      console.log(`${index + 1}. ${config.voiceName} (${config.gender})`);
    });

    // Demonstrate speech synthesis with different voice configurations
    const testTexts = [
      'আমি একটি স্বয়ংক্রিয় ডাবিং সিস্টেম।', // "I am an automated dubbing system."
      'এই প্রযুক্তি ভিডিও কন্টেন্ট অনুবাদ করে।', // "This technology translates video content."
      'বাংলা ভাষায় উচ্চ মানের কণ্ঠস্বর তৈরি করি।', // "I create high-quality voices in Bengali."
    ];

    for (let i = 0; i < Math.min(2, banglaConfigs.length); i++) {
      const voiceConfig = banglaConfigs[i];
      const testText = testTexts[i] || testTexts[0];

      console.log(`\n🎙️  Testing voice: ${voiceConfig.voiceName} (${voiceConfig.gender})`);
      console.log(`Text: "${testText}"`);

      try {
        const startTime = Date.now();
        
        // Note: This will only work with valid Google Cloud credentials
        // For demo purposes, we'll simulate the call
        console.log('⏳ Synthesizing speech...');
        
        // Uncomment the following lines when you have valid credentials:
        // const audioBuffer = await ttsService.synthesizeSpeech(testText, voiceConfig);
        // const outputPath = path.join(__dirname, '../../temp', `tts-output-${i + 1}.mp3`);
        // fs.writeFileSync(outputPath, audioBuffer);
        // console.log(`✅ Audio saved to: ${outputPath}`);
        
        const endTime = Date.now();
        console.log(`⏱️  Processing time: ${endTime - startTime}ms`);
        console.log(`📝 Characters processed: ${testText.length}`);
        
        // Simulate successful synthesis for demo
        console.log('✅ Speech synthesis completed (simulated)');
        
      } catch (error) {
        console.error(`❌ Error synthesizing speech: ${error}`);
      }
    }

    // Display usage metrics
    console.log('\n📈 Usage Metrics:');
    const metrics = ttsService.getUsageMetrics();
    console.log(`Characters processed: ${metrics.charactersProcessed}`);
    console.log(`API calls made: ${metrics.apiCalls}`);
    console.log(`Processing time: ${metrics.processingTimeMs}ms`);
    console.log(`Error count: ${metrics.errorCount}`);

    // Demonstrate voice configuration customization
    console.log('\n🎛️  Custom voice configuration example:');
    const customVoiceConfig = new VoiceConfigImpl(
      'bn-IN',
      'bn-IN-Wavenet-A',
      'FEMALE',
      1.2,  // Slightly faster speaking rate
      2.0,  // Higher pitch
      1.0   // Slightly louder
    );

    console.log('Custom configuration:');
    console.log(`- Language: ${customVoiceConfig.languageCode}`);
    console.log(`- Voice: ${customVoiceConfig.voiceName}`);
    console.log(`- Gender: ${customVoiceConfig.gender}`);
    console.log(`- Speaking Rate: ${customVoiceConfig.speakingRate}x`);
    console.log(`- Pitch: ${customVoiceConfig.pitch} semitones`);
    console.log(`- Volume Gain: ${customVoiceConfig.volumeGainDb} dB`);
    console.log(`- Valid: ${customVoiceConfig.validate()}`);

    console.log('\n🎉 Google TTS Service demo completed!');
    console.log('\n💡 Tips for production use:');
    console.log('1. Set up proper Google Cloud credentials');
    console.log('2. Monitor quota usage to avoid exceeding limits');
    console.log('3. Implement proper error handling and retries');
    console.log('4. Use rate limiting to respect API limits');
    console.log('5. Cache frequently used audio segments');
    console.log('6. Consider using Coqui TTS as a fallback for cost optimization');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateGoogleTTS().catch(console.error);
}

export { demonstrateGoogleTTS };
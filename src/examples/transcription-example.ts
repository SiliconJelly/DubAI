/**
 * Example usage of TranscriptionServiceImpl
 * This demonstrates how to use the Whisper-based transcription service
 */

import { TranscriptionServiceImpl } from '../services/TranscriptionServiceImpl';
import { TranscriptionConfig } from '../services/TranscriptionService';
import { AudioFileImpl } from '../models';
import { WHISPER_CONFIG } from '../utils/constants';

async function transcriptionExample() {
  // Configure the transcription service
  const config: TranscriptionConfig = {
    whisperModelPath: '/usr/local/bin/whisper', // Path to Whisper installation
    modelSize: 'base', // Start with base model for balance of speed/accuracy
    language: 'en', // Source language
    temperature: WHISPER_CONFIG.DEFAULT_TEMPERATURE,
    maxRetries: WHISPER_CONFIG.MAX_RETRIES
  };

  // Initialize the service with temp directory
  const transcriptionService = new TranscriptionServiceImpl(config, './temp');

  // Create an audio file object
  const audioFile = new AudioFileImpl(
    'example-audio-id',
    'sample-audio.wav',
    './uploads/sample-audio.wav',
    'wav',
    120.5, // duration in seconds
    44100, // sample rate
    2      // channels (stereo)
  );

  try {
    console.log('Starting transcription...');
    
    // Step 1: Transcribe the audio
    const transcriptionResult = await transcriptionService.transcribeAudio(audioFile);
    console.log('Transcription completed:', {
      language: transcriptionResult.language,
      confidence: transcriptionResult.confidence,
      segmentCount: transcriptionResult.segments.length
    });

    // Step 2: Translate to target language (Bangla)
    const translationResult = await transcriptionService.translateToTarget(
      transcriptionResult, 
      'bn'
    );
    console.log('Translation completed:', {
      targetLanguage: translationResult.targetLanguage,
      segmentCount: translationResult.segments.length
    });

    // Step 3: Generate SRT file
    const srtFile = await transcriptionService.generateSRT(translationResult);
    console.log('SRT generation completed:', {
      totalDuration: srtFile.totalDuration,
      segmentCount: srtFile.segments.length
    });

    // Display first few segments
    console.log('\nFirst 3 segments:');
    transcriptionResult.segments.slice(0, 3).forEach((segment, index) => {
      console.log(`${index + 1}. [${segment.startTime}s - ${segment.endTime}s]: ${segment.text}`);
    });

    // Display SRT content preview
    console.log('\nSRT Preview:');
    console.log(srtFile.content.split('\n').slice(0, 10).join('\n'));

  } catch (error) {
    console.error('Transcription failed:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  transcriptionExample().catch(console.error);
}

export { transcriptionExample };
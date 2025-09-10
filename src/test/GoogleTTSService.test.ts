import { GoogleTTSServiceImpl } from '../services/GoogleTTSServiceImpl';
import { GoogleTTSConfig } from '../services/GoogleTTSService';
import { VoiceConfigImpl } from '../models/VoiceConfig';
import { TTSError, QuotaExceededError } from '../types/errors';

// Mock the Google Cloud TTS client
jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    synthesizeSpeech: jest.fn(),
    listVoices: jest.fn(),
  })),
}));

// Mock the error handler
jest.mock('../utils/errorHandler', () => ({
  DefaultErrorHandler: jest.fn().mockImplementation(() => ({
    handleTTSError: jest.fn(),
  })),
}));

describe('GoogleTTSServiceImpl', () => {
  let service: GoogleTTSServiceImpl;
  let mockClient: any;
  let config: GoogleTTSConfig;

  beforeEach(() => {
    config = {
      projectId: 'test-project',
      keyFilename: 'test-key.json',
      quotaLimit: 4000000, // 4M characters
      rateLimitPerMinute: 60,
      retryAttempts: 3,
    };

    // Reset the mock
    const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
    mockClient = {
      synthesizeSpeech: jest.fn(),
      listVoices: jest.fn(),
    };
    TextToSpeechClient.mockImplementation(() => mockClient);

    service = new GoogleTTSServiceImpl(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('synthesizeSpeech', () => {
    it('should successfully synthesize speech with valid input', async () => {
      const mockAudioContent = new Uint8Array([1, 2, 3, 4]);
      mockClient.synthesizeSpeech.mockResolvedValue([{ audioContent: mockAudioContent }]);

      const voiceConfig = new VoiceConfigImpl(
        'bn-IN',
        'bn-IN-Wavenet-A',
        'FEMALE',
        1.0,
        0.0,
        0.0
      );

      const result = await service.synthesizeSpeech('Hello world', voiceConfig);

      expect(result).toBeInstanceOf(Buffer);
      expect(result).toEqual(Buffer.from(mockAudioContent));
      expect(mockClient.synthesizeSpeech).toHaveBeenCalledWith({
        input: { text: 'Hello world' },
        voice: {
          languageCode: 'bn-IN',
          name: 'bn-IN-Wavenet-A',
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0.0,
          volumeGainDb: 0.0,
          effectsProfileId: ['telephony-class-application'],
        },
      });
    });

    it('should throw TTSError when no audio content is received', async () => {
      mockClient.synthesizeSpeech.mockResolvedValue([{}]);

      const voiceConfig = new VoiceConfigImpl('bn-IN', 'bn-IN-Wavenet-A', 'FEMALE');

      await expect(service.synthesizeSpeech('Hello', voiceConfig))
        .rejects.toThrow(TTSError);
    });

    it('should throw QuotaExceededError when quota is insufficient', async () => {
      // Set up service with very low quota
      const lowQuotaConfig = { ...config, quotaLimit: 5 };
      service = new GoogleTTSServiceImpl(lowQuotaConfig);

      const voiceConfig = new VoiceConfigImpl('bn-IN', 'bn-IN-Wavenet-A', 'FEMALE');
      const longText = 'This is a very long text that exceeds the quota limit';

      await expect(service.synthesizeSpeech(longText, voiceConfig))
        .rejects.toThrow(QuotaExceededError);
    });

    it('should retry on retryable errors', async () => {
      mockClient.synthesizeSpeech
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue([{ audioContent: new Uint8Array([1, 2, 3]) }]);

      const voiceConfig = new VoiceConfigImpl('bn-IN', 'bn-IN-Wavenet-A', 'FEMALE');

      const result = await service.synthesizeSpeech('Hello', voiceConfig);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      mockClient.synthesizeSpeech.mockRejectedValue(new Error('Invalid argument'));

      const voiceConfig = new VoiceConfigImpl('bn-IN', 'bn-IN-Wavenet-A', 'FEMALE');

      await expect(service.synthesizeSpeech('Hello', voiceConfig))
        .rejects.toThrow(TTSError);
      expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(1);
    });

    it('should apply rate limiting', async () => {
      const fastConfig = { ...config, rateLimitPerMinute: 120 }; // 2 requests per second
      service = new GoogleTTSServiceImpl(fastConfig);

      mockClient.synthesizeSpeech.mockResolvedValue([{ audioContent: new Uint8Array([1, 2, 3]) }]);

      const voiceConfig = new VoiceConfigImpl('bn-IN', 'bn-IN-Wavenet-A', 'FEMALE');

      const startTime = Date.now();
      
      // Make two rapid requests
      await service.synthesizeSpeech('Hello 1', voiceConfig);
      await service.synthesizeSpeech('Hello 2', voiceConfig);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should take at least 500ms for 2 requests at 120 per minute (500ms interval)
      expect(elapsed).toBeGreaterThan(400); // Allow some tolerance
    });
  });

  describe('checkQuotaUsage', () => {
    it('should return correct quota status', async () => {
      const quotaStatus = await service.checkQuotaUsage();

      expect(quotaStatus).toEqual({
        used: 0,
        limit: config.quotaLimit,
        remaining: config.quotaLimit,
        resetDate: expect.any(Date),
      });
    });

    it('should update quota usage after synthesis', async () => {
      mockClient.synthesizeSpeech.mockResolvedValue([{ audioContent: new Uint8Array([1, 2, 3]) }]);

      const voiceConfig = new VoiceConfigImpl('bn-IN', 'bn-IN-Wavenet-A', 'FEMALE');
      const text = 'Hello world';

      await service.synthesizeSpeech(text, voiceConfig);

      const quotaStatus = await service.checkQuotaUsage();
      expect(quotaStatus.used).toBe(text.length);
      expect(quotaStatus.remaining).toBe(config.quotaLimit - text.length);
    });

    it('should reset quota on new month', async () => {
      // This test verifies the quota reset logic conceptually
      // In a real scenario, quota would reset monthly
      const quotaStatus = await service.checkQuotaUsage();
      
      // Verify the reset date is set to next month
      const now = new Date();
      const expectedResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      expect(quotaStatus.resetDate.getMonth()).toBe(expectedResetDate.getMonth());
      expect(quotaStatus.resetDate.getFullYear()).toBe(expectedResetDate.getFullYear());
    });
  });

  describe('listAvailableVoices', () => {
    it('should return available voices for language code', async () => {
      const mockVoices = [
        {
          name: 'bn-IN-Wavenet-A',
          languageCodes: ['bn-IN'],
          ssmlGender: 'FEMALE',
          naturalSampleRateHertz: 22050,
        },
        {
          name: 'bn-IN-Wavenet-B',
          languageCodes: ['bn-IN'],
          ssmlGender: 'MALE',
          naturalSampleRateHertz: 22050,
        },
        {
          name: 'en-US-Wavenet-A',
          languageCodes: ['en-US'],
          ssmlGender: 'FEMALE',
          naturalSampleRateHertz: 22050,
        },
      ];

      mockClient.listVoices.mockResolvedValue([{ voices: mockVoices }]);

      const voices = await service.listAvailableVoices('bn-IN');

      expect(voices).toHaveLength(2);
      expect(voices[0]).toEqual({
        name: 'bn-IN-Wavenet-A',
        languageCode: 'bn-IN',
        gender: 'FEMALE',
        naturalSampleRateHertz: 22050,
      });
      expect(voices[1]).toEqual({
        name: 'bn-IN-Wavenet-B',
        languageCode: 'bn-IN',
        gender: 'MALE',
        naturalSampleRateHertz: 22050,
      });
    });

    it('should return empty array when no voices available', async () => {
      mockClient.listVoices.mockResolvedValue([{}]);

      const voices = await service.listAvailableVoices('bn-IN');

      expect(voices).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.listVoices.mockRejectedValue(new Error('API Error'));

      await expect(service.listAvailableVoices('bn-IN'))
        .rejects.toThrow('API Error');
    });
  });

  describe('getBanglaVoiceConfigs', () => {
    it('should return predefined Bangla voice configurations', () => {
      const configs = service.getBanglaVoiceConfigs();

      expect(configs).toHaveLength(4);
      expect(configs[0]).toEqual({
        languageCode: 'bn-IN',
        voiceName: 'bn-IN-Wavenet-A',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      });
      expect(configs[1]).toEqual({
        languageCode: 'bn-IN',
        voiceName: 'bn-IN-Wavenet-B',
        gender: 'MALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      });
    });
  });

  describe('getUsageMetrics', () => {
    it('should return usage metrics', async () => {
      mockClient.synthesizeSpeech.mockResolvedValue([{ audioContent: new Uint8Array([1, 2, 3]) }]);

      const voiceConfig = new VoiceConfigImpl('bn-IN', 'bn-IN-Wavenet-A', 'FEMALE');
      await service.synthesizeSpeech('Hello world', voiceConfig);

      const metrics = service.getUsageMetrics();

      expect(metrics.charactersProcessed).toBe(11); // "Hello world" length
      expect(metrics.apiCalls).toBe(1);
      expect(metrics.processingTimeMs).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle synthesis errors properly', async () => {
      const error = new Error('Synthesis failed');
      mockClient.synthesizeSpeech.mockRejectedValue(error);

      const voiceConfig = new VoiceConfigImpl('bn-IN', 'bn-IN-Wavenet-A', 'FEMALE');

      await expect(service.synthesizeSpeech('Hello', voiceConfig))
        .rejects.toThrow(TTSError);
    });

    it('should handle voice listing errors properly', async () => {
      const error = new Error('Voice listing failed');
      mockClient.listVoices.mockRejectedValue(error);

      await expect(service.listAvailableVoices('bn-IN'))
        .rejects.toThrow(TTSError);
    });
  });
});
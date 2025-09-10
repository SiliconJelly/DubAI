import { TranscriptionServiceImpl } from '../services/TranscriptionServiceImpl';
import { TranscriptionConfig } from '../services/TranscriptionService';
import { AudioFileImpl, TranscriptionResultImpl, TranslationResultImpl } from '../models';
import { TranscriptionError } from '../types/errors';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    writeFile: jest.fn()
  }
}));
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockUnlink = fs.unlink as jest.MockedFunction<typeof fs.unlink>;
const mockMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
const mockAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockStat = fs.stat as jest.MockedFunction<typeof fs.stat>;
const mockReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;

describe('TranscriptionServiceImpl', () => {
  let service: TranscriptionServiceImpl;
  let config: TranscriptionConfig;
  let mockAudioFile: AudioFileImpl;

  beforeEach(() => {
    config = {
      whisperModelPath: '/path/to/whisper',
      modelSize: 'base',
      language: 'en',
      temperature: 0.0,
      maxRetries: 3
    };
    
    service = new TranscriptionServiceImpl(config, './test-temp');
    
    mockAudioFile = new AudioFileImpl(
      'test-audio-id',
      'test-audio.wav',
      '/path/to/test-audio.wav',
      'wav',
      120.5,
      44100,
      2
    );

    jest.clearAllMocks();
    
    // Setup FileManager mocks
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({ mtime: new Date() } as any);
    mockReaddir.mockResolvedValue([]);
    mockWriteFile.mockResolvedValue(undefined);
  });

  describe('transcribeAudio', () => {
    it('should successfully transcribe audio with Whisper', async () => {
      const mockWhisperOutput = {
        language: 'en',
        segments: [
          {
            text: 'Hello world',
            start: 0.0,
            end: 2.5,
            confidence: 0.95
          },
          {
            text: 'This is a test',
            start: 2.5,
            end: 5.0,
            confidence: 0.92
          }
        ]
      };

      // Mock successful Whisper process
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);
      mockReadFile.mockResolvedValue(JSON.stringify(mockWhisperOutput));
      mockUnlink.mockResolvedValue(undefined);

      // Simulate successful process completion
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await service.transcribeAudio(mockAudioFile);

      expect(result).toBeInstanceOf(TranscriptionResultImpl);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].text).toBe('Hello world');
      expect(result.segments[0].startTime).toBe(0.0);
      expect(result.segments[0].endTime).toBe(2.5);
      expect(result.language).toBe('en');
      expect(mockSpawn).toHaveBeenCalledWith('python', expect.arrayContaining([
        '-m', 'whisper',
        mockAudioFile.path,
        '--model', 'base',
        '--language', 'en'
      ]), expect.any(Object));
    }); 
   it('should retry with smaller model on failure', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      let callCount = 0;
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callCount++;
          if (callCount === 1) {
            // First call fails
            setTimeout(() => callback(1), 10);
          } else {
            // Second call succeeds
            setTimeout(() => callback(0), 10);
          }
        }
      });

      const mockWhisperOutput = {
        language: 'en',
        segments: [{ text: 'Success', start: 0, end: 1, confidence: 0.9 }]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(mockWhisperOutput));
      mockUnlink.mockResolvedValue(undefined);

      const result = await service.transcribeAudio(mockAudioFile);

      expect(result.segments[0].text).toBe('Success');
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      // First call with 'base' model, second with 'tiny'
      expect(mockSpawn).toHaveBeenNthCalledWith(1, 'python', 
        expect.arrayContaining(['--model', 'base']), expect.any(Object));
      expect(mockSpawn).toHaveBeenNthCalledWith(2, 'python', 
        expect.arrayContaining(['--model', 'tiny']), expect.any(Object));
    });

    it('should throw TranscriptionError after max retries', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      // Mock stderr data
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback('Whisper error message');
        }
      });

      // Always fail
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10);
        }
      });

      await expect(service.transcribeAudio(mockAudioFile))
        .rejects.toThrow(TranscriptionError);
      
      expect(mockSpawn).toHaveBeenCalledTimes(3); // maxRetries
    });

    it('should handle Whisper process spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        };

        // Simulate spawn error
        mockProcess.on.mockImplementation((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Failed to spawn process')), 10);
          }
        });

        return mockProcess as any;
      });

      await expect(service.transcribeAudio(mockAudioFile))
        .rejects.toThrow(TranscriptionError);
    });  });

 
  describe('translateToTarget', () => {
    it('should translate transcription using Whisper translation feature', async () => {
      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [
          { text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.9 },
          { text: 'How are you?', startTime: 2, endTime: 4, confidence: 0.85 }
        ],
        'en',
        0.875
      );

      const mockWhisperTranslationOutput = {
        language: 'en',
        segments: [
          {
            text: 'নমস্কার বিশ্ব',
            original_text: 'Hello world',
            start: 0.0,
            end: 2.0,
            confidence: 0.88
          },
          {
            text: 'আপনি কেমন আছেন?',
            original_text: 'How are you?',
            start: 2.0,
            end: 4.0,
            confidence: 0.82
          }
        ]
      };

      // Mock successful Whisper translation process
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);
      mockReadFile.mockResolvedValue(JSON.stringify(mockWhisperTranslationOutput));
      mockUnlink.mockResolvedValue(undefined);

      // Simulate successful process completion
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await service.translateToTarget(mockTranscription, 'bn');

      expect(result).toBeInstanceOf(TranslationResultImpl);
      expect(result.targetLanguage).toBe('bn');
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].originalText).toBe('Hello world');
      expect(result.segments[0].translatedText).toBe('নমস্কার বিশ্ব');
      expect(result.segments[0].startTime).toBe(0);
      expect(result.segments[0].endTime).toBe(2);
      expect(result.segments[0].confidence).toBe(0.88);
      
      expect(mockSpawn).toHaveBeenCalledWith('python', expect.arrayContaining([
        '-m', 'whisper',
        '--task', 'translate',
        '--model', 'base',
        '--language', 'en'
      ]), expect.any(Object));
    });

    it('should throw error for unsupported target language', async () => {
      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [{ text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.9 }],
        'en',
        0.9
      );

      await expect(service.translateToTarget(mockTranscription, 'fr'))
        .rejects.toThrow('Unsupported target language: fr');
    });

    it('should retry with smaller model on translation failure', async () => {
      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [{ text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.9 }],
        'en',
        0.9
      );

      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      let callCount = 0;
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callCount++;
          if (callCount === 1) {
            // First call fails
            setTimeout(() => callback(1), 10);
          } else {
            // Second call succeeds
            setTimeout(() => callback(0), 10);
          }
        }
      });

      const mockWhisperOutput = {
        language: 'en',
        segments: [{ 
          text: 'নমস্কার বিশ্ব', 
          original_text: 'Hello world',
          start: 0, 
          end: 2, 
          confidence: 0.85 
        }]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(mockWhisperOutput));
      mockUnlink.mockResolvedValue(undefined);

      const result = await service.translateToTarget(mockTranscription, 'bn');

      expect(result.segments[0].translatedText).toBe('নমস্কার বিশ্ব');
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      // First call with 'base' model, second with 'tiny'
      expect(mockSpawn).toHaveBeenNthCalledWith(1, 'python', 
        expect.arrayContaining(['--model', 'base', '--task', 'translate']), expect.any(Object));
      expect(mockSpawn).toHaveBeenNthCalledWith(2, 'python', 
        expect.arrayContaining(['--model', 'tiny', '--task', 'translate']), expect.any(Object));
    });

    it('should handle empty transcription', async () => {
      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [],
        'en',
        0
      );

      const mockWhisperOutput = {
        language: 'en',
        segments: []
      };

      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);
      mockReadFile.mockResolvedValue(JSON.stringify(mockWhisperOutput));
      mockUnlink.mockResolvedValue(undefined);

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await service.translateToTarget(mockTranscription, 'bn');

      expect(result.segments).toHaveLength(0);
      expect(result.originalText).toBe('');
      expect(result.translatedText).toBe('');
    });

    it('should validate Bangla translation quality', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      const mockTranscription = new TranscriptionResultImpl(
        'test-id',
        [{ text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.9 }],
        'en',
        0.9
      );

      const mockWhisperOutput = {
        language: 'en',
        segments: [{
          text: 'Hello বিশ্ব', // Mixed English-Bangla (should trigger warning)
          original_text: 'Hello world',
          start: 0,
          end: 2,
          confidence: 0.5 // Low confidence (should trigger warning)
        }]
      };

      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);
      mockReadFile.mockResolvedValue(JSON.stringify(mockWhisperOutput));
      mockUnlink.mockResolvedValue(undefined);

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      await service.translateToTarget(mockTranscription, 'bn');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential translation quality issue detected')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Low confidence translation detected')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('consider tuning Coqui TTS')
      );

      consoleSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });
  });

  describe('translateWithTimestampPreservation', () => {
    it('should preserve original timestamps when translating', async () => {
      const mockAudioFile = new AudioFileImpl(
        'audio-id',
        'test.wav',
        '/path/to/test.wav',
        'wav',
        120,
        44100,
        2
      );

      const mockTranscription = new TranscriptionResultImpl(
        'transcription-id',
        [
          { text: 'Hello world', startTime: 0.5, endTime: 2.3, confidence: 0.9 },
          { text: 'How are you?', startTime: 2.8, endTime: 4.1, confidence: 0.85 }
        ],
        'en',
        0.875
      );

      const mockWhisperTranslationOutput = {
        language: 'en',
        segments: [
          {
            text: 'নমস্কার বিশ্ব',
            original_text: 'Hello world',
            start: 0.4, // Slightly different timing
            end: 2.4,
            confidence: 0.88
          },
          {
            text: 'আপনি কেমন আছেন?',
            original_text: 'How are you?',
            start: 2.7,
            end: 4.2,
            confidence: 0.82
          }
        ]
      };

      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);
      mockReadFile.mockResolvedValue(JSON.stringify(mockWhisperTranslationOutput));
      mockUnlink.mockResolvedValue(undefined);

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await service.translateWithTimestampPreservation(mockAudioFile, mockTranscription, 'bn');

      expect(result.segments).toHaveLength(2);
      // Should preserve original timestamps, not the translation timestamps
      expect(result.segments[0].startTime).toBe(0.5);
      expect(result.segments[0].endTime).toBe(2.3);
      expect(result.segments[1].startTime).toBe(2.8);
      expect(result.segments[1].endTime).toBe(4.1);
      
      // Should have translated text
      expect(result.segments[0].translatedText).toBe('নমস্কার বিশ্ব');
      expect(result.segments[1].translatedText).toBe('আপনি কেমন আছেন?');
    });

    it('should fallback to regular translation on failure', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockAudioFile = new AudioFileImpl(
        'audio-id',
        'test.wav',
        '/path/to/test.wav',
        'wav',
        120,
        44100,
        2
      );

      const mockTranscription = new TranscriptionResultImpl(
        'transcription-id',
        [{ text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.9 }],
        'en',
        0.9
      );

      // Mock first call (direct translation) to fail completely
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        };

        if (callCount <= 3) {
          // First 3 calls fail (direct translation with retries)
          mockProcess.on.mockImplementation((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 10);
            }
          });
        } else {
          // Subsequent calls succeed (fallback)
          mockProcess.on.mockImplementation((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          });
        }

        return mockProcess as any;
      });

      const mockWhisperOutput = {
        language: 'en',
        segments: [{
          text: 'নমস্কার বিশ্ব',
          original_text: 'Hello world',
          start: 0,
          end: 2,
          confidence: 0.85
        }]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(mockWhisperOutput));
      mockUnlink.mockResolvedValue(undefined);

      const result = await service.translateWithTimestampPreservation(mockAudioFile, mockTranscription, 'bn');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Direct translation failed, falling back'),
        expect.any(Error)
      );
      expect(result.segments[0].translatedText).toBe('নমস্কার বিশ্ব');

      consoleSpy.mockRestore();
    });
  });

  describe('generateSRT', () => {
    it('should generate SRT file from translation result', async () => {
      const mockTranslation = new TranslationResultImpl(
        'test-id',
        'Hello world How are you?',
        'নমস্কার বিশ্ব আপনি কেমন আছেন?',
        [
          {
            originalText: 'Hello world',
            translatedText: 'নমস্কার বিশ্ব',
            startTime: 0,
            endTime: 2.5,
            confidence: 0.9
          },
          {
            originalText: 'How are you?',
            translatedText: 'আপনি কেমন আছেন?',
            startTime: 2.5,
            endTime: 5.0,
            confidence: 0.85
          }
        ],
        'bn'
      );

      const result = await service.generateSRT(mockTranslation);

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].index).toBe(1);
      expect(result.segments[0].startTime).toBe('00:00:00,000');
      expect(result.segments[0].endTime).toBe('00:00:02,500');
      expect(result.segments[0].text).toBe('নমস্কার বিশ্ব');
      
      expect(result.segments[1].index).toBe(2);
      expect(result.segments[1].startTime).toBe('00:00:02,500');
      expect(result.segments[1].endTime).toBe('00:00:05,000');
      expect(result.segments[1].text).toBe('আপনি কেমন আছেন?');

      expect(result.totalDuration).toBe(5.0);
      expect(result.content).toContain('1\n00:00:00,000 --> 00:00:02,500\nনমস্কার বিশ্ব');
    });

    it('should handle empty translation', async () => {
      const mockTranslation = new TranslationResultImpl(
        'test-id',
        '',
        '',
        [],
        'bn'
      );

      const result = await service.generateSRT(mockTranslation);

      expect(result.segments).toHaveLength(0);
      expect(result.totalDuration).toBe(0);
      expect(result.content).toBe('');
    });
  });
});
import { AudioAssemblyServiceImpl } from '../services/AudioAssemblyServiceImpl';
import { AudioAssemblyService, AudioTrack, Timestamp, AudioAssemblyConfig } from '../services/AudioAssemblyService';
import { AudioSegment } from '../models/AudioSegment';
import { VoiceConfig } from '../models/VoiceConfig';
import { FFmpegWrapper } from '../utils/ffmpeg';
import { FileManager } from '../utils/fileManager';
import { AssemblyError } from '../types/errors';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../utils/ffmpeg');
jest.mock('../utils/fileManager');
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined)
}));

describe('AudioAssemblyServiceImpl', () => {
  let audioAssemblyService: AudioAssemblyService;
  let mockFFmpeg: jest.Mocked<FFmpegWrapper>;
  let mockFileManager: jest.Mocked<FileManager>;
  let mockConfig: AudioAssemblyConfig;


  const mockVoiceConfig: VoiceConfig = {
    languageCode: 'bn-BD',
    voiceName: 'bn-BD-Standard-A',
    gender: 'FEMALE',
    speakingRate: 1.0,
    pitch: 0.0,
    volumeGainDb: 0.0
  };

  beforeEach(() => {
    mockFFmpeg = {
      combineAudioSegments: jest.fn(),
      normalizeAudio: jest.fn(),
      getAudioInfo: jest.fn(),
      addSilencePadding: jest.fn(),
      extractAudio: jest.fn(),
      getVideoInfo: jest.fn(),
      combineVideoAudio: jest.fn(),
      runCustomFFmpegCommand: jest.fn()
    } as any;

    mockFileManager = {
      createTempFile: jest.fn(),
      deleteFile: jest.fn(),
      ensureDirectoryExists: jest.fn(),
      getFileSize: jest.fn(),
      moveFile: jest.fn()
    } as any;



    mockConfig = {
      outputFormat: 'wav',
      sampleRate: 44100,
      channels: 2,
      normalizationEnabled: true,
      silencePaddingMs: 100
    };

    audioAssemblyService = new AudioAssemblyServiceImpl(
      mockFFmpeg,
      mockFileManager,
      mockConfig
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assembleAudioTrack', () => {
    const createMockSegment = (id: string, text: string, startTime: number, endTime: number): AudioSegment => ({
      id,
      text,
      audioBuffer: Buffer.from(`mock-audio-${id}`),
      startTime,
      endTime,
      voiceConfig: mockVoiceConfig
    });

    it('should successfully assemble audio track from segments', async () => {
      // Arrange
      const segments: AudioSegment[] = [
        createMockSegment('1', 'Hello', 0, 2),
        createMockSegment('2', 'World', 3, 5)
      ];

      mockFileManager.createTempFile.mockResolvedValue('/tmp/segment.wav');
      mockFFmpeg.combineAudioSegments.mockResolvedValue();
      mockFileManager.deleteFile.mockResolvedValue();

      // Act
      const result = await audioAssemblyService.assembleAudioTrack(segments);

      // Assert
      expect(result).toBeDefined();
      expect(result.segments).toHaveLength(2);
      expect(result.totalDuration).toBe(5);
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
      expect(result.format).toBe('wav');
      expect(mockFFmpeg.combineAudioSegments).toHaveBeenCalled();
    });

    it('should sort segments by start time', async () => {
      // Arrange
      const segments: AudioSegment[] = [
        createMockSegment('2', 'World', 3, 5),
        createMockSegment('1', 'Hello', 0, 2)
      ];

      mockFileManager.createTempFile.mockResolvedValue('/tmp/segment.wav');
      mockFFmpeg.combineAudioSegments.mockResolvedValue();
      mockFileManager.deleteFile.mockResolvedValue();

      // Act
      const result = await audioAssemblyService.assembleAudioTrack(segments);

      // Assert
      expect(result.segments[0].id).toBe('1');
      expect(result.segments[1].id).toBe('2');
    });

    it('should throw AssemblyError when no segments provided', async () => {
      // Act & Assert
      await expect(audioAssemblyService.assembleAudioTrack([])).rejects.toThrow(AssemblyError);
      await expect(audioAssemblyService.assembleAudioTrack([])).rejects.toThrow('No audio segments provided for assembly');
    });

    it('should throw AssemblyError when segments have invalid timing', async () => {
      // Arrange
      const invalidSegments: AudioSegment[] = [
        createMockSegment('1', 'Invalid', 5, 2) // end time before start time
      ];

      // Act & Assert
      await expect(audioAssemblyService.assembleAudioTrack(invalidSegments)).rejects.toThrow(AssemblyError);
    });

    it('should throw AssemblyError when segments overlap', async () => {
      // Arrange
      const overlappingSegments: AudioSegment[] = [
        createMockSegment('1', 'First', 0, 3),
        createMockSegment('2', 'Second', 2, 5) // overlaps with first segment
      ];

      // Act & Assert
      await expect(audioAssemblyService.assembleAudioTrack(overlappingSegments)).rejects.toThrow(AssemblyError);
    });

    it('should clean up temporary files even if assembly fails', async () => {
      // Arrange
      const segments: AudioSegment[] = [
        createMockSegment('1', 'Hello', 0, 2)
      ];

      mockFileManager.createTempFile.mockResolvedValue('/tmp/segment.wav');
      mockFFmpeg.combineAudioSegments.mockRejectedValue(new Error('FFmpeg failed'));
      mockFileManager.deleteFile.mockResolvedValue();

      // Act & Assert
      await expect(audioAssemblyService.assembleAudioTrack(segments)).rejects.toThrow(AssemblyError);
      expect(mockFileManager.deleteFile).toHaveBeenCalledWith('/tmp/segment.wav');
    });
  });

  describe('synchronizeWithTimestamps', () => {
    const createMockAudioTrack = (): AudioTrack => ({
      id: 'track-1',
      segments: [
        {
          id: 'segment-1',
          text: 'Hello',
          audioBuffer: Buffer.from('mock-audio-1'),
          startTime: 0,
          endTime: 2,
          voiceConfig: mockVoiceConfig
        },
        {
          id: 'segment-2',
          text: 'World',
          audioBuffer: Buffer.from('mock-audio-2'),
          startTime: 3,
          endTime: 5,
          voiceConfig: mockVoiceConfig
        }
      ],
      totalDuration: 5,
      sampleRate: 44100,
      channels: 2,
      format: 'wav'
    });

    it('should synchronize audio with new timestamps', async () => {
      // Arrange
      const audioTrack = createMockAudioTrack();
      const newTimestamps: Timestamp[] = [
        { segmentId: 'segment-1', startTime: 1, endTime: 3 },
        { segmentId: 'segment-2', startTime: 4, endTime: 6 }
      ];

      mockFileManager.createTempFile.mockResolvedValue('/tmp/segment.wav');
      mockFFmpeg.combineAudioSegments.mockResolvedValue();
      mockFileManager.deleteFile.mockResolvedValue();

      // Act
      const result = await audioAssemblyService.synchronizeWithTimestamps(audioTrack, newTimestamps);

      // Assert
      expect(result.segments[0].startTime).toBe(1);
      expect(result.segments[0].endTime).toBe(3);
      expect(result.segments[1].startTime).toBe(4);
      expect(result.segments[1].endTime).toBe(6);
    });

    it('should return original audio when no timestamps provided', async () => {
      // Arrange
      const audioTrack = createMockAudioTrack();

      // Act
      const result = await audioAssemblyService.synchronizeWithTimestamps(audioTrack, []);

      // Assert
      expect(result).toBe(audioTrack);
    });

    it('should handle partial timestamp updates', async () => {
      // Arrange
      const audioTrack = createMockAudioTrack();
      const partialTimestamps: Timestamp[] = [
        { segmentId: 'segment-1', startTime: 1, endTime: 3 }
        // segment-2 not updated
      ];

      mockFileManager.createTempFile.mockResolvedValue('/tmp/segment.wav');
      mockFFmpeg.combineAudioSegments.mockResolvedValue();
      mockFileManager.deleteFile.mockResolvedValue();

      // Act
      const result = await audioAssemblyService.synchronizeWithTimestamps(audioTrack, partialTimestamps);

      // Assert
      expect(result.segments[0].startTime).toBe(1);
      expect(result.segments[0].endTime).toBe(3);
      expect(result.segments[1].startTime).toBe(3); // original timing
      expect(result.segments[1].endTime).toBe(5);   // original timing
    });
  });

  describe('normalizeAudio', () => {
    const createMockAudioTrack = (): AudioTrack => ({
      id: 'track-1',
      segments: [],
      totalDuration: 10,
      sampleRate: 44100,
      channels: 2,
      format: 'wav'
    });

    it('should normalize audio when normalization is enabled', async () => {
      // Arrange
      const audioTrack = createMockAudioTrack();
      const normalizedAudioInfo = {
        duration: 10.5,
        sampleRate: 44100,
        channels: 2,
        codec: 'pcm_s16le',
        bitrate: 1411200
      };

      mockFileManager.createTempFile.mockResolvedValue('/tmp/audio.wav');
      mockFFmpeg.normalizeAudio.mockResolvedValue();
      mockFFmpeg.getAudioInfo.mockResolvedValue(normalizedAudioInfo);
      mockFFmpeg.combineAudioSegments.mockResolvedValue();
      mockFileManager.deleteFile.mockResolvedValue();

      // Act
      const result = await audioAssemblyService.normalizeAudio(audioTrack);

      // Assert
      expect(result.totalDuration).toBe(10.5);
      expect(mockFFmpeg.normalizeAudio).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        -16
      );
    });

    it('should return original audio when normalization is disabled', async () => {
      // Arrange
      const disabledConfig = { ...mockConfig, normalizationEnabled: false };
      const serviceWithDisabledNormalization = new AudioAssemblyServiceImpl(
        mockFFmpeg,
        mockFileManager,
        disabledConfig
      );
      const audioTrack = createMockAudioTrack();

      // Act
      const result = await serviceWithDisabledNormalization.normalizeAudio(audioTrack);

      // Assert
      expect(result).toBe(audioTrack);
      expect(mockFFmpeg.normalizeAudio).not.toHaveBeenCalled();
    });

    it('should clean up temporary files after normalization', async () => {
      // Arrange
      const audioTrack = createMockAudioTrack();
      const inputFile = '/tmp/input.wav';
      const outputFile = '/tmp/output.wav';

      mockFileManager.createTempFile
        .mockResolvedValueOnce(inputFile)
        .mockResolvedValueOnce(outputFile);
      mockFFmpeg.normalizeAudio.mockResolvedValue();
      mockFFmpeg.getAudioInfo.mockResolvedValue({
        duration: 10,
        sampleRate: 44100,
        channels: 2,
        codec: 'pcm_s16le',
        bitrate: 1411200
      });
      mockFFmpeg.combineAudioSegments.mockResolvedValue();
      mockFileManager.deleteFile.mockResolvedValue();

      // Act
      await audioAssemblyService.normalizeAudio(audioTrack);

      // Assert
      expect(mockFileManager.deleteFile).toHaveBeenCalledWith(inputFile);
      expect(mockFileManager.deleteFile).toHaveBeenCalledWith(outputFile);
    });

    it('should throw AssemblyError when normalization fails', async () => {
      // Arrange
      const audioTrack = createMockAudioTrack();

      mockFileManager.createTempFile.mockResolvedValue('/tmp/audio.wav');
      mockFFmpeg.normalizeAudio.mockRejectedValue(new Error('Normalization failed'));
      mockFFmpeg.combineAudioSegments.mockResolvedValue();
      mockFileManager.deleteFile.mockResolvedValue();

      // Act & Assert
      await expect(audioAssemblyService.normalizeAudio(audioTrack)).rejects.toThrow(AssemblyError);
    });
  });

  describe('filter complex generation', () => {
    it('should generate correct filter complex for segments with timing', async () => {
      // This tests the private buildFilterComplex method indirectly through assembleAudioTrack
      const segments: AudioSegment[] = [
        {
          id: 'segment-1',
          text: 'Hello',
          audioBuffer: Buffer.from('mock-audio-1'),
          startTime: 1.5, // 1.5 seconds
          endTime: 3.0,
          voiceConfig: mockVoiceConfig
        },
        {
          id: 'segment-2',
          text: 'World',
          audioBuffer: Buffer.from('mock-audio-2'),
          startTime: 4.0,
          endTime: 6.0,
          voiceConfig: mockVoiceConfig
        }
      ];

      mockFileManager.createTempFile.mockResolvedValue('/tmp/segment.wav');
      mockFFmpeg.combineAudioSegments.mockImplementation((files, output, filterComplex) => {
        // Verify that the filter complex includes delay for proper timing
        expect(filterComplex).toContain('adelay=1500|1500'); // 1.5 seconds = 1500ms
        expect(filterComplex).toContain('adelay=4000|4000'); // 4.0 seconds = 4000ms
        expect(filterComplex).toContain('amix=inputs=2:duration=longest');
        return Promise.resolve();
      });
      mockFileManager.deleteFile.mockResolvedValue();

      // Act
      await audioAssemblyService.assembleAudioTrack(segments);

      // Assert
      expect(mockFFmpeg.combineAudioSegments).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle file creation errors gracefully', async () => {
      // Arrange
      const segments: AudioSegment[] = [
        {
          id: 'segment-1',
          text: 'Hello',
          audioBuffer: Buffer.from('mock-audio-1'),
          startTime: 0,
          endTime: 2,
          voiceConfig: mockVoiceConfig
        }
      ];

      mockFileManager.createTempFile.mockRejectedValue(new Error('Disk full'));

      // Act & Assert
      await expect(audioAssemblyService.assembleAudioTrack(segments)).rejects.toThrow(AssemblyError);
    });

    it('should handle FFmpeg errors gracefully', async () => {
      // Arrange
      const segments: AudioSegment[] = [
        {
          id: 'segment-1',
          text: 'Hello',
          audioBuffer: Buffer.from('mock-audio-1'),
          startTime: 0,
          endTime: 2,
          voiceConfig: mockVoiceConfig
        }
      ];

      mockFileManager.createTempFile.mockResolvedValue('/tmp/segment.wav');
      mockFFmpeg.combineAudioSegments.mockRejectedValue(new Error('FFmpeg process failed'));
      mockFileManager.deleteFile.mockResolvedValue();

      // Act & Assert
      await expect(audioAssemblyService.assembleAudioTrack(segments)).rejects.toThrow(AssemblyError);
      expect(mockFileManager.deleteFile).toHaveBeenCalled(); // Cleanup should still happen
    });
  });
});
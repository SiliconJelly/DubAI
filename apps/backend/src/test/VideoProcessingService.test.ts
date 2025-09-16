import { VideoProcessingServiceImpl, VideoProcessingConfig } from '../services/VideoProcessingService';
import { VideoFileImpl, AudioFileImpl } from '../models';
import { FFmpegWrapper, FFmpegConfig } from '../utils/ffmpeg';
import { FileManager, FileManagerConfig } from '../utils/fileManager';
import { VideoProcessingError } from '../types/errors';
import { SUPPORTED_VIDEO_FORMATS, FILE_SIZE_LIMITS } from '../utils/constants';
import * as path from 'path';

// Mock dependencies
jest.mock('../utils/ffmpeg');
jest.mock('../utils/fileManager');

const MockedFFmpegWrapper = FFmpegWrapper as jest.MockedClass<typeof FFmpegWrapper>;
const MockedFileManager = FileManager as jest.MockedClass<typeof FileManager>;

describe('VideoProcessingServiceImpl', () => {
  let service: VideoProcessingServiceImpl;
  let mockFFmpegWrapper: jest.Mocked<FFmpegWrapper>;
  let mockFileManager: jest.Mocked<FileManager>;
  let config: VideoProcessingConfig;

  const mockVideoFile = new VideoFileImpl(
    'test-video-id',
    'test-video.mp4',
    '/tmp/test-video.mp4',
    'mp4',
    120, // 2 minutes
    { width: 1920, height: 1080 },
    {
      title: 'Test Video',
      description: 'Test video for unit tests',
      duration: 120,
      codec: 'h264',
      bitrate: 5000000,
      frameRate: 30
    }
  );

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup configuration
    config = {
      tempDirectory: '/tmp/dubbing',
      supportedFormats: SUPPORTED_VIDEO_FORMATS,
      ffmpegPath: 'ffmpeg',
      maxFileSize: FILE_SIZE_LIMITS.MAX_VIDEO_SIZE,
      retryAttempts: 3,
      retryDelayMs: 1000
    };

    // Create mock instances
    mockFFmpegWrapper = {
      extractAudio: jest.fn(),
      getVideoInfo: jest.fn(),
      getAudioInfo: jest.fn(),
      combineVideoAudio: jest.fn()
    } as any;

    mockFileManager = {
      createTempFile: jest.fn(),
      fileExists: jest.fn(),
      getFileSize: jest.fn(),
      cleanupTempFiles: jest.fn(),
      deleteFile: jest.fn(),
      createOutputFile: jest.fn(),
      saveUploadedFile: jest.fn()
    } as any;

    // Setup mock constructors
    MockedFFmpegWrapper.mockImplementation(() => mockFFmpegWrapper);
    MockedFileManager.mockImplementation(() => mockFileManager);

    // Create service instance
    service = new VideoProcessingServiceImpl(config);
  });

  describe('extractAudio', () => {
    it('should successfully extract audio from valid video file', async () => {
      // Arrange
      const expectedAudioPath = '/tmp/dubbing/audio-123.wav';
      const mockAudioInfo = {
        duration: 120,
        sampleRate: 44100,
        channels: 2,
        codec: 'pcm_s16le',
        bitrate: 1411200
      };

      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024); // 50MB
      mockFileManager.createTempFile.mockResolvedValue(expectedAudioPath);
      mockFFmpegWrapper.getVideoInfo.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      });
      mockFFmpegWrapper.extractAudio.mockResolvedValue(undefined);
      mockFFmpegWrapper.getAudioInfo.mockResolvedValue(mockAudioInfo);

      // Act
      const result = await service.extractAudio(mockVideoFile);

      // Assert
      expect(result).toBeInstanceOf(AudioFileImpl);
      expect(result.filename).toBe('test-video.wav');
      expect(result.path).toBe(expectedAudioPath);
      expect(result.format).toBe('wav');
      expect(result.duration).toBe(120);
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);

      expect(mockFFmpegWrapper.extractAudio).toHaveBeenCalledWith(
        mockVideoFile.path,
        expectedAudioPath
      );
      expect(mockFFmpegWrapper.getAudioInfo).toHaveBeenCalledWith(expectedAudioPath);
    });

    it('should throw error when video file does not exist', async () => {
      // Arrange
      mockFileManager.fileExists.mockResolvedValue(false);

      // Act & Assert
      await expect(service.extractAudio(mockVideoFile)).rejects.toThrow(
        VideoProcessingError
      );
      await expect(service.extractAudio(mockVideoFile)).rejects.toThrow(
        'Invalid video file: Video file does not exist'
      );
    });

    it('should throw error when video file is invalid', async () => {
      // Arrange
      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(FILE_SIZE_LIMITS.MAX_VIDEO_SIZE + 1);

      // Act & Assert
      await expect(service.extractAudio(mockVideoFile)).rejects.toThrow(
        VideoProcessingError
      );
      await expect(service.extractAudio(mockVideoFile)).rejects.toThrow(
        'Invalid video file'
      );
    });

    it('should retry on FFmpeg failures and eventually succeed', async () => {
      // Arrange
      const expectedAudioPath = '/tmp/dubbing/audio-123.wav';
      const mockAudioInfo = {
        duration: 120,
        sampleRate: 44100,
        channels: 2,
        codec: 'pcm_s16le',
        bitrate: 1411200
      };

      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024);
      mockFileManager.createTempFile.mockResolvedValue(expectedAudioPath);
      mockFFmpegWrapper.getVideoInfo.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      });

      // First two calls fail, third succeeds
      mockFFmpegWrapper.extractAudio
        .mockRejectedValueOnce(new Error('FFmpeg error 1'))
        .mockRejectedValueOnce(new Error('FFmpeg error 2'))
        .mockResolvedValueOnce(undefined);

      mockFFmpegWrapper.getAudioInfo.mockResolvedValue(mockAudioInfo);

      // Act
      const result = await service.extractAudio(mockVideoFile);

      // Assert
      expect(result).toBeInstanceOf(AudioFileImpl);
      expect(mockFFmpegWrapper.extractAudio).toHaveBeenCalledTimes(3);
    });

    it('should throw error after maximum retry attempts', async () => {
      // Arrange
      const expectedAudioPath = '/tmp/dubbing/audio-123.wav';

      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024);
      mockFileManager.createTempFile.mockResolvedValue(expectedAudioPath);
      mockFFmpegWrapper.getVideoInfo.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      });

      // All attempts fail for extractAudio
      mockFFmpegWrapper.extractAudio.mockRejectedValue(new Error('Persistent FFmpeg error'));

      // Act
      let thrownError: Error | undefined;
      try {
        await service.extractAudio(mockVideoFile);
      } catch (error) {
        thrownError = error as Error;
      }

      // Assert
      expect(thrownError).toBeInstanceOf(VideoProcessingError);
      expect(thrownError?.message).toContain('Audio extraction failed after 3 attempts');
      expect(mockFFmpegWrapper.extractAudio).toHaveBeenCalledTimes(3);
    });
  });

  describe('validateVideoFormat', () => {
    it('should return valid result for supported video format', async () => {
      // Arrange
      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024);
      mockFFmpegWrapper.getVideoInfo.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      });

      // Act
      const result = await service.validateVideoFormat(mockVideoFile);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return invalid result for non-existent file', async () => {
      // Arrange
      mockFileManager.fileExists.mockResolvedValue(false);

      // Act
      const result = await service.validateVideoFormat(mockVideoFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video file does not exist: /tmp/test-video.mp4');
    });

    it('should return invalid result for oversized file', async () => {
      // Arrange
      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(FILE_SIZE_LIMITS.MAX_VIDEO_SIZE + 1);

      // Act
      const result = await service.validateVideoFormat(mockVideoFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('exceeds maximum allowed size'))).toBe(true);
    });

    it('should return invalid result for unsupported format', async () => {
      // Arrange
      const unsupportedVideoFile = new VideoFileImpl(
        'test-video-id',
        'test-video.xyz', // Unsupported format
        '/tmp/test-video.xyz',
        'xyz',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for unit tests',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024);

      // Act
      const result = await service.validateVideoFormat(unsupportedVideoFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Unsupported video format: xyz'))).toBe(true);
    });

    it('should return warning for video without audio track', async () => {
      // Arrange
      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024);
      mockFFmpegWrapper.getVideoInfo.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: false // No audio track
      });

      // Act
      const result = await service.validateVideoFormat(mockVideoFile);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Video file does not contain an audio track');
    });

    it('should return invalid result for video with invalid duration', async () => {
      // Arrange
      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024);
      mockFFmpegWrapper.getVideoInfo.mockResolvedValue({
        duration: 0, // Invalid duration
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      });

      // Act
      const result = await service.validateVideoFormat(mockVideoFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video file has invalid duration');
    });

    it('should return invalid result when FFmpeg analysis fails', async () => {
      // Arrange
      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024);
      mockFFmpegWrapper.getVideoInfo.mockRejectedValue(new Error('FFmpeg analysis failed'));

      // Act
      const result = await service.validateVideoFormat(mockVideoFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Failed to analyze video file'))).toBe(true);
    });
  });

  describe('cleanupTempFiles', () => {
    it('should successfully cleanup temp files for session', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      mockFileManager.cleanupTempFiles.mockResolvedValue(undefined);

      // Act
      await service.cleanupTempFiles(sessionId);

      // Assert
      expect(mockFileManager.cleanupTempFiles).toHaveBeenCalledWith(sessionId);
    });

    it('should not throw error when cleanup fails', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      mockFileManager.cleanupTempFiles.mockRejectedValue(new Error('Cleanup failed'));

      // Act & Assert - Should not throw
      await expect(service.cleanupTempFiles(sessionId)).resolves.toBeUndefined();
      expect(mockFileManager.cleanupTempFiles).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('retry logic', () => {
    it('should use exponential backoff for retries', async () => {
      // Arrange
      const expectedAudioPath = '/tmp/dubbing/audio-123.wav';
      const startTime = Date.now();

      mockFileManager.fileExists.mockResolvedValue(true);
      mockFileManager.getFileSize.mockResolvedValue(50 * 1024 * 1024);
      mockFileManager.createTempFile.mockResolvedValue(expectedAudioPath);
      mockFFmpegWrapper.getVideoInfo.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      });

      // All attempts fail to test timing
      mockFFmpegWrapper.extractAudio.mockRejectedValue(new Error('Persistent error'));

      // Act
      try {
        await service.extractAudio(mockVideoFile);
      } catch (error) {
        // Expected to fail
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert - Should have waited for retries (1000ms + 2000ms = 3000ms minimum)
      // We allow some tolerance for test execution time
      expect(totalTime).toBeGreaterThan(2500); // At least 2.5 seconds
      expect(mockFFmpegWrapper.extractAudio).toHaveBeenCalledTimes(3);
    });
  });
});
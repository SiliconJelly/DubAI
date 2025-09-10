import { VideoAssemblyServiceImpl, ProgressCallback } from '../services/VideoAssemblyServiceImpl';
import { VideoAssemblyConfig, AudioTrack } from '../services/VideoAssemblyService';
import { VideoFileImpl } from '../models/VideoFile';
import { AudioSegmentImpl } from '../models/AudioSegment';
import { FFmpegWrapper, VideoInfo } from '../utils/ffmpeg';
import { AssemblyError } from '../types/errors';
import { Resolution, VideoMetadata } from '../types/common';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../utils/ffmpeg');

describe('VideoAssemblyServiceImpl', () => {
  let videoAssemblyService: VideoAssemblyServiceImpl;
  let mockFFmpeg: jest.Mocked<FFmpegWrapper>;
  let mockConfig: VideoAssemblyConfig;
  let mockVideoFile: VideoFileImpl;
  let mockAudioTrack: AudioTrack;

  beforeEach(() => {
    // Setup mock FFmpeg
    mockFFmpeg = {
      combineVideoAudio: jest.fn(),
      getVideoInfo: jest.fn(),
      runCustomFFmpegCommand: jest.fn(),
      extractAudio: jest.fn(),
      getAudioInfo: jest.fn(),
      combineAudioSegments: jest.fn(),
      normalizeAudio: jest.fn(),
      addSilencePadding: jest.fn()
    } as any;

    // Setup mock config
    mockConfig = {
      outputFormat: 'mp4',
      preserveOriginalQuality: true,
      hardwareAcceleration: false,
      tempDirectory: '/tmp/test'
    };

    // Setup mock video file
    const mockResolution: Resolution = { width: 1920, height: 1080 };
    const mockMetadata: VideoMetadata = {
      title: 'Test Video',
      description: 'Test Description',
      duration: 120,
      codec: 'h264',
      bitrate: 5000000,
      frameRate: 30
    };

    mockVideoFile = new VideoFileImpl(
      'video-123',
      'test-video.mp4',
      '/path/to/test-video.mp4',
      'mp4',
      120,
      mockResolution,
      mockMetadata
    );

    // Setup mock audio track
    const mockAudioSegment = new AudioSegmentImpl(
      'segment-1',
      'Hello world',
      Buffer.from('mock-audio-data'),
      0,
      5,
      {
        languageCode: 'bn',
        voiceName: 'bn-IN-Standard-A',
        gender: 'FEMALE',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    );

    mockAudioTrack = {
      id: 'track-123',
      segments: [mockAudioSegment],
      totalDuration: 120,
      sampleRate: 44100,
      channels: 2,
      format: 'wav'
    };

    // Create service instance
    videoAssemblyService = new VideoAssemblyServiceImpl(mockFFmpeg, mockConfig);

    // Setup default mock implementations
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('combineVideoAudio', () => {
    it('should successfully combine video and audio', async () => {
      // Setup mocks
      const mockVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.combineVideoAudio.mockResolvedValue(undefined);
      mockFFmpeg.getVideoInfo.mockResolvedValue(mockVideoInfo);

      // Execute
      const result = await videoAssemblyService.combineVideoAudio(mockVideoFile, mockAudioTrack);

      // Verify
      expect(result).toBeDefined();
      expect(result.duration).toBe(120);
      expect(result.resolution.width).toBe(1920);
      expect(result.resolution.height).toBe(1080);
      expect(result.format).toBe('mp4');
      expect(mockFFmpeg.combineVideoAudio).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledTimes(1); // Cleanup temp file
    });

    it('should track progress during video assembly', async () => {
      // Setup mocks
      const mockVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.combineVideoAudio.mockResolvedValue(undefined);
      mockFFmpeg.getVideoInfo.mockResolvedValue(mockVideoInfo);

      const progressCallback: ProgressCallback = jest.fn();

      // Execute
      await videoAssemblyService.combineVideoAudio(mockVideoFile, mockAudioTrack, progressCallback);

      // Verify progress tracking
      expect(progressCallback).toHaveBeenCalledWith(0, 'Starting video assembly');
      expect(progressCallback).toHaveBeenCalledWith(10, 'Input validation complete');
      expect(progressCallback).toHaveBeenCalledWith(20, 'Preparing audio track');
      expect(progressCallback).toHaveBeenCalledWith(40, 'Combining video and audio');
      expect(progressCallback).toHaveBeenCalledWith(80, 'Processing metadata');
      expect(progressCallback).toHaveBeenCalledWith(100, 'Video assembly complete');
    });

    it('should throw AssemblyError when video file does not exist', async () => {
      // Setup mock to simulate file not found
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      // Execute and verify
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, mockAudioTrack)
      ).rejects.toThrow(AssemblyError);
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, mockAudioTrack)
      ).rejects.toThrow('Video file not found');
    });

    it('should throw AssemblyError when audio track has no segments', async () => {
      // Setup invalid audio track
      const invalidAudioTrack = {
        ...mockAudioTrack,
        segments: []
      };

      // Execute and verify
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, invalidAudioTrack)
      ).rejects.toThrow(AssemblyError);
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, invalidAudioTrack)
      ).rejects.toThrow('Audio track has no segments');
    });

    it('should throw AssemblyError when audio track has invalid duration', async () => {
      // Setup invalid audio track
      const invalidAudioTrack = {
        ...mockAudioTrack,
        totalDuration: 0
      };

      // Execute and verify
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, invalidAudioTrack)
      ).rejects.toThrow(AssemblyError);
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, invalidAudioTrack)
      ).rejects.toThrow('Audio track has invalid duration');
    });

    it('should warn about duration mismatch but continue processing', async () => {
      // Setup audio track with different duration
      const mismatchedAudioTrack = {
        ...mockAudioTrack,
        totalDuration: 60 // Half the video duration
      };

      const mockVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.combineVideoAudio.mockResolvedValue(undefined);
      mockFFmpeg.getVideoInfo.mockResolvedValue(mockVideoInfo);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Execute
      const result = await videoAssemblyService.combineVideoAudio(mockVideoFile, mismatchedAudioTrack);

      // Verify warning was logged but processing continued
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Duration mismatch')
      );
      expect(result).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should handle FFmpeg errors gracefully', async () => {
      // Setup FFmpeg to throw error
      mockFFmpeg.combineVideoAudio.mockRejectedValue(new Error('FFmpeg failed'));

      // Execute and verify
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, mockAudioTrack)
      ).rejects.toThrow(AssemblyError);
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, mockAudioTrack)
      ).rejects.toThrow('Failed to combine video and audio');
    });

    it('should handle multi-segment audio tracks with error', async () => {
      // Setup audio track with multiple segments
      const multiSegmentAudioTrack = {
        ...mockAudioTrack,
        segments: [
          mockAudioTrack.segments[0],
          { ...mockAudioTrack.segments[0], id: 'segment-2' }
        ]
      };

      // Execute and verify
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, multiSegmentAudioTrack)
      ).rejects.toThrow(AssemblyError);
      await expect(
        videoAssemblyService.combineVideoAudio(mockVideoFile, multiSegmentAudioTrack)
      ).rejects.toThrow('Multi-segment audio track assembly not implemented');
    });
  });

  describe('preserveVideoQuality', () => {
    it('should validate quality preservation when enabled', async () => {
      // Setup mock video info
      const inputVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      const outputVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 4800000, // Slightly lower but within threshold
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.getVideoInfo
        .mockResolvedValueOnce(inputVideoInfo)
        .mockResolvedValueOnce(outputVideoInfo);

      const outputVideo = { ...mockVideoFile, id: 'output-123' };

      // Execute
      await expect(
        videoAssemblyService.preserveVideoQuality(mockVideoFile, outputVideo)
      ).resolves.not.toThrow();

      expect(mockFFmpeg.getVideoInfo).toHaveBeenCalledTimes(2);
    });

    it('should warn about significant bitrate reduction', async () => {
      // Setup mock video info with significant bitrate reduction
      const inputVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      const outputVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 2000000, // Significant reduction
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.getVideoInfo
        .mockResolvedValueOnce(inputVideoInfo)
        .mockResolvedValueOnce(outputVideoInfo);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const outputVideo = { ...mockVideoFile, id: 'output-123' };

      // Execute
      await videoAssemblyService.preserveVideoQuality(mockVideoFile, outputVideo);

      // Verify warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Output bitrate')
      );

      consoleSpy.mockRestore();
    });

    it('should throw error for resolution mismatch', async () => {
      // Setup mock video info with resolution mismatch
      const inputVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      const outputVideoInfo: VideoInfo = {
        duration: 120,
        width: 1280, // Different resolution
        height: 720,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.getVideoInfo
        .mockResolvedValueOnce(inputVideoInfo)
        .mockResolvedValueOnce(outputVideoInfo);

      const outputVideo = { ...mockVideoFile, id: 'output-123' };

      // Execute and verify
      await expect(
        videoAssemblyService.preserveVideoQuality(mockVideoFile, outputVideo)
      ).rejects.toThrow(AssemblyError);
      
      // Reset mock for second call
      mockFFmpeg.getVideoInfo
        .mockResolvedValueOnce(inputVideoInfo)
        .mockResolvedValueOnce(outputVideoInfo);
        
      await expect(
        videoAssemblyService.preserveVideoQuality(mockVideoFile, outputVideo)
      ).rejects.toThrow('Resolution mismatch');
    });

    it('should skip validation when preserveOriginalQuality is false', async () => {
      // Setup config with quality preservation disabled
      const configWithoutQualityPreservation = {
        ...mockConfig,
        preserveOriginalQuality: false
      };

      const serviceWithoutQualityPreservation = new VideoAssemblyServiceImpl(
        mockFFmpeg,
        configWithoutQualityPreservation
      );

      const outputVideo = { ...mockVideoFile, id: 'output-123' };

      // Execute
      await serviceWithoutQualityPreservation.preserveVideoQuality(mockVideoFile, outputVideo);

      // Verify FFmpeg was not called
      expect(mockFFmpeg.getVideoInfo).not.toHaveBeenCalled();
    });
  });

  describe('addMetadata', () => {
    it('should successfully add metadata to video', async () => {
      // Setup metadata
      const metadata = {
        title: 'New Title',
        description: 'New Description',
        artist: 'Test Artist',
        year: '2023'
      };

      mockFFmpeg.runCustomFFmpegCommand.mockResolvedValue('');

      // Execute
      const result = await videoAssemblyService.addMetadata(mockVideoFile, metadata);

      // Verify
      expect(result).toBeDefined();
      expect(result.metadata.title).toBe('New Title');
      expect(result.metadata.description).toBe('New Description');
      expect(mockFFmpeg.runCustomFFmpegCommand).toHaveBeenCalledWith(
        expect.arrayContaining([
          '-metadata', 'title=New Title',
          '-metadata', 'description=New Description',
          '-metadata', 'artist=Test Artist',
          '-metadata', 'year=2023'
        ])
      );
    });

    it('should handle partial metadata', async () => {
      // Setup partial metadata
      const metadata = {
        title: 'New Title'
      };

      mockFFmpeg.runCustomFFmpegCommand.mockResolvedValue('');

      // Execute
      const result = await videoAssemblyService.addMetadata(mockVideoFile, metadata);

      // Verify
      expect(result.metadata.title).toBe('New Title');
      expect(result.metadata.description).toBe('Test Description'); // Original preserved
      expect(mockFFmpeg.runCustomFFmpegCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['-metadata', 'title=New Title'])
      );
    });

    it('should handle FFmpeg errors when adding metadata', async () => {
      // Setup FFmpeg to throw error
      mockFFmpeg.runCustomFFmpegCommand.mockRejectedValue(new Error('FFmpeg metadata error'));

      const metadata = { title: 'New Title' };

      // Execute and verify
      await expect(
        videoAssemblyService.addMetadata(mockVideoFile, metadata)
      ).rejects.toThrow(AssemblyError);
      await expect(
        videoAssemblyService.addMetadata(mockVideoFile, metadata)
      ).rejects.toThrow('Failed to add metadata');
    });
  });

  describe('error handling and cleanup', () => {
    it('should handle cleanup failures gracefully', async () => {
      // Setup mocks
      const mockVideoInfo: VideoInfo = {
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.combineVideoAudio.mockResolvedValue(undefined);
      mockFFmpeg.getVideoInfo.mockResolvedValue(mockVideoInfo);
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Execute
      const result = await videoAssemblyService.combineVideoAudio(mockVideoFile, mockAudioTrack);

      // Verify processing succeeded despite cleanup failure
      expect(result).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup temporary file'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
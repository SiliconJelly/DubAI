import { QualityAssuranceEngineImpl, QualityThresholds } from '../services/QualityAssuranceEngineImpl';
import { QualityMetricsImpl } from '../models/QualityMetrics';
import { ProcessingJobImpl } from '../models/ProcessingJob';
import { VideoFileImpl } from '../models/VideoFile';
import { CostMetrics, CostMetricsImpl } from '../models/CostMetrics';
import { FFmpegWrapper, AudioInfo, VideoInfo } from '../utils/ffmpeg';
import { JobStatus, VideoMetadata } from '../types/common';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../utils/ffmpeg');

describe('QualityAssuranceEngineImpl', () => {
  let qualityEngine: QualityAssuranceEngineImpl;
  let mockFFmpeg: jest.Mocked<FFmpegWrapper>;
  let mockThresholds: QualityThresholds;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create mocks
    mockFFmpeg = {
      getAudioInfo: jest.fn(),
      getVideoInfo: jest.fn(),
      extractAudio: jest.fn(),
      runCustomFFmpegCommand: jest.fn(),
    } as any;

    mockThresholds = {
      minAudioQuality: 0.7,
      minSynchronizationAccuracy: 0.8,
      maxProcessingTime: 300000,
      minOverallScore: 0.75
    };

    // Create instance
    qualityEngine = new QualityAssuranceEngineImpl(
      mockFFmpeg,
      mockThresholds
    );

    // Mock console.error to avoid noise in tests
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock fs operations
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('mock audio data'));
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
  });

  describe('validateAudioQuality', () => {
    it('should calculate audio quality score correctly for high-quality audio', async () => {
      const mockAudioInfo: AudioInfo = {
        duration: 120,
        sampleRate: 44100,
        channels: 2,
        codec: 'pcm_s16le',
        bitrate: 128000
      };

      mockFFmpeg.getAudioInfo.mockResolvedValue(mockAudioInfo);
      mockFFmpeg.runCustomFFmpegCommand.mockResolvedValue(
        'mean_volume: -15.5 dB\nmax_volume: -2.1 dB'
      );

      const audioBuffer = Buffer.from('high quality audio data');
      const score = await qualityEngine.validateAudioQuality(audioBuffer);

      expect(score).toBeGreaterThan(0.8);
      expect(mockFFmpeg.getAudioInfo).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should calculate lower score for poor quality audio', async () => {
      const mockAudioInfo: AudioInfo = {
        duration: 120,
        sampleRate: 22050,
        channels: 1,
        codec: 'mp3',
        bitrate: 32000
      };

      mockFFmpeg.getAudioInfo.mockResolvedValue(mockAudioInfo);
      mockFFmpeg.runCustomFFmpegCommand.mockResolvedValue(
        'mean_volume: -35.2 dB\nmax_volume: -1.0 dB'
      );

      const audioBuffer = Buffer.from('low quality audio data');
      const score = await qualityEngine.validateAudioQuality(audioBuffer);

      expect(score).toBeLessThan(0.7);
      expect(mockFFmpeg.getAudioInfo).toHaveBeenCalled();
    });

    it('should handle errors gracefully and cleanup temp files', async () => {
      mockFFmpeg.getAudioInfo.mockRejectedValue(new Error('FFmpeg error'));

      const audioBuffer = Buffer.from('audio data');

      await expect(qualityEngine.validateAudioQuality(audioBuffer)).rejects.toThrow('FFmpeg error');
      expect(consoleSpy).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled(); // Should cleanup even on error
    });

    it('should handle volume analysis failure gracefully', async () => {
      const mockAudioInfo: AudioInfo = {
        duration: 120,
        sampleRate: 22050, // Lower sample rate to reduce score
        channels: 1, // Mono to reduce score
        codec: 'mp3',
        bitrate: 64000 // Lower bitrate to reduce score
      };

      mockFFmpeg.getAudioInfo.mockResolvedValue(mockAudioInfo);
      mockFFmpeg.runCustomFFmpegCommand.mockRejectedValue(new Error('Volume analysis failed'));

      const audioBuffer = Buffer.from('audio data');
      const score = await qualityEngine.validateAudioQuality(audioBuffer);

      // Should still return a score based on other metrics
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });

  describe('validateSynchronization', () => {
    it('should return high score for well-synchronized video and audio', async () => {
      const mockVideoInfo: VideoInfo = {
        duration: 120.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      const mockAudioInfo: AudioInfo = {
        duration: 120.1, // Very close duration
        sampleRate: 44100,
        channels: 2,
        codec: 'aac',
        bitrate: 128000
      };

      mockFFmpeg.getVideoInfo.mockResolvedValue(mockVideoInfo);
      mockFFmpeg.getAudioInfo.mockResolvedValue(mockAudioInfo);

      const score = await qualityEngine.validateSynchronization('video.mp4', 'audio.wav');

      expect(score).toBeGreaterThan(0.9);
      expect(mockFFmpeg.getVideoInfo).toHaveBeenCalledWith('video.mp4');
      expect(mockFFmpeg.getAudioInfo).toHaveBeenCalledWith('audio.wav');
    });

    it('should return lower score for poorly synchronized content', async () => {
      const mockVideoInfo: VideoInfo = {
        duration: 120.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      const mockAudioInfo: AudioInfo = {
        duration: 125.0, // 5 second difference
        sampleRate: 44100,
        channels: 2,
        codec: 'aac',
        bitrate: 128000
      };

      mockFFmpeg.getVideoInfo.mockResolvedValue(mockVideoInfo);
      mockFFmpeg.getAudioInfo.mockResolvedValue(mockAudioInfo);

      const score = await qualityEngine.validateSynchronization('video.mp4', 'audio.wav');

      expect(score).toBeLessThan(0.5);
    });

    it('should handle errors and call error handler', async () => {
      mockFFmpeg.getVideoInfo.mockRejectedValue(new Error('Video analysis failed'));

      await expect(qualityEngine.validateSynchronization('video.mp4', 'audio.wav'))
        .rejects.toThrow('Video analysis failed');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('generateQualityReport', () => {
    let mockJob: ProcessingJobImpl;

    beforeEach(() => {
      const mockVideoMetadata: VideoMetadata = {
        duration: 120,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30
      };

      const inputVideo = new VideoFileImpl(
        'input-123',
        'input.mp4',
        '/path/to/input.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        mockVideoMetadata
      );

      const outputVideo = new VideoFileImpl(
        'output-123',
        'output.mp4',
        '/path/to/output.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        mockVideoMetadata
      );

      const costMetrics: CostMetrics = {
        googleTTSCharacters: 1000,
        googleTTSCost: 0.02,
        coquiTTSUsage: 0,
        computeTime: 60,
        totalCost: 0.02
      };

      mockJob = new ProcessingJobImpl(
        'job-123',
        JobStatus.COMPLETED,
        inputVideo,
        costMetrics,
        outputVideo,
        100,
        new Date(Date.now() - 60000), // 1 minute ago
        new Date()
      );
    });

    it('should generate comprehensive quality report for completed job', async () => {
      mockFFmpeg.extractAudio.mockResolvedValue(undefined);
      
      // Mock high-quality metrics
      const mockAudioInfo: AudioInfo = {
        duration: 120,
        sampleRate: 44100,
        channels: 2,
        codec: 'pcm_s16le',
        bitrate: 128000
      };

      const mockVideoInfo: VideoInfo = {
        duration: 120.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.getAudioInfo.mockResolvedValue(mockAudioInfo);
      mockFFmpeg.getVideoInfo.mockResolvedValue(mockVideoInfo);
      mockFFmpeg.runCustomFFmpegCommand.mockResolvedValue(
        'mean_volume: -15.5 dB\nmax_volume: -2.1 dB'
      );

      const report = await qualityEngine.generateQualityReport(mockJob);

      expect(report.jobId).toBe('job-123');
      expect(report.overallScore).toBeGreaterThan(0.7);
      expect(report.metrics.audioQuality).toBeGreaterThan(0);
      expect(report.metrics.synchronizationAccuracy).toBeGreaterThan(0);
      expect(report.passedValidation).toBe(true);
      expect(Array.isArray(report.issues)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(mockFFmpeg.extractAudio).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled(); // Cleanup
    });

    it('should identify quality issues and provide recommendations', async () => {
      mockFFmpeg.extractAudio.mockResolvedValue(undefined);
      
      // Mock poor quality metrics
      const mockAudioInfo: AudioInfo = {
        duration: 120,
        sampleRate: 22050, // Low sample rate
        channels: 1, // Mono
        codec: 'mp3',
        bitrate: 32000 // Low bitrate
      };

      const mockVideoInfo: VideoInfo = {
        duration: 125.0, // Duration mismatch
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30,
        hasAudio: true
      };

      mockFFmpeg.getAudioInfo.mockResolvedValue(mockAudioInfo);
      mockFFmpeg.getVideoInfo.mockResolvedValue(mockVideoInfo);
      mockFFmpeg.runCustomFFmpegCommand.mockResolvedValue(
        'mean_volume: -35.0 dB\nmax_volume: -0.5 dB' // Poor levels
      );

      const report = await qualityEngine.generateQualityReport(mockJob);

      expect(report.overallScore).toBeLessThan(0.7);
      expect(report.passedValidation).toBe(false);
      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      // Check for specific issue types
      const hasAudioIssue = report.issues.some(issue => issue.type === 'audio_quality');
      const hasSyncIssue = report.issues.some(issue => issue.type === 'synchronization');
      expect(hasAudioIssue || hasSyncIssue).toBe(true);
    });

    it('should throw error for job without output video', async () => {
      const jobWithoutOutput = new ProcessingJobImpl(
        'job-456',
        JobStatus.PROCESSING,
        mockJob.inputVideo,
        mockJob.costTracking
      );

      await expect(qualityEngine.generateQualityReport(jobWithoutOutput))
        .rejects.toThrow('Cannot generate quality report: job has no output video');
    });

    it('should cleanup temp files even on error', async () => {
      mockFFmpeg.extractAudio.mockResolvedValue(undefined);
      mockFFmpeg.getAudioInfo.mockRejectedValue(new Error('Analysis failed'));

      await expect(qualityEngine.generateQualityReport(mockJob))
        .rejects.toThrow('Analysis failed');
      
      expect(fs.unlink).toHaveBeenCalled(); // Should cleanup temp file
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('checkQualityThresholds', () => {
    it('should return true for metrics that meet all thresholds', async () => {
      const goodMetrics = new QualityMetricsImpl(
        0.8, // Audio quality above threshold
        0.85, // Sync accuracy above threshold
        250000, // Processing time below threshold
        0.9 // User satisfaction
      );

      const result = await qualityEngine.checkQualityThresholds(goodMetrics);
      expect(result).toBe(true);
    });

    it('should return false for metrics that fail thresholds', async () => {
      const poorMetrics = new QualityMetricsImpl(
        0.6, // Audio quality below threshold
        0.75, // Sync accuracy below threshold
        400000, // Processing time above threshold
        0.5 // User satisfaction
      );

      const result = await qualityEngine.checkQualityThresholds(poorMetrics);
      expect(result).toBe(false);
    });

    it('should handle metrics without user satisfaction', async () => {
      const metricsWithoutSatisfaction = new QualityMetricsImpl(
        0.8,
        0.85,
        250000
        // No user satisfaction
      );

      const result = await qualityEngine.checkQualityThresholds(metricsWithoutSatisfaction);
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const invalidMetrics = null as any; // Invalid metrics object that will cause error

      const result = await qualityEngine.checkQualityThresholds(invalidMetrics);
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('threshold management', () => {
    it('should update thresholds correctly', () => {
      const newThresholds = {
        minAudioQuality: 0.8,
        minOverallScore: 0.85
      };

      qualityEngine.updateThresholds(newThresholds);
      const currentThresholds = qualityEngine.getThresholds();

      expect(currentThresholds.minAudioQuality).toBe(0.8);
      expect(currentThresholds.minOverallScore).toBe(0.85);
      expect(currentThresholds.minSynchronizationAccuracy).toBe(0.8); // Should remain unchanged
      expect(currentThresholds.maxProcessingTime).toBe(300000); // Should remain unchanged
    });

    it('should return copy of thresholds to prevent external modification', () => {
      const thresholds1 = qualityEngine.getThresholds();
      const thresholds2 = qualityEngine.getThresholds();

      expect(thresholds1).toEqual(thresholds2);
      expect(thresholds1).not.toBe(thresholds2); // Different objects

      // Modifying returned object should not affect internal state
      thresholds1.minAudioQuality = 0.9;
      const thresholds3 = qualityEngine.getThresholds();
      expect(thresholds3.minAudioQuality).toBe(0.7); // Original value
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty audio buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      mockFFmpeg.getAudioInfo.mockRejectedValue(new Error('Invalid audio file'));

      await expect(qualityEngine.validateAudioQuality(emptyBuffer))
        .rejects.toThrow('Invalid audio file');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle missing video or audio files', async () => {
      mockFFmpeg.getVideoInfo.mockRejectedValue(new Error('File not found'));

      await expect(qualityEngine.validateSynchronization('nonexistent.mp4', 'audio.wav'))
        .rejects.toThrow('File not found');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle malformed FFmpeg output', async () => {
      const mockAudioInfo: AudioInfo = {
        duration: 120,
        sampleRate: 22050, // Lower sample rate to reduce score
        channels: 1, // Mono to reduce score
        codec: 'mp3',
        bitrate: 32000 // Lower bitrate to reduce score
      };

      mockFFmpeg.getAudioInfo.mockResolvedValue(mockAudioInfo);
      mockFFmpeg.runCustomFFmpegCommand.mockResolvedValue('malformed output without volume data');

      const audioBuffer = Buffer.from('audio data');
      const score = await qualityEngine.validateAudioQuality(audioBuffer);

      // Should still return a reasonable score based on other metrics
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });
});
import { VideoFile, AudioFile, VideoFileImpl, AudioFileImpl } from '../models';
import { ValidationResult } from '../types/common';
import { VideoProcessingError } from '../types/errors';
import { FFmpegWrapper, FFmpegConfig } from '../utils/ffmpeg';
import { FileManager, FileManagerConfig } from '../utils/fileManager';
import { DefaultErrorHandler } from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface VideoProcessingService {
  extractAudio(videoFile: VideoFile): Promise<AudioFile>;
  validateVideoFormat(videoFile: VideoFile): Promise<ValidationResult>;
  cleanupTempFiles(sessionId: string): Promise<void>;
}

export interface VideoProcessingConfig {
  tempDirectory: string;
  supportedFormats: string[];
  ffmpegPath: string;
  maxFileSize: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export class VideoProcessingServiceImpl implements VideoProcessingService {
  private ffmpegWrapper: FFmpegWrapper;
  private fileManager: FileManager;
  private errorHandler: DefaultErrorHandler;

  constructor(
    private config: VideoProcessingConfig,
    ffmpegConfig?: FFmpegConfig,
    fileManagerConfig?: FileManagerConfig
  ) {
    // Initialize FFmpeg wrapper with provided config or defaults
    const defaultFFmpegConfig: FFmpegConfig = {
      ffmpegPath: config.ffmpegPath || 'ffmpeg',
      ffprobePath: 'ffprobe',
      timeout: 300000 // 5 minutes
    };
    this.ffmpegWrapper = new FFmpegWrapper(ffmpegConfig || defaultFFmpegConfig);

    // Initialize file manager with provided config or defaults
    const defaultFileManagerConfig: FileManagerConfig = {
      tempDirectory: config.tempDirectory,
      outputDirectory: path.join(config.tempDirectory, 'output'),
      cleanupIntervalHours: 24
    };
    this.fileManager = new FileManager(fileManagerConfig || defaultFileManagerConfig);

    this.errorHandler = new DefaultErrorHandler();
  }

  async extractAudio(videoFile: VideoFile): Promise<AudioFile> {
    try {
      // Validate input video file
      const validation = await this.validateVideoFormat(videoFile);
      if (!validation.isValid) {
        throw new VideoProcessingError(
          `Invalid video file: ${validation.errors.join(', ')}`
        );
      }

      // Check if video file exists
      const videoExists = await this.fileManager.fileExists(videoFile.path);
      if (!videoExists) {
        throw new VideoProcessingError(`Video file not found: ${videoFile.path}`);
      }

      // Create temporary audio file path
      const audioId = uuidv4();
      const audioPath = await this.fileManager.createTempFile('wav', audioId);

      // Extract audio with retry logic
      await this.executeWithRetry(
        () => this.ffmpegWrapper.extractAudio(videoFile.path, audioPath),
        'Audio extraction failed'
      );

      // Get audio information
      const audioInfo = await this.executeWithRetry(
        () => this.ffmpegWrapper.getAudioInfo(audioPath),
        'Failed to get audio information'
      );

      // Create AudioFile instance
      const audioFile = new AudioFileImpl(
        audioId,
        `${path.basename(videoFile.filename, path.extname(videoFile.filename))}.wav`,
        audioPath,
        'wav',
        audioInfo.duration,
        audioInfo.sampleRate,
        audioInfo.channels
      );

      // Validate the created audio file
      if (!audioFile.validate()) {
        throw new VideoProcessingError('Created audio file failed validation');
      }

      return audioFile;

    } catch (error) {
      if (error instanceof VideoProcessingError) {
        throw error;
      }
      throw new VideoProcessingError(
        `Failed to extract audio from video: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validateVideoFormat(videoFile: VideoFile): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if file exists
      const exists = await this.fileManager.fileExists(videoFile.path);
      if (!exists) {
        errors.push(`Video file does not exist: ${videoFile.path}`);
        return { isValid: false, errors, warnings };
      }

      // Check file size
      const fileSize = await this.fileManager.getFileSize(videoFile.path);
      if (fileSize > this.config.maxFileSize) {
        errors.push(`File size ${fileSize} exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
      }

      // Check file extension
      const extension = path.extname(videoFile.filename).toLowerCase().slice(1);
      if (!this.config.supportedFormats.includes(extension)) {
        errors.push(`Unsupported video format: ${extension}. Supported formats: ${this.config.supportedFormats.join(', ')}`);
      }

      // Try to get video information using FFprobe
      try {
        const videoInfo = await this.ffmpegWrapper.getVideoInfo(videoFile.path);
        
        // Check if video has audio track
        if (!videoInfo.hasAudio) {
          warnings.push('Video file does not contain an audio track');
        }

        // Check video duration
        if (videoInfo.duration <= 0) {
          errors.push('Video file has invalid duration');
        }

        // Check video resolution
        if (videoInfo.width <= 0 || videoInfo.height <= 0) {
          errors.push('Video file has invalid resolution');
        }

      } catch (ffmpegError) {
        errors.push(`Failed to analyze video file: ${ffmpegError instanceof Error ? ffmpegError.message : 'Unknown FFmpeg error'}`);
      }

    } catch (error) {
      errors.push(`Failed to validate video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async cleanupTempFiles(sessionId: string): Promise<void> {
    try {
      await this.fileManager.cleanupTempFiles(sessionId);
    } catch (error) {
      // Log the error but don't throw - cleanup failures shouldn't break the workflow
      console.warn(`Failed to cleanup temp files for session ${sessionId}:`, error);
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === this.config.retryAttempts) {
          break; // Don't wait after the last attempt
        }

        // Wait before retrying with exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }

    throw new VideoProcessingError(
      `${errorMessage} after ${this.config.retryAttempts} attempts: ${lastError?.message}`,
      lastError
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
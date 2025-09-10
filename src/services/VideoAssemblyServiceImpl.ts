import { VideoAssemblyService, VideoAssemblyConfig, AudioTrack } from './VideoAssemblyService';
import { VideoFile, VideoFileImpl } from '../models/VideoFile';
import { FFmpegWrapper, VideoInfo } from '../utils/ffmpeg';
import { AssemblyError } from '../types/errors';
import { VideoMetadata, Resolution } from '../types/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ProgressCallback {
  (progress: number, stage: string): void;
}

export class VideoAssemblyServiceImpl implements VideoAssemblyService {
  private ffmpeg: FFmpegWrapper;
  private config: VideoAssemblyConfig;

  constructor(ffmpeg: FFmpegWrapper, config: VideoAssemblyConfig) {
    this.ffmpeg = ffmpeg;
    this.config = config;
  }

  async combineVideoAudio(
    videoFile: VideoFile, 
    audioTrack: AudioTrack,
    progressCallback?: ProgressCallback
  ): Promise<VideoFile> {
    try {
      progressCallback?.(0, 'Starting video assembly');

      // Validate inputs
      await this.validateInputs(videoFile, audioTrack);
      progressCallback?.(10, 'Input validation complete');

      // Create output filename
      const outputFilename = this.generateOutputFilename(videoFile.filename);
      const outputPath = path.join(this.config.tempDirectory, outputFilename);

      progressCallback?.(20, 'Preparing audio track');

      // First, we need to create a temporary audio file from the audio track
      const tempAudioPath = await this.createTempAudioFile(audioTrack);
      
      progressCallback?.(40, 'Combining video and audio');

      // Combine video and audio using FFmpeg
      await this.ffmpeg.combineVideoAudio(videoFile.path, tempAudioPath, outputPath);

      progressCallback?.(80, 'Processing metadata');

      // Get video info for the new file
      const videoInfo = await this.ffmpeg.getVideoInfo(outputPath);

      // Create new VideoFile object
      const outputVideo = new VideoFileImpl(
        uuidv4(),
        outputFilename,
        outputPath,
        this.config.outputFormat,
        videoInfo.duration,
        { width: videoInfo.width, height: videoInfo.height },
        {
          ...(videoFile.metadata.title && { title: videoFile.metadata.title }),
          ...(videoFile.metadata.description && { description: videoFile.metadata.description }),
          duration: videoInfo.duration,
          codec: videoInfo.codec,
          bitrate: videoInfo.bitrate,
          frameRate: videoInfo.frameRate
        }
      );

      // Clean up temporary audio file
      await this.cleanupTempFile(tempAudioPath);

      progressCallback?.(100, 'Video assembly complete');

      return outputVideo;
    } catch (error) {
      throw new AssemblyError(
        `Failed to combine video and audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async preserveVideoQuality(inputVideo: VideoFile, outputVideo: VideoFile): Promise<void> {
    try {
      // Check if quality preservation is needed
      if (!this.config.preserveOriginalQuality) {
        return;
      }

      // Get detailed info about both videos
      const inputInfo = await this.ffmpeg.getVideoInfo(inputVideo.path);
      const outputInfo = await this.ffmpeg.getVideoInfo(outputVideo.path);

      // Validate that output quality matches input quality within acceptable thresholds
      const qualityThreshold = 0.95; // 95% quality retention
      
      if (outputInfo.bitrate && inputInfo.bitrate && outputInfo.bitrate < inputInfo.bitrate * qualityThreshold) {
        console.warn(`Output bitrate (${outputInfo.bitrate}) is significantly lower than input (${inputInfo.bitrate})`);
      }

      if (outputInfo.width !== inputInfo.width || outputInfo.height !== inputInfo.height) {
        throw new AssemblyError(
          `Resolution mismatch: Input ${inputInfo.width}x${inputInfo.height}, Output ${outputInfo.width}x${outputInfo.height}`
        );
      }

    } catch (error) {
      // If it's already an AssemblyError, re-throw it
      if (error instanceof AssemblyError) {
        throw error;
      }
      
      throw new AssemblyError(
        `Failed to preserve video quality: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async addMetadata(video: VideoFile, metadata: Record<string, any>): Promise<VideoFile> {
    try {
      // Create a new filename for the video with metadata
      const metadataFilename = this.generateMetadataFilename(video.filename);
      const outputPath = path.join(this.config.tempDirectory, metadataFilename);

      // Build FFmpeg metadata arguments
      const metadataArgs = this.buildMetadataArgs(metadata);

      // Apply metadata using FFmpeg
      const args = [
        '-i', video.path,
        '-c', 'copy', // Copy streams without re-encoding
        ...metadataArgs,
        '-y', // Overwrite output file
        outputPath
      ];

      await this.ffmpeg.runCustomFFmpegCommand(args);

      // Create new VideoFile object with updated metadata
      const updatedMetadata: VideoMetadata = {
        ...video.metadata,
        title: metadata['title'] || video.metadata.title,
        description: metadata['description'] || video.metadata.description
      };

      const updatedVideo = new VideoFileImpl(
        uuidv4(),
        metadataFilename,
        outputPath,
        video.format,
        video.duration,
        video.resolution,
        updatedMetadata
      );

      return updatedVideo;
    } catch (error) {
      throw new AssemblyError(
        `Failed to add metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async validateInputs(videoFile: VideoFile, audioTrack: AudioTrack): Promise<void> {
    // Check if video file exists
    try {
      await fs.access(videoFile.path);
    } catch {
      throw new AssemblyError(`Video file not found: ${videoFile.path}`);
    }

    // Validate video file
    if (!(videoFile as VideoFileImpl).validate()) {
      throw new AssemblyError('Invalid video file provided');
    }

    // Validate audio track
    if (!audioTrack.segments || audioTrack.segments.length === 0) {
      throw new AssemblyError('Audio track has no segments');
    }

    if (audioTrack.totalDuration <= 0) {
      throw new AssemblyError('Audio track has invalid duration');
    }

    // Check duration compatibility (allow some tolerance)
    const durationTolerance = 1.0; // 1 second tolerance
    if (Math.abs(videoFile.duration - audioTrack.totalDuration) > durationTolerance) {
      console.warn(
        `Duration mismatch: Video ${videoFile.duration}s, Audio ${audioTrack.totalDuration}s. ` +
        `Difference: ${Math.abs(videoFile.duration - audioTrack.totalDuration)}s`
      );
    }
  }

  private async createTempAudioFile(audioTrack: AudioTrack): Promise<string> {
    // For now, we'll assume the audio track has a path property or we need to assemble it
    // This is a simplified implementation - in a real scenario, you might need to
    // assemble the audio segments into a single file first
    
    const tempAudioFilename = `temp_audio_${uuidv4()}.${audioTrack.format}`;
    const tempAudioPath = path.join(this.config.tempDirectory, tempAudioFilename);

    // If audio track segments need to be assembled, we would do that here
    // For this implementation, we'll assume the audio track represents an already assembled file
    // In a complete implementation, you would use the AudioAssemblyService to create the file

    if (audioTrack.segments.length === 1 && audioTrack.segments[0].audioBuffer) {
      // Write the audio buffer to a temporary file
      await fs.writeFile(tempAudioPath, audioTrack.segments[0].audioBuffer);
    } else {
      // This would require integration with AudioAssemblyService
      // For now, throw an error indicating this needs to be implemented
      throw new AssemblyError(
        'Multi-segment audio track assembly not implemented in this method. ' +
        'Audio track should be pre-assembled using AudioAssemblyService.'
      );
    }

    return tempAudioPath;
  }

  private generateOutputFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${basename}_dubbed_${timestamp}.${this.config.outputFormat}`;
  }

  private generateMetadataFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${basename}_metadata_${timestamp}${ext}`;
  }

  private buildMetadataArgs(metadata: Record<string, any>): string[] {
    const args: string[] = [];
    
    // Add common metadata fields
    if (metadata['title']) {
      args.push('-metadata', `title=${metadata['title']}`);
    }
    
    if (metadata['description']) {
      args.push('-metadata', `description=${metadata['description']}`);
    }
    
    if (metadata['artist']) {
      args.push('-metadata', `artist=${metadata['artist']}`);
    }
    
    if (metadata['album']) {
      args.push('-metadata', `album=${metadata['album']}`);
    }
    
    if (metadata['year']) {
      args.push('-metadata', `year=${metadata['year']}`);
    }
    
    if (metadata['comment']) {
      args.push('-metadata', `comment=${metadata['comment']}`);
    }

    return args;
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Log warning but don't throw - cleanup failures shouldn't break the main process
      console.warn(`Failed to cleanup temporary file ${filePath}:`, error);
    }
  }
}
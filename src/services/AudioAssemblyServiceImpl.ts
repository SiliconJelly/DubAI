import { AudioAssemblyService, AudioTrack, Timestamp, AudioAssemblyConfig } from './AudioAssemblyService';
import { AudioSegment } from '../models/AudioSegment';
import { FFmpegWrapper } from '../utils/ffmpeg';
import { FileManager } from '../utils/fileManager';
import { AssemblyError } from '../types/errors';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AudioAssemblyServiceImpl implements AudioAssemblyService {
  private ffmpeg: FFmpegWrapper;
  private fileManager: FileManager;
  private config: AudioAssemblyConfig;

  constructor(
    ffmpeg: FFmpegWrapper,
    fileManager: FileManager,
    config?: Partial<AudioAssemblyConfig>
  ) {
    this.ffmpeg = ffmpeg;
    this.fileManager = fileManager;
    this.config = {
      outputFormat: 'wav',
      sampleRate: 44100,
      channels: 2,
      normalizationEnabled: true,
      silencePaddingMs: 100,
      ...config
    };
  }

  async assembleAudioTrack(segments: AudioSegment[]): Promise<AudioTrack> {
    if (!segments || segments.length === 0) {
      throw new AssemblyError('No audio segments provided for assembly');
    }

    try {
      // Sort segments by start time to ensure proper order
      const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);
      
      // Validate segments for overlaps and gaps
      this.validateSegmentTimings(sortedSegments);

      // Create temporary files for each segment
      const segmentFiles: string[] = [];
      
      try {
        for (const segment of sortedSegments) {
          const tempFile = await this.createSegmentFile(segment);
          segmentFiles.push(tempFile);
        }

        // Create the assembled audio track
        const assembledFile = await this.combineSegments(segmentFiles, sortedSegments);
        
        // Calculate total duration
        const totalDuration = Math.max(...sortedSegments.map(s => s.endTime));

        const audioTrack: AudioTrack = {
          id: uuidv4(),
          segments: sortedSegments,
          totalDuration,
          sampleRate: this.config.sampleRate,
          channels: this.config.channels,
          format: this.config.outputFormat
        };

        return audioTrack;

      } finally {
        // Clean up temporary segment files
        await this.cleanupFiles(segmentFiles);
      }

    } catch (error) {
      throw new AssemblyError(
        `Failed to assemble audio track: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async synchronizeWithTimestamps(audio: AudioTrack, timestamps: Timestamp[]): Promise<AudioTrack> {
    if (!timestamps || timestamps.length === 0) {
      return audio;
    }

    try {
      // Create a mapping of segment IDs to new timestamps
      const timestampMap = new Map<string, Timestamp>();
      timestamps.forEach(ts => timestampMap.set(ts.segmentId, ts));

      // Update segments with new timestamps
      const synchronizedSegments = audio.segments.map(segment => {
        const newTimestamp = timestampMap.get(segment.id);
        if (newTimestamp) {
          return {
            ...segment,
            startTime: newTimestamp.startTime,
            endTime: newTimestamp.endTime
          };
        }
        return segment;
      });

      // Re-assemble with new timing
      return await this.assembleAudioTrack(synchronizedSegments);

    } catch (error) {
      throw new AssemblyError(
        `Failed to synchronize audio with timestamps: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async normalizeAudio(audio: AudioTrack): Promise<AudioTrack> {
    if (!this.config.normalizationEnabled) {
      return audio;
    }

    try {
      // Create temporary files for normalization process
      const inputFile = await this.fileManager.createTempFile('wav');
      const outputFile = await this.fileManager.createTempFile('wav');

      try {
        // Write current audio track to temporary file
        await this.writeAudioTrackToFile(audio, inputFile);

        // Apply normalization using FFmpeg
        await this.applyNormalization(inputFile, outputFile);

        // Read the normalized audio back
        const normalizedAudio = await this.readAudioTrackFromFile(outputFile, audio);

        return normalizedAudio;

      } finally {
        // Clean up temporary files
        await this.cleanupFiles([inputFile, outputFile]);
      }

    } catch (error) {
      throw new AssemblyError(
        `Failed to normalize audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private validateSegmentTimings(segments: AudioSegment[]): void {
    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];

      // Check for invalid timing
      if (current.startTime >= current.endTime) {
        throw new AssemblyError(`Invalid segment timing: segment ${current.id} has start time >= end time`);
      }

      // Check for overlaps
      if (current.endTime > next.startTime) {
        throw new AssemblyError(`Overlapping segments detected: ${current.id} and ${next.id}`);
      }
    }
  }

  private async createSegmentFile(segment: AudioSegment): Promise<string> {
    const tempFile = await this.fileManager.createTempFile('wav');
    
    try {
      await fs.writeFile(tempFile, segment.audioBuffer);
      return tempFile;
    } catch (error) {
      await this.fileManager.deleteFile(tempFile);
      throw new AssemblyError(
        `Failed to create segment file for ${segment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async combineSegments(segmentFiles: string[], segments: AudioSegment[]): Promise<string> {
    const outputFile = await this.fileManager.createTempFile(this.config.outputFormat);
    
    try {
      // Create FFmpeg filter complex for combining segments with precise timing
      const filterComplex = this.buildFilterComplex(segments);
      
      await this.ffmpeg.combineAudioSegments(segmentFiles, outputFile, filterComplex);
      return outputFile;

    } catch (error) {
      await this.fileManager.deleteFile(outputFile);
      throw error;
    }
  }

  private buildFilterComplex(segments: AudioSegment[]): string {
    const filters: string[] = [];
    
    // Add silence padding and timing for each segment
    segments.forEach((segment, index) => {
      const silencePadding = this.config.silencePaddingMs / 1000; // Convert to seconds
      
      // Add delay to position segment at correct time
      if (segment.startTime > 0) {
        filters.push(`[${index}:a]adelay=${Math.floor(segment.startTime * 1000)}|${Math.floor(segment.startTime * 1000)}[delayed${index}]`);
      } else {
        filters.push(`[${index}:a]acopy[delayed${index}]`);
      }
    });

    // Mix all delayed segments together
    const mixInputs = segments.map((_, index) => `[delayed${index}]`).join('');
    filters.push(`${mixInputs}amix=inputs=${segments.length}:duration=longest[out]`);

    return filters.join(';');
  }

  private async applyNormalization(inputFile: string, outputFile: string): Promise<void> {
    await this.ffmpeg.normalizeAudio(inputFile, outputFile, -16);
  }

  private async writeAudioTrackToFile(audio: AudioTrack, filePath: string): Promise<void> {
    // For normalization, we need to recreate the audio file from segments
    // This is a simplified approach - we'll reassemble the segments into a file
    const segmentFiles: string[] = [];
    
    try {
      // Create temporary files for each segment
      for (const segment of audio.segments) {
        const tempFile = await this.createSegmentFile(segment);
        segmentFiles.push(tempFile);
      }

      // Combine segments into the output file
      const filterComplex = this.buildFilterComplex(audio.segments);
      await this.ffmpeg.combineAudioSegments(segmentFiles, filePath, filterComplex);

    } finally {
      // Clean up temporary segment files
      await this.cleanupFiles(segmentFiles);
    }
  }

  private async readAudioTrackFromFile(filePath: string, originalAudio: AudioTrack): Promise<AudioTrack> {
    // Get updated audio information from the normalized file
    const audioInfo = await this.ffmpeg.getAudioInfo(filePath);
    
    // Create a new audio track with updated metadata but same segments
    return {
      ...originalAudio,
      totalDuration: audioInfo.duration,
      sampleRate: audioInfo.sampleRate,
      channels: audioInfo.channels
    };
  }



  private async cleanupFiles(files: string[]): Promise<void> {
    await Promise.all(
      files.map(file => this.fileManager.deleteFile(file).catch(err => 
        console.warn(`Failed to cleanup file ${file}:`, err)
      ))
    );
  }
}
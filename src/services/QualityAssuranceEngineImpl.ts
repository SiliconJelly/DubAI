import { QualityAssuranceEngine, QualityReport, QualityIssue } from './QualityAssuranceEngine';
import { QualityMetrics, QualityMetricsImpl } from '../models/QualityMetrics';
import { ProcessingJob } from '../models/ProcessingJob';
import { FFmpegWrapper, AudioInfo, VideoInfo } from '../utils/ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface QualityThresholds {
  minAudioQuality: number;
  minSynchronizationAccuracy: number;
  maxProcessingTime: number;
  minOverallScore: number;
}

export class QualityAssuranceEngineImpl implements QualityAssuranceEngine {
  private ffmpeg: FFmpegWrapper;
  private thresholds: QualityThresholds;

  constructor(
    ffmpeg: FFmpegWrapper,
    thresholds: QualityThresholds = {
      minAudioQuality: 0.7,
      minSynchronizationAccuracy: 0.8,
      maxProcessingTime: 300000, // 5 minutes in ms
      minOverallScore: 0.75
    }
  ) {
    this.ffmpeg = ffmpeg;
    this.thresholds = thresholds;
  }

  async validateAudioQuality(audioBuffer: Buffer): Promise<number> {
    try {
      // Create temporary file for analysis
      const tempPath = path.join(process.cwd(), 'temp', `audio_analysis_${Date.now()}.wav`);
      await fs.writeFile(tempPath, audioBuffer);

      try {
        const audioInfo = await this.ffmpeg.getAudioInfo(tempPath);
        const qualityScore = await this.calculateAudioQualityScore(tempPath, audioInfo);
        
        // Cleanup temp file
        await fs.unlink(tempPath).catch(() => {}); // Ignore cleanup errors
        
        return qualityScore;
      } catch (error) {
        // Cleanup temp file on error
        await fs.unlink(tempPath).catch(() => {});
        throw error;
      }
    } catch (error) {
      // Log error but don't use error handler for generic errors
      console.error('QualityAssuranceEngine.validateAudioQuality error:', error);
      throw error;
    }
  }

  async validateSynchronization(videoFile: string, audioFile: string): Promise<number> {
    try {
      const videoInfo = await this.ffmpeg.getVideoInfo(videoFile);
      const audioInfo = await this.ffmpeg.getAudioInfo(audioFile);

      // Calculate synchronization accuracy based on duration matching and timing analysis
      const durationDiff = Math.abs(videoInfo.duration - audioInfo.duration);
      const maxAllowedDiff = Math.max(0.5, videoInfo.duration * 0.02); // 2% tolerance or 0.5s minimum

      // Base score from duration matching
      let syncScore = Math.max(0, 1 - (durationDiff / maxAllowedDiff));

      // Additional analysis for timing accuracy
      const timingAccuracy = await this.analyzeTimingAccuracy(videoFile, audioFile);
      syncScore = (syncScore * 0.6) + (timingAccuracy * 0.4);

      return Math.min(1, Math.max(0, syncScore));
    } catch (error) {
      // Log error but don't use error handler for generic errors
      console.error('QualityAssuranceEngine.validateSynchronization error:', error);
      throw error;
    }
  }

  async generateQualityReport(job: ProcessingJob): Promise<QualityReport> {
    try {
      const issues: QualityIssue[] = [];
      const recommendations: string[] = [];

      if (!job.outputVideo) {
        throw new Error('Cannot generate quality report: job has no output video');
      }

      // Extract audio from output video for analysis
      const tempAudioPath = path.join(process.cwd(), 'temp', `qa_audio_${job.id}.wav`);
      await this.ffmpeg.extractAudio(job.outputVideo.path, tempAudioPath);

      try {
        // Read audio buffer for quality analysis
        const audioBuffer = await fs.readFile(tempAudioPath);
        
        // Calculate quality metrics
        const audioQuality = await this.validateAudioQuality(audioBuffer);
        const syncAccuracy = await this.validateSynchronization(job.inputVideo.path, tempAudioPath);
        const processingTime = job.completedAt && job.createdAt ? 
          job.completedAt.getTime() - job.createdAt.getTime() : 0;

        const metrics = new QualityMetricsImpl(
          audioQuality,
          syncAccuracy,
          processingTime,
          undefined // User satisfaction would come from a separate feedback system
        );

        // Identify issues and generate recommendations
        this.identifyQualityIssues(metrics, issues, recommendations);

        const overallScore = metrics.getOverallScore();
        const passedValidation = await this.checkQualityThresholds(metrics);

        // Cleanup temp file
        await fs.unlink(tempAudioPath).catch(() => {});

        return {
          jobId: job.id,
          overallScore,
          metrics,
          issues,
          recommendations,
          passedValidation
        };
      } catch (error) {
        // Cleanup temp file on error
        await fs.unlink(tempAudioPath).catch(() => {});
        throw error;
      }
    } catch (error) {
      // Log error but don't use error handler for generic errors
      console.error('QualityAssuranceEngine.generateQualityReport error:', error);
      throw error;
    }
  }

  async checkQualityThresholds(metrics: QualityMetrics): Promise<boolean> {
    try {
      const metricsImpl = metrics instanceof QualityMetricsImpl ? 
        metrics : 
        new QualityMetricsImpl(
          metrics.audioQuality,
          metrics.synchronizationAccuracy,
          metrics.processingTime,
          metrics.userSatisfaction
        );

      return (
        metrics.audioQuality >= this.thresholds.minAudioQuality &&
        metrics.synchronizationAccuracy >= this.thresholds.minSynchronizationAccuracy &&
        metrics.processingTime <= this.thresholds.maxProcessingTime &&
        metricsImpl.getOverallScore() >= this.thresholds.minOverallScore
      );
    } catch (error) {
      // Log error but don't use error handler for generic errors
      console.error('QualityAssuranceEngine.checkQualityThresholds error:', error);
      return false;
    }
  }

  private async calculateAudioQualityScore(audioPath: string, audioInfo: AudioInfo): Promise<number> {
    let qualityScore = 0.5; // Base score

    // Sample rate quality (higher is better, up to a point)
    if (audioInfo.sampleRate >= 44100) {
      qualityScore += 0.2;
    } else if (audioInfo.sampleRate >= 22050) {
      qualityScore += 0.1;
    }

    // Bitrate quality
    if (audioInfo.bitrate >= 128000) {
      qualityScore += 0.2;
    } else if (audioInfo.bitrate >= 64000) {
      qualityScore += 0.1;
    }

    // Channel configuration (stereo preferred)
    if (audioInfo.channels === 2) {
      qualityScore += 0.1;
    }

    // Analyze audio levels and consistency using FFmpeg
    try {
      const volumeAnalysis = await this.analyzeAudioLevels(audioPath);
      qualityScore += volumeAnalysis * 0.2; // Up to 0.2 points for good levels
    } catch (error) {
      // If volume analysis fails, don't penalize but don't add bonus
    }

    return Math.min(1, Math.max(0, qualityScore));
  }

  private async analyzeAudioLevels(audioPath: string): Promise<number> {
    try {
      // Use FFmpeg volumedetect filter to analyze audio levels
      const args = [
        '-i', audioPath,
        '-af', 'volumedetect',
        '-f', 'null',
        '-'
      ];

      const output = await this.ffmpeg.runCustomFFmpegCommand(args);
      
      // Parse volume detection output
      const meanVolumeMatch = output.match(/mean_volume:\s*(-?\d+\.?\d*)\s*dB/);
      const maxVolumeMatch = output.match(/max_volume:\s*(-?\d+\.?\d*)\s*dB/);

      if (meanVolumeMatch && maxVolumeMatch) {
        const meanVolume = parseFloat(meanVolumeMatch[1]);
        const maxVolume = parseFloat(maxVolumeMatch[1]);

        // Good audio should have mean volume between -20dB and -12dB
        // and max volume should not exceed -3dB (to avoid clipping)
        let levelScore = 0;

        // Mean volume scoring
        if (meanVolume >= -20 && meanVolume <= -12) {
          levelScore += 0.6;
        } else if (meanVolume >= -25 && meanVolume <= -8) {
          levelScore += 0.4;
        } else if (meanVolume >= -30 && meanVolume <= -6) {
          levelScore += 0.2;
        }

        // Max volume scoring (avoid clipping)
        if (maxVolume <= -3) {
          levelScore += 0.4;
        } else if (maxVolume <= -1) {
          levelScore += 0.2;
        }

        return Math.min(1, levelScore);
      }

      return 0.5; // Default if parsing fails
    } catch (error) {
      return 0.5; // Default on error
    }
  }

  private async analyzeTimingAccuracy(videoFile: string, audioFile: string): Promise<number> {
    try {
      // This is a simplified timing analysis
      // In a production system, you might want more sophisticated analysis
      // such as cross-correlation or spectral analysis
      
      const videoInfo = await this.ffmpeg.getVideoInfo(videoFile);
      const audioInfo = await this.ffmpeg.getAudioInfo(audioFile);

      // Check if durations are reasonably close
      const durationDiff = Math.abs(videoInfo.duration - audioInfo.duration);
      const relativeDiff = durationDiff / Math.max(videoInfo.duration, audioInfo.duration);

      // Score based on relative duration difference
      if (relativeDiff <= 0.01) { // Within 1%
        return 1.0;
      } else if (relativeDiff <= 0.02) { // Within 2%
        return 0.9;
      } else if (relativeDiff <= 0.05) { // Within 5%
        return 0.7;
      } else if (relativeDiff <= 0.1) { // Within 10%
        return 0.5;
      } else {
        return 0.2;
      }
    } catch (error) {
      return 0.5; // Default on error
    }
  }

  private identifyQualityIssues(
    metrics: QualityMetrics, 
    issues: QualityIssue[], 
    recommendations: string[]
  ): void {
    // Audio quality issues
    if (metrics.audioQuality < this.thresholds.minAudioQuality) {
      issues.push({
        type: 'audio_quality',
        severity: metrics.audioQuality < 0.5 ? 'high' : 'medium',
        description: `Audio quality score (${metrics.audioQuality.toFixed(2)}) is below threshold (${this.thresholds.minAudioQuality})`
      });
      
      if (metrics.audioQuality < 0.5) {
        recommendations.push('Consider using higher quality TTS settings or alternative voice models');
      } else {
        recommendations.push('Review audio processing parameters and consider audio enhancement filters');
      }
    }

    // Synchronization issues
    if (metrics.synchronizationAccuracy < this.thresholds.minSynchronizationAccuracy) {
      issues.push({
        type: 'synchronization',
        severity: metrics.synchronizationAccuracy < 0.6 ? 'high' : 'medium',
        description: `Synchronization accuracy (${metrics.synchronizationAccuracy.toFixed(2)}) is below threshold (${this.thresholds.minSynchronizationAccuracy})`
      });
      
      recommendations.push('Review timestamp accuracy in SRT file and consider re-processing with adjusted timing parameters');
    }

    // Processing time issues
    if (metrics.processingTime > this.thresholds.maxProcessingTime) {
      issues.push({
        type: 'duration_mismatch',
        severity: 'low',
        description: `Processing time (${Math.round(metrics.processingTime / 1000)}s) exceeded expected threshold (${Math.round(this.thresholds.maxProcessingTime / 1000)}s)`
      });
      
      recommendations.push('Consider optimizing processing pipeline or using more powerful hardware for better performance');
    }

    // Overall score recommendations
    const overallScore = metrics instanceof QualityMetricsImpl ? 
      metrics.getOverallScore() : 
      new QualityMetricsImpl(metrics.audioQuality, metrics.synchronizationAccuracy, metrics.processingTime, metrics.userSatisfaction).getOverallScore();

    if (overallScore < this.thresholds.minOverallScore) {
      recommendations.push('Overall quality is below acceptable standards. Consider re-processing with different parameters or manual review.');
    }
  }

  // Utility method to update thresholds
  updateThresholds(newThresholds: Partial<QualityThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  // Utility method to get current thresholds
  getThresholds(): QualityThresholds {
    return { ...this.thresholds };
  }

  async validateOutput(outputVideo: any): Promise<import('./QualityAssuranceEngine').QualityValidationResult> {
    try {
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (!outputVideo || !outputVideo.path) {
        return {
          passesThreshold: false,
          overallScore: 0,
          issues: ['Output video is missing or invalid'],
          recommendations: ['Ensure video processing completed successfully']
        };
      }

      // Extract audio from output video for analysis
      const tempAudioPath = path.join(process.cwd(), 'temp', `validate_audio_${Date.now()}.wav`);
      
      try {
        await this.ffmpeg.extractAudio(outputVideo.path, tempAudioPath);
        
        // Read audio buffer for quality analysis
        const audioBuffer = await fs.readFile(tempAudioPath);
        
        // Validate audio quality
        const audioQuality = await this.validateAudioQuality(audioBuffer);
        if (audioQuality < this.thresholds.minAudioQuality) {
          issues.push(`Audio quality (${audioQuality.toFixed(2)}) below threshold (${this.thresholds.minAudioQuality})`);
          recommendations.push('Consider using higher quality TTS settings');
        }

        // Get video info for additional validation
        const videoInfo = await this.ffmpeg.getVideoInfo(outputVideo.path);
        if (videoInfo.duration <= 0) {
          issues.push('Output video has invalid duration');
          recommendations.push('Re-process the video with valid input');
        }

        if (videoInfo.width <= 0 || videoInfo.height <= 0) {
          issues.push('Output video has invalid resolution');
          recommendations.push('Check video processing pipeline');
        }

        // Calculate overall score
        let overallScore = audioQuality;
        if (videoInfo.duration > 0 && videoInfo.width > 0 && videoInfo.height > 0) {
          overallScore = Math.min(1, overallScore + 0.2); // Bonus for valid video properties
        }

        const passesThreshold = issues.length === 0 && overallScore >= this.thresholds.minOverallScore;

        // Cleanup temp file
        await fs.unlink(tempAudioPath).catch(() => {});

        return {
          passesThreshold,
          overallScore,
          issues,
          recommendations
        };

      } catch (error) {
        // Cleanup temp file on error
        await fs.unlink(tempAudioPath).catch(() => {});
        throw error;
      }

    } catch (error) {
      console.error('QualityAssuranceEngine.validateOutput error:', error);
      return {
        passesThreshold: false,
        overallScore: 0,
        issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Check video file integrity and processing pipeline']
      };
    }
  }
}
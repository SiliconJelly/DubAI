import { ProcessingPipelineImpl } from '../services/ProcessingPipelineImpl';
import { PipelineConfig } from '../services/ProcessingPipeline';
import { VideoProcessingService } from '../services/VideoProcessingService';
import { TranscriptionService } from '../services/TranscriptionService';
import { TTSRouter } from '../services/TTSRouter';
import { AudioAssemblyService } from '../services/AudioAssemblyService';
import { VideoAssemblyService } from '../services/VideoAssemblyService';
import { QualityAssuranceEngine } from '../services/QualityAssuranceEngine';
import { CostTrackingService } from '../services/CostTrackingService';
import { VideoFileImpl, AudioFileImpl, TranslationResultImpl, AudioSegmentImpl, CostMetricsImpl } from '../models';
import { JobStatus, TTSServiceType } from '../types/common';

// Mock implementations
class MockVideoProcessingService implements VideoProcessingService {
  async extractAudio(videoFile: any): Promise<any> {
    return new AudioFileImpl('audio-1', 'test.wav', '/tmp/test.wav', 'wav', 120, 44100, 2);
  }
  
  async validateVideoFormat(videoFile: any): Promise<any> {
    return { isValid: true, errors: [], warnings: [] };
  }
  
  async cleanupTempFiles(sessionId: string): Promise<void> {
    // Mock cleanup
  }
}

class MockTranscriptionService implements TranscriptionService {
  async transcribeAudio(audioFile: any): Promise<any> {
    return {
      id: 'transcription-1',
      segments: [
        { text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.95 }
      ],
      language: 'en',
      confidence: 0.95
    };
  }
  
  async translateToTarget(transcription: any, targetLang: string): Promise<any> {
    return new TranslationResultImpl(
      'translation-1',
      'Hello world',
      'হ্যালো ওয়ার্ল্ড',
      [
        {
          originalText: 'Hello world',
          translatedText: 'হ্যালো ওয়ার্ল্ড',
          startTime: 0,
          endTime: 2,
          confidence: 0.9
        }
      ],
      'bn'
    );
  }
  
  async translateWithTimestampPreservation(originalAudio: any, transcription: any, targetLang: string): Promise<any> {
    return this.translateToTarget(transcription, targetLang);
  }
  
  async generateSRT(translation: any): Promise<any> {
    return {
      id: 'srt-1',
      content: '1\n00:00:00,000 --> 00:00:02,000\nহ্যালো ওয়ার্ল্ড\n',
      segments: [],
      totalDuration: 2
    };
  }
}

class MockTTSRouter implements TTSRouter {
  async selectTTSService(request: any): Promise<TTSServiceType> {
    return TTSServiceType.GOOGLE_CLOUD;
  }
  
  async generateSpeech(text: string, service: TTSServiceType): Promise<any> {
    return new AudioSegmentImpl(
      'segment-1',
      text,
      Buffer.from('mock-audio-data'),
      0,
      2,
      { languageCode: 'bn', voiceName: 'bn-IN-Standard-A', gender: 'FEMALE', speakingRate: 1, pitch: 0, volumeGainDb: 0 }
    );
  }
  
  async trackUsage(service: TTSServiceType, usage: any): Promise<void> {
    // Mock usage tracking
  }
}

class MockAudioAssemblyService implements AudioAssemblyService {
  async assembleAudioTrack(segments: any[]): Promise<any> {
    return {
      id: 'track-1',
      segments,
      totalDuration: 120,
      sampleRate: 44100,
      channels: 2,
      format: 'wav'
    };
  }
  
  async synchronizeWithTimestamps(audio: any, timestamps: any[]): Promise<any> {
    return audio;
  }
  
  async normalizeAudio(audio: any): Promise<any> {
    return audio;
  }
}

class MockVideoAssemblyService implements VideoAssemblyService {
  async combineVideoAudio(videoFile: any, audioTrack: any): Promise<any> {
    return new VideoFileImpl(
      'output-1',
      'output.mp4',
      '/tmp/output.mp4',
      'mp4',
      120,
      { width: 1920, height: 1080 },
      {
        title: 'Test Video',
        description: 'Test dubbed video',
        duration: 120,
        codec: 'h264',
        bitrate: 5000000,
        frameRate: 30
      }
    );
  }
  
  async preserveVideoQuality(inputVideo: any, outputVideo: any): Promise<void> {
    // Mock quality preservation
  }
  
  async addMetadata(video: any, metadata: any): Promise<any> {
    return video;
  }
}

class MockQualityAssuranceEngine implements QualityAssuranceEngine {
  async validateAudioQuality(audioBuffer: Buffer): Promise<number> {
    return 0.85;
  }
  
  async validateSynchronization(videoFile: string, audioFile: string): Promise<number> {
    return 0.9;
  }
  
  async generateQualityReport(job: any): Promise<any> {
    return {
      jobId: job.id,
      overallScore: 0.87,
      metrics: { audioQuality: 0.85, synchronizationAccuracy: 0.9, processingTime: 30000, userSatisfaction: 0.8 },
      issues: [],
      recommendations: [],
      passedValidation: true
    };
  }
  
  async checkQualityThresholds(metrics: any): Promise<boolean> {
    return true;
  }
  
  async validateOutput(outputVideo: any): Promise<any> {
    return {
      passesThreshold: true,
      overallScore: 0.87,
      issues: [],
      recommendations: []
    };
  }
}

class MockCostTrackingService implements CostTrackingService {
  async trackUsage(service: TTSServiceType, usage: any): Promise<void> {
    // Mock usage tracking
  }
  
  async getCostMetrics(jobId: string): Promise<any> {
    return new CostMetricsImpl(0, 0, 0, 30000, 0.05);
  }
  
  async generateCostReport(startDate: Date, endDate: Date): Promise<any> {
    return {
      totalCost: 0.05,
      breakdown: { googleTTS: 0.02, coquiTTS: 0, compute: 0.03 },
      usage: { totalJobs: 1, totalCharacters: 50, totalComputeTime: 30000 },
      period: { startDate, endDate }
    };
  }
  
  async checkQuotaStatus(service: TTSServiceType): Promise<boolean> {
    return true;
  }
  
  async calculateJobCost(jobId: string): Promise<any> {
    return new CostMetricsImpl(50, 0.02, 0, 30000, 0.05);
  }
}

describe('ProcessingPipelineImpl', () => {
  let pipeline: ProcessingPipelineImpl;
  let config: PipelineConfig;
  let mockServices: {
    videoProcessing: MockVideoProcessingService;
    transcription: MockTranscriptionService;
    ttsRouter: MockTTSRouter;
    audioAssembly: MockAudioAssemblyService;
    videoAssembly: MockVideoAssemblyService;
    qualityAssurance: MockQualityAssuranceEngine;
    costTracking: MockCostTrackingService;
  };

  beforeEach(() => {
    config = {
      maxConcurrentJobs: 2,
      jobTimeoutMs: 300000, // 5 minutes
      retryAttempts: 3,
      tempDirectory: '/tmp',
      enableQualityValidation: true
    };

    mockServices = {
      videoProcessing: new MockVideoProcessingService(),
      transcription: new MockTranscriptionService(),
      ttsRouter: new MockTTSRouter(),
      audioAssembly: new MockAudioAssemblyService(),
      videoAssembly: new MockVideoAssemblyService(),
      qualityAssurance: new MockQualityAssuranceEngine(),
      costTracking: new MockCostTrackingService()
    };

    pipeline = new ProcessingPipelineImpl(
      config,
      mockServices.videoProcessing,
      mockServices.transcription,
      mockServices.ttsRouter,
      mockServices.audioAssembly,
      mockServices.videoAssembly,
      mockServices.qualityAssurance,
      mockServices.costTracking
    );
  });

  describe('processVideo', () => {
    it('should create a processing job successfully', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.inputVideo).toBe(inputVideo);
      expect(job.progress).toBe(0);
      expect(job.costTracking).toBeDefined();
    });

    it('should validate the created job', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      expect(job.validate()).toBe(true);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for existing job', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      const retrievedJob = await pipeline.getJobStatus(job.id);

      expect(retrievedJob).toBe(job);
      expect(retrievedJob.id).toBe(job.id);
    });

    it('should throw error for non-existent job', async () => {
      await expect(pipeline.getJobStatus('non-existent-id')).rejects.toThrow('Job not found: non-existent-id');
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      await pipeline.cancelJob(job.id);

      const cancelledJob = await pipeline.getJobStatus(job.id);
      expect(cancelledJob.status).toBe(JobStatus.CANCELLED);
      expect(cancelledJob.completedAt).toBeDefined();
    });

    it('should throw error when cancelling completed job', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      job.status = JobStatus.COMPLETED;

      await expect(pipeline.cancelJob(job.id)).rejects.toThrow('Cannot cancel job in completed status');
    });

    it('should throw error for non-existent job', async () => {
      await expect(pipeline.cancelJob('non-existent-id')).rejects.toThrow('Job not found: non-existent-id');
    });
  });

  describe('retryJob', () => {
    it('should retry a failed job', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);
      job.markFailed('Test error');

      const retriedJob = await pipeline.retryJob(job.id);

      expect(retriedJob.status).toBe(JobStatus.PENDING);
      expect(retriedJob.progress).toBe(0);
      expect(retriedJob.errorMessage).toBeUndefined();
      expect(retriedJob.completedAt).toBeUndefined();
    });

    it('should throw error when retrying non-failed job', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      await expect(pipeline.retryJob(job.id)).rejects.toThrow('Can only retry failed jobs. Current status: pending');
    });

    it('should throw error for non-existent job', async () => {
      await expect(pipeline.retryJob('non-existent-id')).rejects.toThrow('Job not found: non-existent-id');
    });
  });

  describe('pipeline execution', () => {
    it('should process job through all pipeline steps', async () => {
      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      // Wait for job to be processed (with timeout)
      const timeout = 10000; // 10 seconds
      const startTime = Date.now();
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (Date.now() - startTime > timeout) {
          throw new Error('Job processing timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(job.status).toBe(JobStatus.COMPLETED);
      expect(job.progress).toBe(100);
      expect(job.outputVideo).toBeDefined();
      expect(job.completedAt).toBeDefined();
    }, 15000);

    it('should handle pipeline step failures with retry', async () => {
      // Mock a service to fail initially then succeed
      let callCount = 0;
      jest.spyOn(mockServices.transcription, 'transcribeAudio').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transcription failed');
        }
        return {
          id: 'transcription-1',
          segments: [
            { text: 'Hello world', startTime: 0, endTime: 2, confidence: 0.95 }
          ],
          language: 'en',
          confidence: 0.95
        };
      });

      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      // Wait for job to be processed
      const timeout = 15000; // 15 seconds for retry logic
      const startTime = Date.now();
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (Date.now() - startTime > timeout) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(callCount).toBeGreaterThan(1); // Should have retried
      expect(job.status).toBe(JobStatus.COMPLETED);
    }, 20000);

    it('should fail job after max retry attempts', async () => {
      // Mock a service to always fail
      jest.spyOn(mockServices.transcription, 'transcribeAudio').mockImplementation(async () => {
        throw new Error('Persistent transcription failure');
      });

      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      // Wait for job to fail
      const timeout = 20000; // 20 seconds for retry logic
      const startTime = Date.now();
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (Date.now() - startTime > timeout) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(job.status).toBe(JobStatus.FAILED);
      expect(job.errorMessage).toContain('Persistent transcription failure');
    }, 25000);
  });

  describe('quality validation', () => {
    it('should skip quality validation when disabled', async () => {
      const configWithoutQuality = { ...config, enableQualityValidation: false };
      const pipelineWithoutQuality = new ProcessingPipelineImpl(
        configWithoutQuality,
        mockServices.videoProcessing,
        mockServices.transcription,
        mockServices.ttsRouter,
        mockServices.audioAssembly,
        mockServices.videoAssembly,
        mockServices.qualityAssurance,
        mockServices.costTracking
      );

      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipelineWithoutQuality.processVideo(inputVideo);

      // Wait for job to complete
      const timeout = 10000;
      const startTime = Date.now();
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (Date.now() - startTime > timeout) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(job.status).toBe(JobStatus.COMPLETED);
    }, 15000);

    it('should fail job when quality validation fails', async () => {
      // Mock quality validation to fail
      jest.spyOn(mockServices.qualityAssurance, 'validateOutput').mockImplementation(async () => ({
        passesThreshold: false,
        overallScore: 0.3,
        issues: ['Poor audio quality', 'Synchronization issues'],
        recommendations: ['Improve TTS settings', 'Check timestamp accuracy']
      }));

      const inputVideo = new VideoFileImpl(
        'video-1',
        'test.mp4',
        '/tmp/test.mp4',
        'mp4',
        120,
        { width: 1920, height: 1080 },
        {
          title: 'Test Video',
          description: 'Test video for dubbing',
          duration: 120,
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      const job = await pipeline.processVideo(inputVideo);

      // Wait for job to fail
      const timeout = 15000;
      const startTime = Date.now();
      
      while (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        if (Date.now() - startTime > timeout) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(job.status).toBe(JobStatus.FAILED);
      expect(job.errorMessage).toContain('Quality validation failed');
    }, 20000);
  });
});
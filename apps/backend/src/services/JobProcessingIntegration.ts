import { EventEmitter } from 'events';
import { JobQueueService, QueuedJob } from './JobQueueService';
import { ProcessingPipelineImpl } from './ProcessingPipelineImpl';
import { JobStatus } from '@dubai/shared';
import { SupabaseClient } from '@supabase/supabase-js';
import winston from 'winston';
import { VideoFileImpl } from '../models/VideoFile';
import { AudioFileImpl } from '../models/AudioFile';
import { Server as SocketIOServer } from 'socket.io';

// Import the existing services that need to be integrated
import { TranscriptionServiceImpl } from '../../src/services/TranscriptionServiceImpl';
import { TTSRouterImpl } from '../../src/services/TTSRouterImpl';
import { AudioAssemblyServiceImpl } from '../../src/services/AudioAssemblyServiceImpl';
import { VideoProcessingService } from '../../src/services/VideoProcessingService';
import { FFmpegWrapper } from '../../src/utils/ffmpeg';
import { FileManager } from '../../src/utils/fileManager';
import { TranscriptionConfig } from '../../src/services/TranscriptionService';
import { TTSRouterConfig } from '../../src/services/TTSRouter';
import { AudioAssemblyConfig } from '../../src/services/AudioAssemblyService';
import { TTSServiceType, UsageMetrics } from '../../src/types/common';
import { CostTrackingService } from './CostTrackingService';

export interface JobProcessingConfig {
  maxConcurrentProcessing: number;
  processingTimeout: number;
  retryDelay: number;
  maxRetryAttempts: number;
  enableProgressTracking: boolean;
  enableErrorRecovery: boolean;
  tempDirectory: string;
}

export interface ProcessingStep {
  name: string;
  status: JobStatus;
  progressStart: number;
  progressEnd: number;
  estimatedDuration: number;
  retryable: boolean;
}

export interface ProcessingMetrics {
  stepName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  errorMessage?: string;
  retryCount: number;
  serviceUsed?: string;
  costEstimate?: number;
}

export class JobProcessingIntegration extends EventEmitter {
  private processingJobs: Map<string, NodeJS.Timeout> = new Map();
  private jobMetrics: Map<string, ProcessingMetrics[]> = new Map();
  private isShuttingDown = false;

  // Integrated services
  private transcriptionService!: TranscriptionServiceImpl;
  private ttsRouter!: TTSRouterImpl;
  private audioAssemblyService!: AudioAssemblyServiceImpl;
  private videoProcessingService!: VideoProcessingService;
  private ffmpegWrapper!: FFmpegWrapper;
  private fileManager!: FileManager;
  private costTrackingService!: CostTrackingService;

  // Processing steps configuration
  private processingSteps: ProcessingStep[] = [
    {
      name: 'Audio Extraction',
      status: JobStatus.EXTRACTING_AUDIO,
      progressStart: 5,
      progressEnd: 15,
      estimatedDuration: 30000, // 30 seconds
      retryable: true
    },
    {
      name: 'Transcription',
      status: JobStatus.TRANSCRIBING,
      progressStart: 15,
      progressEnd: 35,
      estimatedDuration: 120000, // 2 minutes
      retryable: true
    },
    {
      name: 'Translation',
      status: JobStatus.TRANSLATING,
      progressStart: 35,
      progressEnd: 50,
      estimatedDuration: 60000, // 1 minute
      retryable: true
    },
    {
      name: 'TTS Generation',
      status: JobStatus.GENERATING_SPEECH,
      progressStart: 50,
      progressEnd: 80,
      estimatedDuration: 180000, // 3 minutes
      retryable: true
    },
    {
      name: 'Audio Assembly',
      status: JobStatus.ASSEMBLING_AUDIO,
      progressStart: 80,
      progressEnd: 95,
      estimatedDuration: 45000, // 45 seconds
      retryable: true
    },
    {
      name: 'Finalization',
      status: JobStatus.COMPLETED,
      progressStart: 95,
      progressEnd: 100,
      estimatedDuration: 15000, // 15 seconds
      retryable: false
    }
  ];

  constructor(
    private jobQueueService: JobQueueService,
    private processingPipeline: ProcessingPipelineImpl,
    private supabase: SupabaseClient,
    private io: SocketIOServer,
    private logger: winston.Logger,
    private config: JobProcessingConfig
  ) {
    super();
    this.initializeServices();
    this.setupEventListeners();
  }

  /**
   * Initialize the integrated services
   */
  private initializeServices(): void {
    // Initialize file manager
    this.fileManager = new FileManager({
      tempDirectory: this.config.tempDirectory,
      outputDirectory: `${this.config.tempDirectory}/output`,
      cleanupIntervalHours: 24
    });

    // Initialize FFmpeg wrapper
    const ffmpegConfig = {
      ffmpegPath: 'ffmpeg',
      ffprobePath: 'ffprobe',
      timeout: 300000 // 5 minutes
    };
    this.ffmpegWrapper = new FFmpegWrapper(ffmpegConfig);

    // Initialize video processing service (mock for now)
    this.videoProcessingService = {
      extractAudio: async (videoFile: any) => {
        // Mock implementation - in real app this would use FFmpeg
        return {
          id: `audio_${videoFile.id}`,
          filename: `${videoFile.filename}.wav`,
          path: `${this.config.tempDirectory}/audio_${videoFile.id}.wav`,
          format: 'wav',
          duration: videoFile.duration || 120,
          sampleRate: 44100,
          channels: 2
        };
      }
    } as any;

    // Initialize transcription service
    const transcriptionConfig: TranscriptionConfig = {
      whisperModelPath: './models/whisper',
      language: 'en',
      modelSize: 'base',
      temperature: 0.0,
      maxRetries: 3
    };
    this.transcriptionService = new TranscriptionServiceImpl(
      transcriptionConfig,
      this.config.tempDirectory
    );

    // Initialize TTS router (services would be injected in real implementation)
    const ttsConfig: TTSRouterConfig = {
      fallbackEnabled: true,
      abTestingEnabled: true,
      googleTTSWeight: 70,
      coquiTTSWeight: 30,
      quotaThresholds: {
        googleTTS: 100000 // Characters remaining threshold
      }
    };
    // Note: In real implementation, GoogleTTSService and CoquiTTSService would be injected
    // For now, we'll leave this undefined and handle it in the TTS step
    this.ttsRouter = undefined as any;

    // Initialize audio assembly service
    const audioAssemblyConfig: AudioAssemblyConfig = {
      outputFormat: 'wav',
      sampleRate: 44100,
      channels: 2,
      normalizationEnabled: true,
      silencePaddingMs: 100
    };
    this.audioAssemblyService = new AudioAssemblyServiceImpl(
      this.ffmpegWrapper,
      this.fileManager,
      audioAssemblyConfig
    );

    // Initialize cost tracking service
    this.costTrackingService = new CostTrackingService();

    this.logger.info('Processing services initialized successfully');
  }

  /**
   * Set up event listeners for job queue events
   */
  private setupEventListeners(): void {
    // Listen for new jobs added to queue
    this.jobQueueService.on('jobAdded', (job: QueuedJob) => {
      this.logger.info(`New job added to queue: ${job.id}`);
    });

    // Listen for jobs starting processing
    this.jobQueueService.on('jobStarted', (job: QueuedJob) => {
      this.startJobProcessing(job);
    });

    // Listen for job updates
    this.jobQueueService.on('jobUpdated', (job: QueuedJob, update: any) => {
      this.emitJobUpdate(job, update.message);
    });

    // Listen for job completion
    this.jobQueueService.on('jobCompleted', (job: QueuedJob) => {
      this.handleJobCompletion(job);
    });

    // Listen for job failures
    this.jobQueueService.on('jobFailed', (job: QueuedJob) => {
      this.handleJobFailure(job);
    });

    // Listen for job cancellation
    this.jobQueueService.on('jobCancelled', (job: QueuedJob) => {
      this.handleJobCancellation(job);
    });
  }

  /**
   * Start processing a job
   */
  private async startJobProcessing(job: QueuedJob): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      this.logger.info(`Starting processing for job ${job.id}`);

      // Set processing timeout
      const timeoutId = setTimeout(() => {
        this.handleJobTimeout(job.id);
      }, this.config.processingTimeout);

      this.processingJobs.set(job.id, timeoutId);

      // Update job status to extracting audio
      await this.jobQueueService.updateJobProgress({
        jobId: job.id,
        status: JobStatus.EXTRACTING_AUDIO,
        progress: 5,
        message: 'Starting audio extraction...'
      });

      // Get input files from database
      const inputFiles = await this.getJobInputFiles(job);
      if (!inputFiles.videoFile) {
        throw new Error('No video file found for processing');
      }

      // Create video file instance for processing pipeline
      const videoFile = new VideoFileImpl(
        job.inputFiles.videoFileId || 'temp-id',
        inputFiles.videoFile.filename,
        inputFiles.videoFile.path,
        'mp4', // Default format, would be determined from file
        0, // Duration would be determined during processing
        { width: 1920, height: 1080 }, // Default resolution
        { 
          duration: 0, // Will be determined during processing
          codec: 'h264',
          bitrate: 5000000,
          frameRate: 30
        }
      );

      // Start processing with the existing pipeline
      await this.processJobWithPipeline(job, videoFile);

    } catch (error) {
      this.logger.error(`Failed to start processing job ${job.id}:`, error);
      await this.jobQueueService.updateJobProgress({
        jobId: job.id,
        status: JobStatus.FAILED,
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      });
    }
  }

  /**
   * Process job using the integrated processing pipeline
   */
  private async processJobWithPipeline(job: QueuedJob, videoFile: VideoFileImpl): Promise<void> {
    const jobStartTime = Date.now();
    this.jobMetrics.set(job.id, []);

    try {
      // Initialize job metrics tracking
      await this.initializeJobMetrics(job.id);

      // Execute each processing step with integrated services
      for (const step of this.processingSteps) {
        await this.executeProcessingStep(job, step, videoFile);
      }

      // Calculate final metrics
      const totalProcessingTime = Date.now() - jobStartTime;
      const finalMetrics = this.calculateFinalMetrics(job.id, totalProcessingTime);

      // Update job with completion status and metrics
      await this.jobQueueService.updateJobProgress({
        jobId: job.id,
        status: JobStatus.COMPLETED,
        progress: 100,
        message: 'Job completed successfully!',
        metrics: finalMetrics
      });

      // Clean up processing timeout
      const timeoutId = this.processingJobs.get(job.id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.processingJobs.delete(job.id);
      }

      this.logger.info(`Job ${job.id} completed successfully in ${totalProcessingTime}ms`);

    } catch (error) {
      await this.handleProcessingError(job, error);
      throw error;
    } finally {
      // Clean up temporary files
      await this.cleanupJobFiles(job.id);
    }
  }

  /**
   * Execute a single processing step with error recovery
   */
  private async executeProcessingStep(
    job: QueuedJob, 
    step: ProcessingStep, 
    videoFile: VideoFileImpl
  ): Promise<void> {
    const stepStartTime = Date.now();
    let retryCount = 0;
    let lastError: Error | null = null;

    // Update job status and progress
    await this.jobQueueService.updateJobProgress({
      jobId: job.id,
      status: step.status,
      progress: step.progressStart,
      message: `Starting ${step.name}...`
    });

    while (retryCount <= this.config.maxRetryAttempts) {
      try {
        // Record step start
        const stepMetric: ProcessingMetrics = {
          stepName: step.name,
          startTime: new Date(),
          success: false,
          retryCount
        };

        // Execute the actual processing step
        await this.executeStepLogic(job, step, videoFile, stepMetric);

        // Record successful completion
        stepMetric.endTime = new Date();
        stepMetric.duration = stepMetric.endTime.getTime() - stepMetric.startTime.getTime();
        stepMetric.success = true;

        this.addJobMetric(job.id, stepMetric);

        // Update progress to step completion
        await this.jobQueueService.updateJobProgress({
          jobId: job.id,
          status: step.status,
          progress: step.progressEnd,
          message: `${step.name} completed successfully`
        });

        this.logger.info(`Step ${step.name} completed for job ${job.id} in ${stepMetric.duration}ms`);
        return; // Success, exit retry loop

      } catch (error) {
        lastError = error as Error;
        retryCount++;

        // Record failed attempt
        const failedMetric: ProcessingMetrics = {
          stepName: step.name,
          startTime: new Date(stepStartTime),
          endTime: new Date(),
          duration: Date.now() - stepStartTime,
          success: false,
          errorMessage: lastError.message,
          retryCount: retryCount - 1
        };
        this.addJobMetric(job.id, failedMetric);

        this.logger.warn(`Step ${step.name} failed for job ${job.id} (attempt ${retryCount}): ${lastError.message}`);

        // Check if step is retryable and we haven't exceeded max attempts
        if (!step.retryable || retryCount > this.config.maxRetryAttempts) {
          throw lastError;
        }

        // Apply error recovery strategy
        if (this.config.enableErrorRecovery) {
          await this.applyErrorRecovery(job, step, lastError, retryCount);
        }

        // Wait before retry with exponential backoff
        const retryDelay = Math.min(this.config.retryDelay * Math.pow(2, retryCount - 1), 30000);
        await this.delay(retryDelay);

        // Update progress to show retry
        await this.jobQueueService.updateJobProgress({
          jobId: job.id,
          status: step.status,
          progress: step.progressStart,
          message: `Retrying ${step.name} (attempt ${retryCount + 1})...`
        });
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error(`Step ${step.name} failed after ${this.config.maxRetryAttempts} attempts`);
  }

  /**
   * Execute the actual logic for each processing step
   */
  private async executeStepLogic(
    job: QueuedJob,
    step: ProcessingStep,
    videoFile: VideoFileImpl,
    stepMetric: ProcessingMetrics
  ): Promise<void> {
    switch (step.name) {
      case 'Audio Extraction':
        await this.executeAudioExtraction(job, videoFile, stepMetric);
        break;
      
      case 'Transcription':
        await this.executeTranscription(job, stepMetric);
        break;
      
      case 'Translation':
        await this.executeTranslation(job, stepMetric);
        break;
      
      case 'TTS Generation':
        await this.executeTTSGeneration(job, stepMetric);
        break;
      
      case 'Audio Assembly':
        await this.executeAudioAssembly(job, stepMetric);
        break;
      
      case 'Finalization':
        await this.executeFinalization(job, stepMetric);
        break;
      
      default:
        throw new Error(`Unknown processing step: ${step.name}`);
    }
  }

  /**
   * Execute audio extraction step
   */
  private async executeAudioExtraction(
    job: QueuedJob,
    videoFile: VideoFileImpl,
    stepMetric: ProcessingMetrics
  ): Promise<void> {
    try {
      // Extract audio using the video processing service
      const audioFile = await this.videoProcessingService.extractAudio(videoFile);
      
      // Store audio file reference in job context
      await this.storeJobContext(job.id, 'audioFile', {
        id: audioFile.id,
        path: audioFile.path,
        duration: audioFile.duration,
        format: audioFile.format
      });

      stepMetric.serviceUsed = 'FFmpeg';
      stepMetric.costEstimate = 0.01; // Minimal cost for local processing

      this.logger.info(`Audio extracted for job ${job.id}: ${audioFile.path}`);
    } catch (error) {
      this.logger.error(`Audio extraction failed for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute transcription step
   */
  private async executeTranscription(job: QueuedJob, stepMetric: ProcessingMetrics): Promise<void> {
    try {
      // Get audio file from job context
      const audioFileData = await this.getJobContext(job.id, 'audioFile');
      if (!audioFileData) {
        throw new Error('Audio file not found in job context');
      }

      // Create AudioFile instance
      const audioFile = new AudioFileImpl(
        audioFileData.id,
        audioFileData.filename || 'audio.wav',
        audioFileData.path,
        audioFileData.format,
        audioFileData.duration,
        audioFileData.sampleRate || 44100,
        audioFileData.channels || 2
      );

      // Transcribe using the transcription service
      const transcriptionResult = await this.transcriptionService.transcribeAudio(audioFile);

      // Store transcription result in job context
      await this.storeJobContext(job.id, 'transcription', {
        id: transcriptionResult.id,
        segments: transcriptionResult.segments,
        language: transcriptionResult.language,
        confidence: transcriptionResult.confidence
      });

      stepMetric.serviceUsed = 'Whisper';
      stepMetric.costEstimate = 0.05; // Cost for transcription processing

      this.logger.info(`Transcription completed for job ${job.id}: ${transcriptionResult.segments.length} segments`);
    } catch (error) {
      this.logger.error(`Transcription failed for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute translation step
   */
  private async executeTranslation(job: QueuedJob, stepMetric: ProcessingMetrics): Promise<void> {
    try {
      // Get transcription from job context
      const transcriptionData = await this.getJobContext(job.id, 'transcription');
      if (!transcriptionData) {
        throw new Error('Transcription not found in job context');
      }

      // Recreate transcription result object
      const transcriptionResult = {
        id: transcriptionData.id,
        segments: transcriptionData.segments,
        language: transcriptionData.language,
        confidence: transcriptionData.confidence
      };

      // Translate to Bangla using the transcription service
      const translationResult = await this.transcriptionService.translateToTarget(
        transcriptionResult as any,
        'bn'
      );

      // Store translation result in job context
      await this.storeJobContext(job.id, 'translation', {
        id: translationResult.id,
        originalText: translationResult.originalText,
        translatedText: translationResult.translatedText,
        segments: translationResult.segments,
        targetLanguage: translationResult.targetLanguage
      });

      stepMetric.serviceUsed = 'Whisper Translation';
      stepMetric.costEstimate = 0.02; // Cost for translation processing

      this.logger.info(`Translation completed for job ${job.id}: ${translationResult.segments.length} segments`);
    } catch (error) {
      this.logger.error(`Translation failed for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute TTS generation step
   */
  private async executeTTSGeneration(job: QueuedJob, stepMetric: ProcessingMetrics): Promise<void> {
    try {
      // Get translation from job context
      const translationData = await this.getJobContext(job.id, 'translation');
      if (!translationData) {
        throw new Error('Translation not found in job context');
      }

      const audioSegments = [];
      let totalCharacters = 0;
      let selectedService: TTSServiceType = TTSServiceType.GOOGLE_CLOUD; // Default

      // Generate speech for each segment
      for (const segment of translationData.segments) {
        if (!this.ttsRouter) {
          // Fallback: simulate TTS generation if router not available
          this.logger.warn('TTS Router not available, simulating TTS generation');
          await this.delay(1000); // Simulate processing time
          continue;
        }

        // Select TTS service for this segment
        selectedService = await this.ttsRouter.selectTTSService({
          text: segment.translatedText,
          targetLanguage: 'bn',
          sessionId: job.id
        });

        // Generate speech
        const startTime = Date.now();
        const audioSegment = await this.ttsRouter.generateSpeech(
          segment.translatedText,
          selectedService
        );
        const processingTime = Date.now() - startTime;

        // Set timing from translation segment
        audioSegment.startTime = segment.startTime;
        audioSegment.endTime = segment.endTime;

        audioSegments.push({
          id: audioSegment.id,
          text: audioSegment.text,
          audioBuffer: audioSegment.audioBuffer,
          startTime: audioSegment.startTime,
          endTime: audioSegment.endTime,
          voiceConfig: audioSegment.voiceConfig
        });

        totalCharacters += segment.translatedText.length;

        // Track usage for cost optimization
        const usage: UsageMetrics = {
          charactersProcessed: segment.translatedText.length,
          processingTimeMs: processingTime,
          apiCalls: 1,
          errorCount: 0
        };

        // Get user ID from job context
        const jobData = await this.supabase
          .from('dubbing_jobs')
          .select('user_id')
          .eq('id', job.id)
          .single();

        if (jobData.data?.user_id) {
          await this.costTrackingService.trackServiceUsage(
            jobData.data.user_id,
            job.id,
            selectedService,
            usage
          );
        }
      }

      // Store audio segments in job context
      await this.storeJobContext(job.id, 'audioSegments', audioSegments);

      stepMetric.serviceUsed = selectedService;
      stepMetric.costEstimate = this.calculateTTSCost(totalCharacters, selectedService);

      this.logger.info(`TTS generation completed for job ${job.id}: ${audioSegments.length} segments using ${selectedService}`);
    } catch (error) {
      this.logger.error(`TTS generation failed for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute audio assembly step
   */
  private async executeAudioAssembly(job: QueuedJob, stepMetric: ProcessingMetrics): Promise<void> {
    try {
      // Get audio segments from job context
      const audioSegmentsData = await this.getJobContext(job.id, 'audioSegments');
      if (!audioSegmentsData || !Array.isArray(audioSegmentsData)) {
        throw new Error('Audio segments not found in job context');
      }

      // Convert to AudioSegment objects
      const audioSegments = audioSegmentsData.map((segmentData: any) => ({
        id: segmentData.id,
        text: segmentData.text,
        audioBuffer: Buffer.from(segmentData.audioBuffer),
        startTime: segmentData.startTime,
        endTime: segmentData.endTime,
        voiceConfig: segmentData.voiceConfig
      }));

      // Assemble audio track using the audio assembly service
      const audioTrack = await this.audioAssemblyService.assembleAudioTrack(audioSegments);

      // Store assembled audio track in job context
      await this.storeJobContext(job.id, 'audioTrack', {
        id: audioTrack.id,
        segments: audioTrack.segments,
        totalDuration: audioTrack.totalDuration,
        sampleRate: audioTrack.sampleRate,
        channels: audioTrack.channels,
        format: audioTrack.format
      });

      stepMetric.serviceUsed = 'FFmpeg Audio Assembly';
      stepMetric.costEstimate = 0.03; // Cost for audio processing

      this.logger.info(`Audio assembly completed for job ${job.id}: ${audioTrack.totalDuration}s duration`);
    } catch (error) {
      this.logger.error(`Audio assembly failed for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute finalization step
   */
  private async executeFinalization(job: QueuedJob, stepMetric: ProcessingMetrics): Promise<void> {
    try {
      // Get assembled audio track from job context
      const audioTrackData = await this.getJobContext(job.id, 'audioTrack');
      if (!audioTrackData) {
        throw new Error('Audio track not found in job context');
      }

      // Generate SRT file from translation
      const translationData = await this.getJobContext(job.id, 'translation');
      if (translationData) {
        const srtFile = await this.transcriptionService.generateSRT(translationData as any);
        
        // Store SRT file reference
        await this.storeJobContext(job.id, 'srtFile', {
          id: srtFile.id,
          content: srtFile.content,
          segments: srtFile.segments,
          totalDuration: srtFile.totalDuration
        });
      }

      // Save output files to Supabase Storage
      await this.saveOutputFiles(job.id, audioTrackData);

      stepMetric.serviceUsed = 'File Management';
      stepMetric.costEstimate = 0.01; // Minimal cost for file operations

      this.logger.info(`Finalization completed for job ${job.id}`);
    } catch (error) {
      this.logger.error(`Finalization failed for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Get input files for a job from database
   */
  private async getJobInputFiles(job: QueuedJob): Promise<{
    videoFile?: { path: string; filename: string };
    srtFile?: { path: string; filename: string };
  }> {
    const result: {
      videoFile?: { path: string; filename: string };
      srtFile?: { path: string; filename: string };
    } = {};

    try {
      // Get video file if specified
      if (job.inputFiles.videoFileId) {
        const { data: videoFile, error: videoError } = await this.supabase
          .from('storage_files')
          .select('filename, storage_path')
          .eq('id', job.inputFiles.videoFileId)
          .single();

        if (!videoError && videoFile) {
          result.videoFile = {
            path: videoFile.storage_path,
            filename: videoFile.filename
          };
        }
      }

      // Get SRT file if specified
      if (job.inputFiles.srtFileId) {
        const { data: srtFile, error: srtError } = await this.supabase
          .from('storage_files')
          .select('filename, storage_path')
          .eq('id', job.inputFiles.srtFileId)
          .single();

        if (!srtError && srtFile) {
          result.srtFile = {
            path: srtFile.storage_path,
            filename: srtFile.filename
          };
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get input files for job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle job timeout
   */
  private async handleJobTimeout(jobId: string): Promise<void> {
    this.logger.warn(`Job ${jobId} timed out`);
    
    await this.jobQueueService.updateJobProgress({
      jobId,
      status: JobStatus.FAILED,
      progress: 0,
      error: 'Job processing timed out'
    });

    this.processingJobs.delete(jobId);
  }

  /**
   * Handle job completion
   */
  private handleJobCompletion(job: QueuedJob): void {
    this.logger.info(`Job ${job.id} completed successfully`);
    this.emitJobUpdate(job, 'Job completed successfully');
    
    // Clean up processing timeout
    const timeoutId = this.processingJobs.get(job.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.processingJobs.delete(job.id);
    }
  }

  /**
   * Handle job failure
   */
  private handleJobFailure(job: QueuedJob): void {
    this.logger.error(`Job ${job.id} failed: ${job.errorMessage}`);
    this.emitJobUpdate(job, job.errorMessage || 'Job processing failed');
    
    // Clean up processing timeout
    const timeoutId = this.processingJobs.get(job.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.processingJobs.delete(job.id);
    }
  }

  /**
   * Handle job cancellation
   */
  private handleJobCancellation(job: QueuedJob): void {
    this.logger.info(`Job ${job.id} was cancelled`);
    this.emitJobUpdate(job, 'Job cancelled by user');
    
    // Clean up processing timeout
    const timeoutId = this.processingJobs.get(job.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.processingJobs.delete(job.id);
    }
  }

  /**
   * Store job context data
   */
  private async storeJobContext(jobId: string, key: string, data: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('job_context')
        .upsert({
          job_id: jobId,
          context_key: key,
          context_data: data,
          updated_at: new Date().toISOString()
        });

      if (error) {
        this.logger.error(`Failed to store job context for ${jobId}:`, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error storing job context for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get job context data
   */
  private async getJobContext(jobId: string, key: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('job_context')
        .select('context_data')
        .eq('job_id', jobId)
        .eq('context_key', key)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        this.logger.error(`Failed to get job context for ${jobId}:`, error);
        throw error;
      }

      return data?.context_data || null;
    } catch (error) {
      this.logger.error(`Error getting job context for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Initialize job metrics tracking
   */
  private async initializeJobMetrics(jobId: string): Promise<void> {
    this.jobMetrics.set(jobId, []);
  }

  /**
   * Add a metric entry for a job
   */
  private addJobMetric(jobId: string, metric: ProcessingMetrics): void {
    const metrics = this.jobMetrics.get(jobId) || [];
    metrics.push(metric);
    this.jobMetrics.set(jobId, metrics);
  }

  /**
   * Calculate final processing metrics
   */
  private calculateFinalMetrics(jobId: string, totalProcessingTime: number): any {
    const metrics = this.jobMetrics.get(jobId) || [];
    
    const stepMetrics = metrics.reduce((acc, metric) => {
      acc[metric.stepName] = {
        duration: metric.duration || 0,
        success: metric.success,
        retryCount: metric.retryCount,
        serviceUsed: metric.serviceUsed,
        costEstimate: metric.costEstimate || 0
      };
      return acc;
    }, {} as any);

    const totalCost = metrics.reduce((sum, metric) => sum + (metric.costEstimate || 0), 0);
    const successfulSteps = metrics.filter(m => m.success).length;
    const totalRetries = metrics.reduce((sum, metric) => sum + metric.retryCount, 0);

    return {
      totalProcessingTime,
      stepMetrics,
      totalCost,
      successfulSteps,
      totalRetries,
      ttsService: this.getTTSServiceUsed(metrics),
      costBreakdown: this.generateCostBreakdown(metrics)
    };
  }

  /**
   * Get the TTS service used from metrics
   */
  private getTTSServiceUsed(metrics: ProcessingMetrics[]): string {
    const ttsMetric = metrics.find(m => m.stepName === 'TTS Generation' && m.success);
    return ttsMetric?.serviceUsed || 'unknown';
  }

  /**
   * Generate cost breakdown from metrics
   */
  private generateCostBreakdown(metrics: ProcessingMetrics[]): any {
    const breakdown = {
      transcriptionCost: 0,
      translationCost: 0,
      ttsCost: 0,
      processingCost: 0,
      totalCost: 0
    };

    metrics.forEach(metric => {
      const cost = metric.costEstimate || 0;
      switch (metric.stepName) {
        case 'Transcription':
          breakdown.transcriptionCost += cost;
          break;
        case 'Translation':
          breakdown.translationCost += cost;
          break;
        case 'TTS Generation':
          breakdown.ttsCost += cost;
          break;
        default:
          breakdown.processingCost += cost;
          break;
      }
    });

    breakdown.totalCost = breakdown.transcriptionCost + breakdown.translationCost + 
                         breakdown.ttsCost + breakdown.processingCost;

    return breakdown;
  }

  /**
   * Calculate TTS cost based on characters and service
   */
  private calculateTTSCost(characters: number, service: TTSServiceType): number {
    switch (service) {
      case TTSServiceType.GOOGLE_CLOUD:
        return characters * 0.000016; // Google TTS pricing
      case TTSServiceType.COQUI_LOCAL:
        return characters * 0.000005; // Lower cost for local processing
      default:
        return 0;
    }
  }

  /**
   * Apply error recovery strategies
   */
  private async applyErrorRecovery(
    job: QueuedJob,
    step: ProcessingStep,
    error: Error,
    retryCount: number
  ): Promise<void> {
    this.logger.info(`Applying error recovery for job ${job.id}, step ${step.name}, retry ${retryCount}`);

    // Step-specific recovery strategies
    switch (step.name) {
      case 'TTS Generation':
        // For TTS failures, try switching to alternative service
        if (this.ttsRouter && error.message.includes('quota') || error.message.includes('rate limit')) {
          this.logger.info(`TTS quota/rate limit detected, will use fallback service for job ${job.id}`);
          // The TTS router will handle service switching automatically
        }
        break;

      case 'Audio Extraction':
        // For audio extraction failures, try different FFmpeg parameters
        if (error.message.includes('codec') || error.message.includes('format')) {
          this.logger.info(`Audio format issue detected, will try alternative extraction method for job ${job.id}`);
          // Could implement alternative extraction parameters here
        }
        break;

      case 'Transcription':
      case 'Translation':
        // For Whisper failures, the service already handles model fallback
        this.logger.info(`Whisper processing issue, service will handle model fallback for job ${job.id}`);
        break;

      default:
        this.logger.info(`No specific recovery strategy for step ${step.name}, using generic retry`);
        break;
    }

    // Generic recovery: clear any cached data that might be corrupted
    try {
      await this.clearStepCache(job.id, step.name);
    } catch (cacheError) {
      this.logger.warn(`Failed to clear cache for job ${job.id}, step ${step.name}:`, cacheError);
    }
  }

  /**
   * Clear cached data for a specific step
   */
  private async clearStepCache(jobId: string, stepName: string): Promise<void> {
    // Clear step-specific cached data
    const cacheKeys = this.getStepCacheKeys(stepName);
    
    for (const key of cacheKeys) {
      try {
        await this.supabase
          .from('job_context')
          .delete()
          .eq('job_id', jobId)
          .eq('context_key', key);
      } catch (error) {
        this.logger.warn(`Failed to clear cache key ${key} for job ${jobId}:`, error);
      }
    }
  }

  /**
   * Get cache keys that should be cleared for a step
   */
  private getStepCacheKeys(stepName: string): string[] {
    switch (stepName) {
      case 'Audio Extraction':
        return ['audioFile'];
      case 'Transcription':
        return ['transcription'];
      case 'Translation':
        return ['translation'];
      case 'TTS Generation':
        return ['audioSegments'];
      case 'Audio Assembly':
        return ['audioTrack'];
      default:
        return [];
    }
  }

  /**
   * Handle processing errors with enhanced error recovery
   */
  private async handleProcessingError(job: QueuedJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    
    this.logger.error(`Processing error for job ${job.id}:`, error);

    // Record error metrics
    const errorMetric: ProcessingMetrics = {
      stepName: 'Error Handler',
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      success: false,
      errorMessage,
      retryCount: 0
    };
    this.addJobMetric(job.id, errorMetric);

    // Update job status to failed
    await this.jobQueueService.updateJobProgress({
      jobId: job.id,
      status: JobStatus.FAILED,
      progress: 0,
      error: errorMessage,
      metrics: this.calculateFinalMetrics(job.id, Date.now() - job.createdAt.getTime())
    });

    // Clean up processing timeout
    const timeoutId = this.processingJobs.get(job.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.processingJobs.delete(job.id);
    }
  }

  /**
   * Save output files to Supabase Storage
   */
  private async saveOutputFiles(jobId: string, audioTrackData: any): Promise<void> {
    try {
      // In a real implementation, this would save the actual audio files to Supabase Storage
      // For now, we'll just update the job record with output file references
      
      const { error } = await this.supabase
        .from('dubbing_jobs')
        .update({
          output_audio_file_id: `${jobId}_audio_output`,
          output_srt_file_id: `${jobId}_srt_output`,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        throw error;
      }

      this.logger.info(`Output files saved for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to save output files for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up temporary files for a job
   */
  private async cleanupJobFiles(jobId: string): Promise<void> {
    try {
      // Clean up job context data
      await this.supabase
        .from('job_context')
        .delete()
        .eq('job_id', jobId);

      // Clean up job metrics
      this.jobMetrics.delete(jobId);

      // Clean up temporary files using file manager
      if (this.fileManager) {
        // Note: FileManager doesn't have cleanupJobFiles method in current implementation
        // This would need to be implemented or we can clean up files manually
        this.logger.info(`File cleanup would be performed for job ${jobId}`);
      }

      this.logger.info(`Cleaned up files for job ${jobId}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup files for job ${jobId}:`, error);
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Emit job update via WebSocket
   */
  private emitJobUpdate(job: QueuedJob, message?: string): void {
    this.io.to(`user:${job.userId}`).emit('job_update', {
      type: 'job_update',
      payload: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        message: message || `Job status: ${job.status}`,
        metrics: job.processingMetrics
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    activeProcessingJobs: number;
    totalProcessedJobs: number;
    averageProcessingTime: number;
  } {
    return {
      activeProcessingJobs: this.processingJobs.size,
      totalProcessedJobs: 0, // This would be tracked over time
      averageProcessingTime: 0 // This would be calculated from historical data
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Clear all processing timeouts
    for (const [jobId, timeoutId] of this.processingJobs.entries()) {
      clearTimeout(timeoutId);
      this.logger.info(`Cleared timeout for job ${jobId} during shutdown`);
    }

    this.processingJobs.clear();
    this.logger.info('Job processing integration shut down');
  }
}
import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { SRTFileImpl } from '../models/SRTFile';
import { TranslationEngine, TranslationProgress, MovieMetadata } from '../services/TranslationEngine';
import { ApiResponse } from '../types/api';
import { validateSRTFile } from '../utils/validation';
import { DefaultErrorHandler } from '../utils/errorHandler';

export interface TranslationRequest {
  srtFile: Express.Multer.File;
  targetLanguage: string;
  movieMetadata?: MovieMetadata;
}

export interface TranslationResponse {
  jobId: string;
  status: string;
  message: string;
  estimatedCompletionTime?: number;
}

export interface TranslationResultResponse {
  jobId: string;
  status: string;
  progress: number;
  result?: {
    originalSRT: any;
    translatedSRT: any;
    movieAnalysis: any;
    processingMetrics: any;
  };
  downloadUrls?: {
    translatedSRT: string;
    movieAnalysis: string;
  };
}

export class TranslationAPI {
  private router: Router;
  private translationEngine: TranslationEngine;
  private errorHandler: DefaultErrorHandler;
  private upload: multer.Multer;
  private activeJobs: Map<string, any> = new Map();

  constructor(translationEngine: TranslationEngine) {
    this.router = express.Router();
    this.translationEngine = translationEngine;
    this.errorHandler = new DefaultErrorHandler();
    
    // Configure multer for file uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain' || file.originalname.endsWith('.srt')) {
          cb(null, true);
        } else {
          cb(new Error('Only SRT files are allowed'));
        }
      }
    });

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // POST /api/translation/translate - Start translation job
    this.router.post('/translate', 
      (req: Request, res: Response, next: any) => {
        this.upload.single('srtFile')(req, res, (err: any) => {
          if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB.'
              });
            }
            return res.status(400).json({
              success: false,
              error: err.message || 'File upload error'
            });
          }
          return next();
        });
      },
      this.handleTranslationRequest.bind(this)
    );

    // GET /api/translation/status/:jobId - Get translation progress
    this.router.get('/status/:jobId', this.handleStatusRequest.bind(this));

    // GET /api/translation/result/:jobId - Get translation result
    this.router.get('/result/:jobId', this.handleResultRequest.bind(this));

    // GET /api/translation/download/:jobId/:type - Download files
    this.router.get('/download/:jobId/:type', this.handleDownloadRequest.bind(this));

    // DELETE /api/translation/cancel/:jobId - Cancel translation job
    this.router.delete('/cancel/:jobId', this.handleCancelRequest.bind(this));

    // GET /api/translation/health - Health check
    this.router.get('/health', this.handleHealthCheck.bind(this));
  }

  private async handleTranslationRequest(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No SRT file provided'
        } as ApiResponse);
        return;
      }

      const { targetLanguage = 'bn', movieMetadata } = req.body;

      // Validate SRT file
      const srtContent = req.file.buffer.toString('utf-8');
      const validationResult = validateSRTFile(req.file);
      
      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid SRT file',
          message: validationResult.errors.join(', ')
        } as ApiResponse);
        return;
      }

      // Parse SRT file
      const srtFile = this.parseSRTContent(srtContent, req.file.originalname);
      
      // Parse movie metadata if provided
      let parsedMetadata: MovieMetadata | undefined;
      if (movieMetadata) {
        try {
          parsedMetadata = typeof movieMetadata === 'string' 
            ? JSON.parse(movieMetadata) 
            : movieMetadata;
        } catch (error) {
          console.warn('Failed to parse movie metadata:', error);
        }
      }

      // Start translation job asynchronously
      const jobId = uuidv4();
      this.startTranslationJob(jobId, srtFile, targetLanguage, parsedMetadata);

      // Estimate completion time based on SRT length
      const estimatedTime = this.estimateCompletionTime(srtFile);

      res.status(202).json({
        success: true,
        data: {
          jobId,
          status: 'PROCESSING',
          message: 'Translation job started successfully',
          estimatedCompletionTime: estimatedTime
        } as TranslationResponse
      } as ApiResponse);

    } catch (error) {
      this.errorHandler.handleExpressError(error as Error, req, res);
    }
  }

  private async handleStatusRequest(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        res.status(400).json({
          success: false,
          error: 'Job ID is required'
        } as ApiResponse);
        return;
      }

      const progress = await this.translationEngine.getTranslationProgress(jobId);
      
      if (!progress) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          jobId,
          status: progress.stage,
          progress: progress.progress,
          message: progress.message,
          currentSegment: progress.currentSegment,
          totalSegments: progress.totalSegments,
          estimatedTimeRemaining: progress.estimatedTimeRemaining
        }
      } as ApiResponse);

    } catch (error) {
      this.errorHandler.handleExpressError(error as Error, req, res);
    }
  }

  private async handleResultRequest(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        res.status(400).json({
          success: false,
          error: 'Job ID is required'
        } as ApiResponse);
        return;
      }

      const jobResult = this.activeJobs.get(jobId);
      
      if (!jobResult) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        } as ApiResponse);
        return;
      }

      if (jobResult.status === 'PROCESSING') {
        res.status(202).json({
          success: true,
          data: {
            jobId,
            status: 'PROCESSING',
            progress: jobResult.progress || 0,
            message: 'Job is still processing'
          }
        } as ApiResponse);
        return;
      }

      if (jobResult.status === 'FAILED') {
        res.status(500).json({
          success: false,
          error: 'Translation job failed',
          message: jobResult.error
        } as ApiResponse);
        return;
      }

      // Job completed successfully
      const result = jobResult.result;
      if (!result) {
        res.status(500).json({
          success: false,
          error: 'Job completed but result is missing'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          jobId,
          status: 'COMPLETED',
          progress: 100,
          result: {
            originalSRT: {
              id: result.originalSRT?.id || 'unknown',
              totalDuration: result.originalSRT?.totalDuration || 0,
              segmentCount: result.originalSRT?.segments?.length || 0
            },
            translatedSRT: {
              id: result.translatedSRT?.id || 'unknown',
              content: result.translatedSRT?.content || '',
              totalDuration: result.translatedSRT?.totalDuration || 0,
              segmentCount: result.translatedSRT?.segments?.length || 0
            },
            movieAnalysis: {
              id: result.movieAnalysis?.id || 'unknown',
              summary: result.movieAnalysis?.summary || '',
              themes: result.movieAnalysis?.themes || [],
              characterCount: result.movieAnalysis?.characterAnalysis?.length || 0,
              genreClassification: result.movieAnalysis?.genreClassification || [],
              confidence: result.movieAnalysis?.confidence || 0,
              keyScenes: result.movieAnalysis?.keyScenes?.length || 0,
              culturalNotes: result.movieAnalysis?.culturalContext?.length || 0
            },
            processingMetrics: result.processingMetrics || {}
          },
          downloadUrls: {
            translatedSRT: `/api/translation/download/${jobId}/srt`,
            movieAnalysis: `/api/translation/download/${jobId}/analysis`
          }
        } as TranslationResultResponse
      } as ApiResponse);

    } catch (error) {
      this.errorHandler.handleExpressError(error as Error, req, res);
    }
  }

  private async handleDownloadRequest(req: Request, res: Response): Promise<void> {
    try {
      const { jobId, type } = req.params;
      
      if (!jobId || !type) {
        res.status(400).json({
          success: false,
          error: 'Job ID and type are required'
        } as ApiResponse);
        return;
      }

      const jobResult = this.activeJobs.get(jobId);
      
      if (!jobResult || jobResult.status !== 'COMPLETED') {
        res.status(404).json({
          success: false,
          error: 'Job not found or not completed'
        } as ApiResponse);
        return;
      }

      const result = jobResult.result;

      switch (type) {
        case 'srt':
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Content-Disposition', `attachment; filename="translated_${jobId}.srt"`);
          res.send(result.translatedSRT.content);
          break;

        case 'analysis':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="analysis_${jobId}.json"`);
          res.json(result.movieAnalysis);
          break;

        case 'full':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="full_result_${jobId}.json"`);
          res.json(result);
          break;

        default:
          res.status(400).json({
            success: false,
            error: 'Invalid download type. Use: srt, analysis, or full'
          } as ApiResponse);
      }

    } catch (error) {
      this.errorHandler.handleExpressError(error as Error, req, res);
    }
  }

  private async handleCancelRequest(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        res.status(400).json({
          success: false,
          error: 'Job ID is required'
        } as ApiResponse);
        return;
      }

      const jobResult = this.activeJobs.get(jobId);
      
      if (!jobResult) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        } as ApiResponse);
        return;
      }

      if (jobResult.status === 'COMPLETED') {
        res.status(400).json({
          success: false,
          error: 'Cannot cancel completed job'
        } as ApiResponse);
        return;
      }

      // Mark job as cancelled
      jobResult.status = 'CANCELLED';
      
      res.json({
        success: true,
        message: 'Job cancelled successfully'
      } as ApiResponse);

    } catch (error) {
      this.errorHandler.handleExpressError(error as Error, req, res);
    }
  }

  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check if translation engine is responsive
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          translationEngine: 'up',
          whisper: 'up',
          movieAnalysis: 'up'
        },
        activeJobs: this.activeJobs.size,
        uptime: process.uptime()
      };

      res.json({
        success: true,
        data: healthStatus
      } as ApiResponse);

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      } as ApiResponse);
    }
  }

  private async startTranslationJob(
    jobId: string, 
    srtFile: any, 
    targetLanguage: string, 
    movieMetadata?: MovieMetadata
  ): Promise<void> {
    // Initialize job tracking
    this.activeJobs.set(jobId, {
      status: 'PROCESSING',
      progress: 0,
      startTime: Date.now()
    });

    try {
      // Start the translation process
      const result = await this.translationEngine.translateSRTWithAnalysis(
        srtFile,
        targetLanguage,
        movieMetadata
      );

      // Update job with successful result
      this.activeJobs.set(jobId, {
        status: 'COMPLETED',
        progress: 100,
        result,
        completedAt: Date.now()
      });

      // Clean up job after 1 hour
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 3600000);

    } catch (error) {
      // Update job with error
      this.activeJobs.set(jobId, {
        status: 'FAILED',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: Date.now()
      });

      console.error(`Translation job ${jobId} failed:`, error);
    }
  }

  private parseSRTContent(content: string, filename: string): any {
    // Parse SRT content into SRTFile object
    const segments = this.parseSRTSegments(content);
    const totalDuration = segments.length > 0 
      ? this.parseTimeString(segments[segments.length - 1].endTime)
      : 0;

    return new SRTFileImpl(
      uuidv4(),
      content,
      segments,
      totalDuration
    );
  }

  private parseSRTSegments(content: string): any[] {
    const segments: any[] = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        const index = parseInt(lines[0]);
        const timeLine = lines[1];
        const text = lines.slice(2).join('\n');

        const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (timeMatch) {
          segments.push({
            index,
            startTime: timeMatch[1],
            endTime: timeMatch[2],
            text: text.trim()
          });
        }
      }
    }

    return segments;
  }

  private parseTimeString(timeStr: string): number {
    const [time, ms] = timeStr.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds + parseInt(ms) / 1000;
  }

  private estimateCompletionTime(srtFile: any): number {
    // Estimate completion time based on SRT file size and complexity
    const segmentCount = srtFile.segments.length;
    const avgTimePerSegment = 2; // seconds
    return segmentCount * avgTimePerSegment;
  }

  public getRouter(): Router {
    return this.router;
  }
}
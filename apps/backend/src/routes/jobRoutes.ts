import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponse, CreateJobRequestSchema, JobStatus, DubbingJob } from '@dubai/shared';
import { asyncHandler } from '../middleware/errorHandler';
import { validateSchema, commonSchemas } from '../middleware/validationMiddleware';
import { uploadRateLimit } from '../middleware/rateLimitMiddleware';
import { JobQueueService, JobQueueConfig } from '../services/JobQueueService';
import { JobValidationService } from '../services/JobValidationService';

const router = Router();

// Initialize job queue service (this will be injected via dependency injection in production)
let jobQueueService: JobQueueService;
let jobValidationService: JobValidationService;

// Middleware to initialize services
router.use((req: Request, res: Response, next) => {
  if (!jobQueueService && req.supabase && req.app.get('logger')) {
    const config: JobQueueConfig = {
      maxConcurrentJobs: parseInt(process.env['MAX_CONCURRENT_JOBS'] || '3', 10),
      maxRetries: parseInt(process.env['MAX_JOB_RETRIES'] || '3', 10),
      retryDelay: parseInt(process.env['JOB_RETRY_DELAY'] || '5000', 10),
      jobTimeout: parseInt(process.env['JOB_TIMEOUT'] || '1800000', 10), // 30 minutes
      cleanupInterval: parseInt(process.env['CLEANUP_INTERVAL'] || '3600000', 10), // 1 hour
      maxQueueSize: parseInt(process.env['MAX_QUEUE_SIZE'] || '1000', 10)
    };
    
    jobQueueService = new JobQueueService(config, req.supabase, req.app.get('logger'));
    jobValidationService = new JobValidationService(req.supabase, req.app.get('logger'));
    
    // Load existing jobs from database
    jobQueueService.loadJobsFromDatabase().catch(error => {
      req.app.get('logger').error('Failed to load jobs from database:', error);
    });
  }
  next();
});

// Get all jobs for the authenticated user
router.get('/', 
  validateSchema(z.object({
    ...commonSchemas.pagination.shape,
    status: z.nativeEnum(JobStatus).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('createdAt'),
    sortOrder: commonSchemas.sortOrder,
    search: z.string().max(255).optional()
  }), 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status, sortBy, sortOrder, search } = req.query as any;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      // Validate query parameters
      const validationResult = jobValidationService.validateJobQuery(req.query);
      if (!validationResult.isValid) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'VALIDATION_ERROR',
          message: validationResult.errors.join('; ')
        };
        res.status(400).json(response);
        return;
      }

      // Get jobs from queue service (for active jobs) and database (for all jobs)
      let userJobs = jobQueueService.getUserJobs(req.user.id);

      // Filter by status if specified
      if (status) {
        userJobs = userJobs.filter(job => job.status === status);
      }

      // Filter by search term if specified
      if (search) {
        const searchLower = search.toLowerCase();
        userJobs = userJobs.filter(job => 
          job.title.toLowerCase().includes(searchLower) ||
          job.id.toLowerCase().includes(searchLower)
        );
      }

      // Sort jobs
      userJobs.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortBy) {
          case 'title':
            aValue = a.title;
            bValue = b.title;
            break;
          case 'updatedAt':
            aValue = a.updatedAt;
            bValue = b.updatedAt;
            break;
          case 'createdAt':
          default:
            aValue = a.createdAt;
            bValue = b.createdAt;
            break;
        }

        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });

      // Apply pagination
      const offset = (page - 1) * limit;
      const paginatedJobs = userJobs.slice(offset, offset + limit);

      // Transform to API format
      const transformedJobs: DubbingJob[] = paginatedJobs.map(job => ({
        id: job.id,
        userId: job.userId,
        title: job.title,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        inputFiles: {},
        outputFiles: {},
        processingMetrics: job.processingMetrics,
        errorMessage: job.errorMessage
      }));

      const response: ApiResponse<DubbingJob[]> = {
        success: true,
        data: transformedJobs,
        message: `Retrieved ${transformedJobs.length} jobs`
      };

      // Add pagination headers
      res.setHeader('X-Total-Count', userJobs.length);
      res.setHeader('X-Page', page);
      res.setHeader('X-Per-Page', limit);
      res.setHeader('X-Total-Pages', Math.ceil(userJobs.length / limit));

      res.json(response);
    } catch (error) {
      throw new Error(`Failed to fetch jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Get a specific job by ID
router.get('/:id',
  validateSchema(z.object({
    id: commonSchemas.uuid
  }), 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      const { data: job, error } = await req.supabase
        .from('dubbing_jobs')
        .select(`
          *,
          input_video_file:storage_files!dubbing_jobs_input_video_file_id_fkey(*),
          input_srt_file:storage_files!dubbing_jobs_input_srt_file_id_fkey(*),
          output_audio_file:storage_files!dubbing_jobs_output_audio_file_id_fkey(*),
          output_srt_file:storage_files!dubbing_jobs_output_srt_file_id_fkey(*)
        `)
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const response: ApiResponse<any> = {
            success: false,
            error: 'NOT_FOUND',
            message: 'Job not found'
          };
          res.status(404).json(response);
          return;
        }
        throw error;
      }

      // Transform database record to API format
      const transformedJob: DubbingJob = {
        id: job.id,
        userId: job.user_id,
        title: job.title,
        status: job.status as JobStatus,
        progress: job.progress,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        inputFiles: {
          video: job.input_video_file ? {
            id: job.input_video_file.id,
            filename: job.input_video_file.filename,
            size: job.input_video_file.file_size,
            mimeType: job.input_video_file.mime_type,
            storagePath: job.input_video_file.storage_path,
            uploadedAt: job.input_video_file.created_at
          } : undefined,
          srt: job.input_srt_file ? {
            id: job.input_srt_file.id,
            filename: job.input_srt_file.filename,
            size: job.input_srt_file.file_size,
            mimeType: job.input_srt_file.mime_type,
            storagePath: job.input_srt_file.storage_path,
            uploadedAt: job.input_srt_file.created_at
          } : undefined
        },
        outputFiles: {
          dubbedAudio: job.output_audio_file ? {
            id: job.output_audio_file.id,
            filename: job.output_audio_file.filename,
            size: job.output_audio_file.file_size,
            mimeType: job.output_audio_file.mime_type,
            storagePath: job.output_audio_file.storage_path,
            uploadedAt: job.output_audio_file.created_at
          } : undefined,
          translatedSrt: job.output_srt_file ? {
            id: job.output_srt_file.id,
            filename: job.output_srt_file.filename,
            size: job.output_srt_file.file_size,
            mimeType: job.output_srt_file.mime_type,
            storagePath: job.output_srt_file.storage_path,
            uploadedAt: job.output_srt_file.created_at
          } : undefined
        },
        processingMetrics: job.processing_metrics || {
          costBreakdown: {
            transcriptionCost: 0,
            translationCost: 0,
            ttsCost: 0,
            processingCost: 0,
            totalCost: 0
          }
        },
        errorMessage: job.error_message
      };

      const response: ApiResponse<DubbingJob> = {
        success: true,
        data: transformedJob
      };

      res.json(response);
    } catch (error) {
      throw new Error(`Failed to fetch job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Create a new job
router.post('/',
  uploadRateLimit,
  validateSchema(CreateJobRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, videoFileId, srtFileId, priority } = req.body;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      // Get user profile for validation context
      const { data: userProfile } = await req.supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', req.user.id)
        .single();

      // Validate job creation request
      const validationResult = await jobValidationService.validateCreateJob(
        { title, videoFileId, srtFileId, priority },
        {
          userId: req.user.id,
          userSubscriptionTier: userProfile?.subscription_tier || 'free'
        }
      );

      if (!validationResult.isValid) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'VALIDATION_ERROR',
          message: validationResult.errors.join('; ')
        };
        res.status(400).json(response);
        return;
      }

      // Create job using queue service
      const queuedJob = await jobQueueService.addJob({
        userId: req.user.id,
        title,
        videoFileId,
        srtFileId,
        priority: priority || 0
      });

      // Transform to API format
      const transformedJob: DubbingJob = {
        id: queuedJob.id,
        userId: queuedJob.userId,
        title: queuedJob.title,
        status: queuedJob.status,
        progress: queuedJob.progress,
        createdAt: queuedJob.createdAt.toISOString(),
        updatedAt: queuedJob.updatedAt.toISOString(),
        inputFiles: {},
        outputFiles: {},
        processingMetrics: queuedJob.processingMetrics
      };

      const response: ApiResponse<DubbingJob> = {
        success: true,
        data: transformedJob,
        message: 'Job created successfully'
      };

      // Include validation warnings if any
      if (validationResult.warnings.length > 0) {
        response.message += ` (Warnings: ${validationResult.warnings.join('; ')})`;
      }

      res.status(201).json(response);

      // Emit WebSocket event for real-time updates
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.user.id}`).emit('job_update', {
          type: 'job_update',
          payload: {
            jobId: queuedJob.id,
            status: JobStatus.UPLOADED,
            progress: 0,
            message: 'Job created successfully and added to queue'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      throw new Error(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Start processing a job
router.post('/:id/start',
  validateSchema(z.object({
    id: commonSchemas.uuid
  }), 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      // Check if job exists and belongs to user
      const { data: job, error: fetchError } = await req.supabase
        .from('dubbing_jobs')
        .select('*')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          const response: ApiResponse<any> = {
            success: false,
            error: 'NOT_FOUND',
            message: 'Job not found'
          };
          res.status(404).json(response);
          return;
        }
        throw fetchError;
      }

      // Check if job can be started
      if (job.status !== JobStatus.UPLOADED) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'INVALID_STATUS',
          message: `Job cannot be started from status: ${job.status}`
        };
        res.status(400).json(response);
        return;
      }

      // Update job status to processing
      const { error: updateError } = await req.supabase
        .from('dubbing_jobs')
        .update({
          status: JobStatus.EXTRACTING_AUDIO,
          progress: 5,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      const response: ApiResponse<any> = {
        success: true,
        message: 'Job processing started'
      };

      res.json(response);

      // Emit WebSocket event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.user.id}`).emit('job_update', {
          type: 'job_update',
          payload: {
            jobId: id,
            status: JobStatus.EXTRACTING_AUDIO,
            progress: 5,
            message: 'Processing started - extracting audio...'
          },
          timestamp: new Date().toISOString()
        });

        // Simulate processing steps (in real implementation, this would be handled by the processing pipeline)
        setTimeout(() => {
          io.to(`user:${req.user!.id}`).emit('job_update', {
            type: 'job_update',
            payload: {
              jobId: id,
              status: JobStatus.TRANSCRIBING,
              progress: 25,
              message: 'Transcribing audio...'
            },
            timestamp: new Date().toISOString()
          });
        }, 2000);

        setTimeout(() => {
          io.to(`user:${req.user!.id}`).emit('job_update', {
            type: 'job_update',
            payload: {
              jobId: id,
              status: JobStatus.TRANSLATING,
              progress: 50,
              message: 'Translating to Bangla...'
            },
            timestamp: new Date().toISOString()
          });
        }, 5000);

        setTimeout(() => {
          io.to(`user:${req.user!.id}`).emit('job_update', {
            type: 'job_update',
            payload: {
              jobId: id,
              status: JobStatus.GENERATING_SPEECH,
              progress: 75,
              message: 'Generating speech...'
            },
            timestamp: new Date().toISOString()
          });
        }, 8000);

        setTimeout(() => {
          io.to(`user:${req.user!.id}`).emit('job_update', {
            type: 'job_update',
            payload: {
              jobId: id,
              status: JobStatus.COMPLETED,
              progress: 100,
              message: 'Job completed successfully!'
            },
            timestamp: new Date().toISOString()
          });
        }, 12000);
      }
    } catch (error) {
      throw new Error(`Failed to start job processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Cancel a job
router.post('/:id/cancel',
  validateSchema(z.object({
    id: commonSchemas.uuid
  }), 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      // Validate job cancellation
      const validationResult = await jobValidationService.validateJobCancellation(
        id,
        { userId: req.user.id }
      );

      if (!validationResult.isValid) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'VALIDATION_ERROR',
          message: validationResult.errors.join('; ')
        };
        res.status(400).json(response);
        return;
      }

      // Cancel job using queue service
      const cancelled = await jobQueueService.cancelJob(id, req.user.id);

      if (!cancelled) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'NOT_FOUND',
          message: 'Job not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<any> = {
        success: true,
        message: 'Job cancelled successfully'
      };

      // Include validation warnings if any
      if (validationResult.warnings.length > 0) {
        response.message += ` (${validationResult.warnings.join('; ')})`;
      }

      res.json(response);

      // Emit WebSocket event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.user.id}`).emit('job_update', {
          type: 'job_update',
          payload: {
            jobId: id,
            status: JobStatus.FAILED,
            progress: 0,
            message: 'Job cancelled by user',
            error: 'Job cancelled by user'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      throw new Error(`Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Delete a job
router.delete('/:id',
  validateSchema(z.object({
    id: commonSchemas.uuid
  }), 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      // Validate job deletion
      const validationResult = await jobValidationService.validateJobDeletion(
        id,
        { userId: req.user.id }
      );

      if (!validationResult.isValid) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'VALIDATION_ERROR',
          message: validationResult.errors.join('; ')
        };
        res.status(400).json(response);
        return;
      }

      // Delete job using queue service
      const deleted = await jobQueueService.deleteJob(id, req.user.id);

      if (!deleted) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'NOT_FOUND',
          message: 'Job not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<any> = {
        success: true,
        message: 'Job deleted successfully'
      };

      // Include validation warnings if any
      if (validationResult.warnings.length > 0) {
        response.message += ` (${validationResult.warnings.join('; ')})`;
      }

      res.json(response);
    } catch (error) {
      throw new Error(`Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Get queue statistics
router.get('/queue/stats',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      const stats = jobQueueService.getQueueStats();
      
      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats,
        message: 'Queue statistics retrieved successfully'
      };

      res.json(response);
    } catch (error) {
      throw new Error(`Failed to get queue statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Update job (for admin/system use)
router.put('/:id',
  validateSchema(z.object({
    id: commonSchemas.uuid
  }), 'params'),
  validateSchema(z.object({
    title: z.string().min(1).max(255).optional(),
    status: z.nativeEnum(JobStatus).optional(),
    progress: z.number().min(0).max(100).optional()
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      // Validate job update
      const validationResult = await jobValidationService.validateUpdateJob(
        updateData,
        id,
        { userId: req.user.id }
      );

      if (!validationResult.isValid) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'VALIDATION_ERROR',
          message: validationResult.errors.join('; ')
        };
        res.status(400).json(response);
        return;
      }

      // Update job in database
      const { data: updatedJob, error } = await req.supabase
        .from('dubbing_jobs')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const response: ApiResponse<any> = {
            success: false,
            error: 'NOT_FOUND',
            message: 'Job not found'
          };
          res.status(404).json(response);
          return;
        }
        throw error;
      }

      // Update job in queue service if it exists there
      if (updateData.status !== undefined || updateData.progress !== undefined) {
        await jobQueueService.updateJobProgress({
          jobId: id,
          status: updateData.status || updatedJob.status,
          progress: updateData.progress !== undefined ? updateData.progress : updatedJob.progress,
          message: 'Job updated'
        });
      }

      const response: ApiResponse<any> = {
        success: true,
        message: 'Job updated successfully'
      };

      // Include validation warnings if any
      if (validationResult.warnings.length > 0) {
        response.message += ` (${validationResult.warnings.join('; ')})`;
      }

      res.json(response);

      // Emit WebSocket event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.user.id}`).emit('job_update', {
          type: 'job_update',
          payload: {
            jobId: id,
            status: updatedJob.status,
            progress: updatedJob.progress,
            message: 'Job updated'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      throw new Error(`Failed to update job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

export { router as jobRoutes };
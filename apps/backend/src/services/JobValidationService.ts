import { z } from 'zod';
import { JobStatus } from '@dubai/shared';
import { SupabaseClient } from '@supabase/supabase-js';
import winston from 'winston';

// Validation schemas
export const CreateJobValidationSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters')
    .regex(/^[a-zA-Z0-9\s\-_\.]+$/, 'Title contains invalid characters'),
  videoFileId: z.string().uuid('Invalid video file ID').optional(),
  srtFileId: z.string().uuid('Invalid SRT file ID').optional(),
  priority: z.number().int().min(0).max(10).default(0)
});

export const UpdateJobValidationSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters')
    .regex(/^[a-zA-Z0-9\s\-_\.]+$/, 'Title contains invalid characters')
    .optional(),
  status: z.nativeEnum(JobStatus).optional(),
  progress: z.number().min(0).max(100).optional()
});

export const JobQueryValidationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(JobStatus).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'status', 'progress']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(255).optional()
});

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface JobValidationContext {
  userId: string;
  userSubscriptionTier?: string;
  userJobCount?: number;
  userStorageUsed?: number;
}

export class JobValidationService {
  constructor(
    private supabase: SupabaseClient,
    private logger: winston.Logger
  ) {}

  /**
   * Validate job creation request
   */
  async validateCreateJob(
    data: unknown,
    context: JobValidationContext
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Schema validation
      const validatedData = CreateJobValidationSchema.parse(data);

      // Business logic validation
      await this.validateBusinessRules(validatedData, context, result);

      // File validation
      if (validatedData.videoFileId) {
        await this.validateVideoFile(validatedData.videoFileId, context.userId, result);
      }

      if (validatedData.srtFileId) {
        await this.validateSrtFile(validatedData.srtFileId, context.userId, result);
      }

      // User limits validation
      await this.validateUserLimits(context, result);

    } catch (error) {
      if (error instanceof z.ZodError) {
        result.errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate job update request
   */
  async validateUpdateJob(
    data: unknown,
    jobId: string,
    context: JobValidationContext
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Schema validation
      const validatedData = UpdateJobValidationSchema.parse(data);

      // Check if job exists and belongs to user
      const jobExists = await this.validateJobOwnership(jobId, context.userId, result);
      if (!jobExists) {
        return result;
      }

      // Validate status transitions
      if (validatedData.status) {
        await this.validateStatusTransition(jobId, validatedData.status, result);
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        result.errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate job query parameters
   */
  validateJobQuery(data: unknown): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      JobQueryValidationSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        result.errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate job cancellation
   */
  async validateJobCancellation(
    jobId: string,
    context: JobValidationContext
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Check if job exists and belongs to user
      const { data: job, error } = await this.supabase
        .from('dubbing_jobs')
        .select('status, user_id')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        result.errors.push('Job not found');
        result.isValid = false;
        return result;
      }

      if (job.user_id !== context.userId) {
        result.errors.push('Unauthorized: Cannot cancel job belonging to another user');
        result.isValid = false;
        return result;
      }

      // Check if job can be cancelled
      const nonCancellableStatuses = [JobStatus.COMPLETED, JobStatus.FAILED];
      if (nonCancellableStatuses.includes(job.status as JobStatus)) {
        result.errors.push(`Cannot cancel job in ${job.status} status`);
        result.isValid = false;
        return result;
      }

      // Add warning for jobs that are already processing
      const processingStatuses = [
        JobStatus.EXTRACTING_AUDIO,
        JobStatus.TRANSCRIBING,
        JobStatus.TRANSLATING,
        JobStatus.GENERATING_SPEECH,
        JobStatus.ASSEMBLING_AUDIO
      ];
      if (processingStatuses.includes(job.status as JobStatus)) {
        result.warnings.push('Job is currently processing and may take a moment to cancel');
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate job deletion
   */
  async validateJobDeletion(
    jobId: string,
    context: JobValidationContext
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Check if job exists and belongs to user
      const { data: job, error } = await this.supabase
        .from('dubbing_jobs')
        .select('status, user_id')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        result.errors.push('Job not found');
        result.isValid = false;
        return result;
      }

      if (job.user_id !== context.userId) {
        result.errors.push('Unauthorized: Cannot delete job belonging to another user');
        result.isValid = false;
        return result;
      }

      // Check if job can be deleted
      const processingStatuses = [
        JobStatus.EXTRACTING_AUDIO,
        JobStatus.TRANSCRIBING,
        JobStatus.TRANSLATING,
        JobStatus.GENERATING_SPEECH,
        JobStatus.ASSEMBLING_AUDIO
      ];
      if (processingStatuses.includes(job.status as JobStatus)) {
        result.errors.push('Cannot delete job that is currently processing. Please cancel the job first.');
        result.isValid = false;
        return result;
      }

      // Add warning for completed jobs
      if (job.status === JobStatus.COMPLETED) {
        result.warnings.push('Deleting a completed job will permanently remove all output files');
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate business rules for job creation
   */
  private async validateBusinessRules(
    data: z.infer<typeof CreateJobValidationSchema>,
    context: JobValidationContext,
    result: ValidationResult
  ): Promise<void> {
    // Check if at least one input file is provided
    if (!data.videoFileId && !data.srtFileId) {
      result.warnings.push('No input files specified. You can add files later before starting processing.');
    }

    // Check for duplicate job titles (warning only)
    try {
      const { data: existingJobs, error } = await this.supabase
        .from('dubbing_jobs')
        .select('id')
        .eq('user_id', context.userId)
        .eq('title', data.title)
        .limit(1);

      if (!error && existingJobs && existingJobs.length > 0) {
        result.warnings.push('A job with this title already exists');
      }
    } catch (error) {
      this.logger.warn('Failed to check for duplicate job titles:', error);
    }
  }

  /**
   * Validate video file
   */
  private async validateVideoFile(
    fileId: string,
    userId: string,
    result: ValidationResult
  ): Promise<void> {
    try {
      const { data: file, error } = await this.supabase
        .from('storage_files')
        .select('mime_type, file_size, user_id')
        .eq('id', fileId)
        .single();

      if (error || !file) {
        result.errors.push('Video file not found');
        return;
      }

      if (file.user_id !== userId) {
        result.errors.push('Unauthorized: Video file belongs to another user');
        return;
      }

      // Validate MIME type
      const validVideoTypes = [
        'video/mp4',
        'video/avi',
        'video/mov',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm'
      ];

      if (!validVideoTypes.includes(file.mime_type)) {
        result.errors.push(`Invalid video file type: ${file.mime_type}. Supported types: MP4, AVI, MOV, WebM`);
      }

      // Validate file size (500MB limit)
      const maxFileSize = 500 * 1024 * 1024; // 500MB in bytes
      if (file.file_size > maxFileSize) {
        result.errors.push(`Video file too large: ${Math.round(file.file_size / 1024 / 1024)}MB. Maximum size: 500MB`);
      }

    } catch (error) {
      result.errors.push(`Failed to validate video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate SRT file
   */
  private async validateSrtFile(
    fileId: string,
    userId: string,
    result: ValidationResult
  ): Promise<void> {
    try {
      const { data: file, error } = await this.supabase
        .from('storage_files')
        .select('mime_type, file_size, user_id')
        .eq('id', fileId)
        .single();

      if (error || !file) {
        result.errors.push('SRT file not found');
        return;
      }

      if (file.user_id !== userId) {
        result.errors.push('Unauthorized: SRT file belongs to another user');
        return;
      }

      // Validate MIME type
      const validSrtTypes = [
        'text/plain',
        'application/x-subrip',
        'text/srt'
      ];

      if (!validSrtTypes.includes(file.mime_type)) {
        result.errors.push(`Invalid SRT file type: ${file.mime_type}. Please upload a valid SRT subtitle file`);
      }

      // Validate file size (10MB limit for SRT files)
      const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.file_size > maxFileSize) {
        result.errors.push(`SRT file too large: ${Math.round(file.file_size / 1024 / 1024)}MB. Maximum size: 10MB`);
      }

    } catch (error) {
      result.errors.push(`Failed to validate SRT file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate user limits based on subscription tier
   */
  private async validateUserLimits(
    context: JobValidationContext,
    result: ValidationResult
  ): Promise<void> {
    try {
      // Get user's current job count
      const { count: jobCount, error } = await this.supabase
        .from('dubbing_jobs')
        .select('id', { count: 'exact' })
        .eq('user_id', context.userId)
        .in('status', [JobStatus.UPLOADED, JobStatus.EXTRACTING_AUDIO, JobStatus.TRANSCRIBING, 
                      JobStatus.TRANSLATING, JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO]);

      if (error) {
        this.logger.warn('Failed to check user job limits:', error);
        return;
      }

      const currentActiveJobs = jobCount || 0;

      // Define limits based on subscription tier
      const limits = {
        free: { maxActiveJobs: 3, maxMonthlyJobs: 10 },
        basic: { maxActiveJobs: 10, maxMonthlyJobs: 50 },
        pro: { maxActiveJobs: 25, maxMonthlyJobs: 200 },
        enterprise: { maxActiveJobs: 100, maxMonthlyJobs: 1000 }
      };

      const userTier = context.userSubscriptionTier || 'free';
      const userLimits = limits[userTier as keyof typeof limits] || limits.free;

      // Check active jobs limit
      if (currentActiveJobs >= userLimits.maxActiveJobs) {
        result.errors.push(`Active job limit reached (${userLimits.maxActiveJobs}). Please wait for current jobs to complete or upgrade your plan.`);
      }

      // Check monthly jobs limit (warning only)
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count: monthlyJobCount, error: monthlyError } = await this.supabase
        .from('dubbing_jobs')
        .select('id', { count: 'exact' })
        .eq('user_id', context.userId)
        .gte('created_at', monthStart.toISOString());

      if (!monthlyError && monthlyJobCount && monthlyJobCount >= userLimits.maxMonthlyJobs * 0.8) {
        result.warnings.push(`Approaching monthly job limit (${monthlyJobCount}/${userLimits.maxMonthlyJobs})`);
      }

    } catch (error) {
      this.logger.warn('Failed to validate user limits:', error);
    }
  }

  /**
   * Validate job ownership
   */
  private async validateJobOwnership(
    jobId: string,
    userId: string,
    result: ValidationResult
  ): Promise<boolean> {
    try {
      const { data: job, error } = await this.supabase
        .from('dubbing_jobs')
        .select('user_id')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        result.errors.push('Job not found');
        return false;
      }

      if (job.user_id !== userId) {
        result.errors.push('Unauthorized: Cannot access job belonging to another user');
        return false;
      }

      return true;
    } catch (error) {
      result.errors.push(`Failed to validate job ownership: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validate status transitions
   */
  private async validateStatusTransition(
    jobId: string,
    newStatus: JobStatus,
    result: ValidationResult
  ): Promise<void> {
    try {
      const { data: job, error } = await this.supabase
        .from('dubbing_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        result.errors.push('Job not found');
        return;
      }

      const currentStatus = job.status as JobStatus;

      // Define valid status transitions
      const validTransitions: Record<JobStatus, JobStatus[]> = {
        [JobStatus.UPLOADED]: [JobStatus.EXTRACTING_AUDIO, JobStatus.FAILED],
        [JobStatus.EXTRACTING_AUDIO]: [JobStatus.TRANSCRIBING, JobStatus.FAILED],
        [JobStatus.TRANSCRIBING]: [JobStatus.TRANSLATING, JobStatus.FAILED],
        [JobStatus.TRANSLATING]: [JobStatus.GENERATING_SPEECH, JobStatus.FAILED],
        [JobStatus.GENERATING_SPEECH]: [JobStatus.ASSEMBLING_AUDIO, JobStatus.FAILED],
        [JobStatus.ASSEMBLING_AUDIO]: [JobStatus.COMPLETED, JobStatus.FAILED],
        [JobStatus.COMPLETED]: [], // No transitions from completed
        [JobStatus.FAILED]: [JobStatus.UPLOADED] // Can retry failed jobs
      };

      const allowedTransitions = validTransitions[currentStatus] || [];
      if (!allowedTransitions.includes(newStatus)) {
        result.errors.push(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      }

    } catch (error) {
      result.errors.push(`Failed to validate status transition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
import { z } from 'zod';
import { DubbingJobSchema, JobUpdateSchema } from './job';
import { UserProfileSchema } from './user';

// API Response Wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional()
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// Job API Schemas
export const CreateJobRequestSchema = z.object({
  title: z.string().min(1),
  videoFileId: z.string().uuid().optional(),
  srtFileId: z.string().uuid().optional(),
  priority: z.number().int().min(0).max(10).default(0)
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export const JobResponseSchema = ApiResponseSchema(DubbingJobSchema);
export type JobResponse = z.infer<typeof JobResponseSchema>;

export const JobListResponseSchema = ApiResponseSchema(z.array(DubbingJobSchema));
export type JobListResponse = z.infer<typeof JobListResponseSchema>;

// File Upload Schemas
export const FileUploadRequestSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  size: z.number()
});

export type FileUploadRequest = z.infer<typeof FileUploadRequestSchema>;

export const FileUploadResponseSchema = ApiResponseSchema(z.object({
  uploadUrl: z.string(),
  fileId: z.string()
}));

export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>;

// Processing Metrics Update Schema
export const ProcessingMetricsUpdateSchema = z.object({
  jobId: z.string(),
  stepName: z.string(),
  stepOrder: z.number(),
  status: z.string(),
  duration: z.number().optional(),
  serviceUsed: z.string().optional(),
  costEstimate: z.number().optional()
});

export type ProcessingMetricsUpdate = z.infer<typeof ProcessingMetricsUpdateSchema>;

// Queue Update Schema
export const QueueUpdateSchema = z.object({
  jobId: z.string(),
  queuePosition: z.number(),
  estimatedStartTime: z.string().optional(),
  estimatedDuration: z.number().optional()
});

export type QueueUpdate = z.infer<typeof QueueUpdateSchema>;

// WebSocket Message Schemas
export const WebSocketMessageSchema = z.object({
  type: z.enum(['job_update', 'processing_metrics', 'queue_update', 'error', 'system_message']),
  payload: z.union([
    JobUpdateSchema, 
    ProcessingMetricsUpdateSchema,
    QueueUpdateSchema,
    z.object({ message: z.string() })
  ]),
  timestamp: z.string()
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Error Schemas
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional()
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
import { z } from 'zod';

// Job Status Enum
export enum JobStatus {
  UPLOADED = 'uploaded',
  EXTRACTING_AUDIO = 'extracting_audio',
  TRANSCRIBING = 'transcribing',
  TRANSLATING = 'translating',
  GENERATING_SPEECH = 'generating_speech',
  ASSEMBLING_AUDIO = 'assembling_audio',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// File Reference Schema
export const FileReferenceSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number(),
  mimeType: z.string(),
  storagePath: z.string(),
  downloadUrl: z.string().optional(),
  uploadedAt: z.string()
});

export type FileReference = z.infer<typeof FileReferenceSchema>;

// Cost Breakdown Schema
export const CostBreakdownSchema = z.object({
  transcriptionCost: z.number().default(0),
  translationCost: z.number().default(0),
  ttsCost: z.number().default(0),
  processingCost: z.number().default(0),
  totalCost: z.number().default(0)
});

export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;

// Processing Metrics Schema
export const ProcessingMetricsSchema = z.object({
  audioExtractionTime: z.number().optional(),
  transcriptionTime: z.number().optional(),
  translationTime: z.number().optional(),
  ttsGenerationTime: z.number().optional(),
  audioAssemblyTime: z.number().optional(),
  totalProcessingTime: z.number().optional(),
  ttsService: z.enum(['google', 'coqui']).optional(),
  costBreakdown: CostBreakdownSchema
});

export type ProcessingMetrics = z.infer<typeof ProcessingMetricsSchema>;

// Dubbing Job Schema
export const DubbingJobSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  status: z.nativeEnum(JobStatus),
  progress: z.number().min(0).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
  inputFiles: z.object({
    video: FileReferenceSchema.optional(),
    srt: FileReferenceSchema.optional()
  }),
  outputFiles: z.object({
    dubbedAudio: FileReferenceSchema.optional(),
    translatedSrt: FileReferenceSchema.optional()
  }),
  processingMetrics: ProcessingMetricsSchema,
  errorMessage: z.string().optional()
});

export type DubbingJob = z.infer<typeof DubbingJobSchema>;

// Job Update Schema for real-time updates
export const JobUpdateSchema = z.object({
  jobId: z.string(),
  status: z.nativeEnum(JobStatus),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  metrics: ProcessingMetricsSchema.partial().optional(),
  error: z.string().optional()
});

export type JobUpdate = z.infer<typeof JobUpdateSchema>;
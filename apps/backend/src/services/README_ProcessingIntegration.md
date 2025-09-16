# Processing Pipeline Integration

This document describes the integration of existing DubAI services (TranscriptionServiceImpl, TTSRouterImpl, AudioAssemblyServiceImpl) with the job processing system to create a complete end-to-end dubbing pipeline.

## Overview

The `JobProcessingIntegration` class serves as the orchestrator that connects:
- Job queue management
- Real-time progress tracking
- Error recovery and retry logic
- Service integration for transcription, TTS, and audio assembly
- WebSocket communication for live updates

## Architecture

### Service Integration

```typescript
// Core integrated services
- TranscriptionServiceImpl: Handles Whisper-based transcription and translation
- TTSRouterImpl: Intelligent routing between Google TTS and Coqui TTS
- AudioAssemblyServiceImpl: FFmpeg-based audio processing and assembly
- VideoProcessingService: Video file handling and audio extraction
- FileManager: Temporary file management and cleanup
```

### Processing Pipeline

The integration implements a 6-step processing pipeline:

1. **Audio Extraction** (5-15% progress)
   - Extract audio from uploaded video using FFmpeg
   - Store audio file reference in job context
   - Estimated duration: 30 seconds

2. **Transcription** (15-35% progress)
   - Transcribe audio using Whisper models
   - Automatic model fallback on failure
   - Estimated duration: 2 minutes

3. **Translation** (35-50% progress)
   - Translate transcription to Bangla
   - Preserve original timestamps
   - Estimated duration: 1 minute

4. **TTS Generation** (50-80% progress)
   - Generate speech using intelligent service selection
   - Automatic fallback between Google TTS and Coqui TTS
   - Cost optimization and quota management
   - Estimated duration: 3 minutes

5. **Audio Assembly** (80-95% progress)
   - Assemble audio segments with proper timing
   - Audio normalization and quality enhancement
   - Estimated duration: 45 seconds

6. **Finalization** (95-100% progress)
   - Generate SRT files
   - Save output files to storage
   - Calculate final metrics and costs
   - Estimated duration: 15 seconds

## Key Features

### Progress Tracking

Real-time progress updates are sent via WebSocket:

```typescript
interface JobUpdate {
  jobId: string;
  status: JobStatus;
  progress: number;
  message?: string;
  metrics?: ProcessingMetrics;
  error?: string;
}
```

### Error Recovery

Comprehensive error recovery with step-specific strategies:

- **TTS Quota Errors**: Automatic fallback to Coqui TTS
- **Audio Format Issues**: Alternative extraction parameters
- **Whisper Failures**: Model size fallback (large → medium → base → small)
- **Network Issues**: Exponential backoff retry logic

### Cost Tracking

Detailed cost tracking per processing step:

```typescript
interface CostBreakdown {
  transcriptionCost: number;
  translationCost: number;
  ttsCost: number;
  processingCost: number;
  totalCost: number;
}
```

### Job Context Management

Persistent storage of intermediate processing results:

```sql
-- Job context table for storing processing state
CREATE TABLE job_context (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL,
  context_key TEXT NOT NULL,
  context_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, context_key)
);
```

## Configuration

### JobProcessingConfig

```typescript
interface JobProcessingConfig {
  maxConcurrentProcessing: number;    // Max parallel jobs
  processingTimeout: number;          // Job timeout (ms)
  retryDelay: number;                // Base retry delay (ms)
  maxRetryAttempts: number;          // Max retries per step
  enableProgressTracking: boolean;    // Real-time updates
  enableErrorRecovery: boolean;      // Auto error recovery
  tempDirectory: string;             // Temp file location
}
```

### Service Configurations

```typescript
// Transcription Service
const transcriptionConfig: TranscriptionConfig = {
  whisperModelPath: './models/whisper',
  language: 'en',
  modelSize: 'base',
  temperature: 0.0,
  maxRetries: 3
};

// TTS Router
const ttsConfig: TTSRouterConfig = {
  fallbackEnabled: true,
  abTestingEnabled: true,
  googleTTSWeight: 70,
  coquiTTSWeight: 30,
  quotaThresholds: {
    googleTTS: 100000 // Characters remaining threshold
  }
};

// Audio Assembly
const audioAssemblyConfig: AudioAssemblyConfig = {
  outputFormat: 'wav',
  sampleRate: 44100,
  channels: 2,
  normalizationEnabled: true,
  silencePaddingMs: 100
};
```

## Usage

### Basic Integration

```typescript
const jobProcessingIntegration = new JobProcessingIntegration(
  jobQueueService,
  processingPipeline,
  supabaseClient,
  socketIOServer,
  logger,
  config
);

// The integration automatically handles:
// - Job queue events
// - Service orchestration
// - Progress tracking
// - Error recovery
// - File cleanup
```

### Event Handling

The integration listens for job queue events:

```typescript
// Automatic event handling
jobQueueService.on('jobStarted', (job) => {
  // Starts processing pipeline
});

jobQueueService.on('jobUpdated', (job, update) => {
  // Emits real-time updates via WebSocket
});
```

### WebSocket Updates

Real-time job updates are automatically sent to users:

```typescript
// Client receives updates
socket.on('job_update', (update) => {
  console.log(`Job ${update.payload.jobId}: ${update.payload.progress}%`);
});
```

## Error Handling

### Retry Logic

Each processing step implements intelligent retry logic:

1. **Immediate Retry**: For transient failures
2. **Service Fallback**: Switch to alternative services (TTS)
3. **Parameter Adjustment**: Try different processing parameters
4. **Graceful Degradation**: Continue with reduced quality if needed

### Error Categories

- **Recoverable Errors**: Network issues, temporary service unavailability
- **Service Errors**: TTS quota exceeded, model loading failures
- **Format Errors**: Unsupported codecs, corrupted files
- **System Errors**: Disk space, memory limitations

### Recovery Strategies

```typescript
enum RecoveryAction {
  RETRY_WITH_SAME_PARAMS,
  RETRY_WITH_DIFFERENT_PARAMS,
  FALLBACK_TO_ALTERNATIVE_SERVICE,
  MANUAL_INTERVENTION_REQUIRED,
  ABORT_PROCESSING
}
```

## Monitoring and Metrics

### Processing Metrics

Comprehensive metrics collection:

```typescript
interface ProcessingMetrics {
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
```

### Health Monitoring

System health tracking:

- Active job count
- Success/failure rates
- Average processing times
- Service availability
- Cost tracking

## Database Schema

### Required Tables

```sql
-- Job context for intermediate results
CREATE TABLE job_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  context_key TEXT NOT NULL,
  context_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, context_key)
);

-- Indexes for performance
CREATE INDEX idx_job_context_job_id ON job_context(job_id);
CREATE INDEX idx_job_context_key ON job_context(context_key);
```

### Cleanup Procedures

Automatic cleanup of old job context data:

```sql
-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_job_context()
RETURNS void AS $$
BEGIN
  DELETE FROM job_context 
  WHERE updated_at < NOW() - INTERVAL '7 days'
  AND job_id IN (
    SELECT id FROM dubbing_jobs 
    WHERE status IN ('completed', 'failed')
  );
END;
$$ LANGUAGE plpgsql;
```

## Testing

### Test Coverage

- Service initialization
- Job context management
- Processing step execution
- Error recovery mechanisms
- Metrics calculation
- Cleanup procedures

### Test Files

- `JobProcessingIntegration.test.ts`: Full integration tests
- `JobProcessingIntegration.simple.test.ts`: Core logic tests

## Performance Considerations

### Optimization Strategies

1. **Parallel Processing**: Multiple jobs processed concurrently
2. **Caching**: Intermediate results cached in database
3. **Service Selection**: Intelligent routing for cost/performance optimization
4. **Resource Management**: Automatic cleanup and memory management

### Scalability

- Horizontal scaling through job queue distribution
- Service-specific scaling (separate TTS instances)
- Database optimization with proper indexing
- File storage optimization with cleanup policies

## Security

### Data Protection

- Row-level security on job context table
- Secure file handling with temporary directories
- User isolation for job processing
- Audit logging for all operations

### Error Information

- Sanitized error messages to prevent information leakage
- Secure logging without sensitive data exposure
- Rate limiting for API endpoints

## Future Enhancements

### Planned Features

1. **Batch Processing**: Multiple files in single job
2. **Quality Metrics**: Automated quality assessment
3. **Advanced Caching**: Redis-based caching layer
4. **Monitoring Dashboard**: Real-time system monitoring
5. **API Rate Limiting**: Advanced quota management
6. **Multi-language Support**: Additional target languages

### Integration Points

- External TTS services
- Cloud storage providers
- Monitoring and alerting systems
- Analytics and reporting tools

## Troubleshooting

### Common Issues

1. **Service Initialization Failures**
   - Check service configurations
   - Verify model file paths
   - Ensure proper permissions

2. **Processing Timeouts**
   - Increase timeout values
   - Check system resources
   - Monitor service health

3. **File Management Issues**
   - Verify temp directory permissions
   - Check disk space availability
   - Review cleanup policies

### Debug Information

Enable detailed logging:

```typescript
const config = {
  // ... other config
  logLevel: 'debug',
  enableDetailedMetrics: true
};
```

### Support

For issues and questions:
- Check logs for detailed error information
- Review metrics for performance insights
- Consult service-specific documentation
- Monitor system health dashboards
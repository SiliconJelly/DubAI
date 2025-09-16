# ProcessingStepsVisualization Component

## Overview

The `ProcessingStepsVisualization` component provides a comprehensive, real-time view of the dubbing job processing pipeline. It displays step-by-step progress, service selection options, cost breakdown, quality metrics, and error handling with retry capabilities.

## Features Implemented

### ✅ Step-by-Step Progress Visualization
- **Visual Progress Indicators**: Each processing step shows its current status (pending, processing, completed, failed)
- **Real-time Updates**: Progress updates via WebSocket connections
- **Progress Bars**: Individual step progress with percentage and estimated time remaining
- **Step Icons**: Visual icons for each processing phase (upload, extraction, transcription, etc.)

### ✅ Service Selection Display
- **TTS Service Selection**: Interactive UI for choosing between Google TTS, Coqui TTS, or Auto-select
- **Service Information**: Cost estimates and quality indicators for each service
- **Real-time Service Display**: Shows which service is currently being used during processing
- **Service-specific Metadata**: Displays detailed information about the selected TTS service

### ✅ Processing Metrics and Time Estimation
- **Duration Tracking**: Shows processing time for each step and total duration
- **Time Estimation**: Displays estimated time remaining for current processing step
- **Performance Metrics**: Tracks and displays processing speed and efficiency
- **Historical Data**: Shows completion times for finished steps

### ✅ Error State Handling and Retry Options
- **Error Detection**: Identifies and displays failed processing steps
- **Retry Functionality**: Individual step retry and full job retry options
- **Error Messages**: Clear, actionable error descriptions
- **Retry Counter**: Shows number of retry attempts for each step
- **Graceful Degradation**: Continues processing other steps when possible

### ✅ Quality Metrics and Cost Breakdown
- **Quality Scoring**: Displays quality metrics for completed steps (when available)
- **Cost Tracking**: Real-time cost calculation and display
- **Cost Breakdown**: Detailed breakdown by processing step (transcription, translation, TTS, processing)
- **Savings Display**: Shows cost savings when using local TTS vs cloud services
- **Budget Monitoring**: Tracks total processing costs

## Component Structure

```typescript
interface ProcessingStepsVisualizationProps {
  jobId: string;
  onClose: () => void;
}
```

## Key Features

### Real-time Updates
- WebSocket integration for live progress updates
- Connection status indicator
- Automatic reconnection handling

### Interactive Service Selection
- Pre-processing TTS service selection
- Cost and quality comparison
- Auto-selection based on optimization criteria

### Comprehensive Error Handling
- Step-level error detection
- Retry mechanisms for individual steps
- Full job retry capability
- Error context and suggestions

### Rich Metadata Display
- File size and format information
- Processing parameters
- Service-specific details
- Quality assessments

## Usage

```tsx
import { ProcessingStepsVisualization } from './ProcessingStepsVisualization';

function Dashboard() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <>
      {selectedJobId && (
        <ProcessingStepsVisualization
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </>
  );
}
```

## API Dependencies

The component requires the following API endpoints:
- `GET /api/jobs/:id` - Fetch job details
- `POST /api/jobs/:id/retry` - Retry entire job
- `POST /api/jobs/:id/retry/:stepId` - Retry specific step
- `PATCH /api/jobs/:id/settings` - Update job settings (TTS service selection)

## WebSocket Events

Listens for the following WebSocket events:
- `job_update` - Job status and progress updates
- `processing_metrics` - Step-level metrics and timing
- `queue_update` - Queue position and estimates

## Testing

Comprehensive test suite covering:
- Component rendering and state management
- Real-time update handling
- Error states and retry functionality
- Service selection interactions
- Cost and quality metric display

Run tests with:
```bash
npm test -- ProcessingStepsVisualization.test.tsx
```

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 3.3**: Real-time processing dashboard with detailed status updates
- **Requirement 3.4**: Service selection display and processing metrics
- **Requirement 7.2**: Cost tracking and service optimization display
- **Requirement 7.7**: Quality metrics and cost breakdown visualization

## Future Enhancements

Potential improvements for future iterations:
- Advanced quality metrics visualization
- Processing performance analytics
- Batch processing support
- Custom service configuration
- Export processing reports
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { 
  Play, 
  Pause, 
  Square, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Loader2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { useJobWebSocket } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';

interface JobStatusCardProps {
  job: DubbingJob;
  onDownload?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
}

const statusConfig = {
  [JobStatus.UPLOADED]: {
    label: 'Uploaded',
    color: 'bg-blue-500',
    icon: Clock,
    description: 'Job uploaded and queued for processing'
  },
  [JobStatus.EXTRACTING_AUDIO]: {
    label: 'Extracting Audio',
    color: 'bg-yellow-500',
    icon: Loader2,
    description: 'Extracting audio from video file'
  },
  [JobStatus.TRANSCRIBING]: {
    label: 'Transcribing',
    color: 'bg-orange-500',
    icon: Loader2,
    description: 'Converting speech to text'
  },
  [JobStatus.TRANSLATING]: {
    label: 'Translating',
    color: 'bg-purple-500',
    icon: Loader2,
    description: 'Translating to target language'
  },
  [JobStatus.GENERATING_SPEECH]: {
    label: 'Generating Speech',
    color: 'bg-indigo-500',
    icon: Loader2,
    description: 'Converting text to speech'
  },
  [JobStatus.ASSEMBLING_AUDIO]: {
    label: 'Assembling Audio',
    color: 'bg-pink-500',
    icon: Loader2,
    description: 'Creating final audio track'
  },
  [JobStatus.COMPLETED]: {
    label: 'Completed',
    color: 'bg-green-500',
    icon: CheckCircle,
    description: 'Processing completed successfully'
  },
  [JobStatus.FAILED]: {
    label: 'Failed',
    color: 'bg-red-500',
    icon: AlertCircle,
    description: 'Processing failed'
  }
};

export const JobStatusCard: React.FC<JobStatusCardProps> = ({
  job,
  onDownload,
  onCancel,
  onRetry
}) => {
  const {
    isConnected,
    isAuthenticated,
    jobStatus,
    processingMetrics,
    queueInfo,
    connectionError
  } = useJobWebSocket(job.id);

  const [currentJob, setCurrentJob] = useState(job);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  // Update job data when real-time updates arrive
  useEffect(() => {
    if (jobStatus) {
      setCurrentJob(prev => ({
        ...prev,
        status: jobStatus.status,
        progress: jobStatus.progress,
        errorMessage: jobStatus.error
      }));
    }
  }, [jobStatus]);

  // Calculate estimated time remaining based on processing metrics
  useEffect(() => {
    if (processingMetrics.length > 0 && currentJob.status !== JobStatus.COMPLETED) {
      const completedSteps = processingMetrics.filter(m => m.status === 'completed');
      const avgStepTime = completedSteps.reduce((sum, m) => sum + (m.duration || 0), 0) / completedSteps.length;
      const remainingSteps = 6 - completedSteps.length; // Assuming 6 total steps
      setEstimatedTimeRemaining(avgStepTime * remainingSteps);
    }
  }, [processingMetrics, currentJob.status]);

  const config = statusConfig[currentJob.status];
  const StatusIcon = config.icon;
  const isProcessing = [
    JobStatus.EXTRACTING_AUDIO,
    JobStatus.TRANSCRIBING,
    JobStatus.TRANSLATING,
    JobStatus.GENERATING_SPEECH,
    JobStatus.ASSEMBLING_AUDIO
  ].includes(currentJob.status);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold truncate">
            {currentJob.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Connection status indicator */}
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" title="Connected" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" title="Disconnected" />
            )}
            
            {/* Job status badge */}
            <Badge 
              variant="secondary" 
              className={`${config.color} text-white`}
            >
              <StatusIcon className={`h-3 w-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
              {config.label}
            </Badge>
          </div>
        </div>
        
        {/* Connection error */}
        {connectionError && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            Connection error: {connectionError}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{currentJob.progress}%</span>
          </div>
          <Progress value={currentJob.progress} className="h-2" />
          <p className="text-sm text-gray-600">{config.description}</p>
        </div>

        {/* Queue information */}
        {queueInfo && currentJob.status === JobStatus.UPLOADED && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Queue Position: {queueInfo.queuePosition}</span>
            </div>
            {queueInfo.estimatedStartTime && (
              <p className="text-xs text-blue-600 mt-1">
                Estimated start: {formatDistanceToNow(new Date(queueInfo.estimatedStartTime), { addSuffix: true })}
              </p>
            )}
          </div>
        )}

        {/* Processing metrics */}
        {processingMetrics.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Processing Steps</h4>
            <div className="space-y-1">
              {processingMetrics.map((metric, index) => (
                <div key={metric.stepName} className="flex items-center justify-between text-xs">
                  <span className="capitalize">{metric.stepName.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    {metric.duration && (
                      <span className="text-gray-500">
                        {formatDuration(metric.duration)}
                      </span>
                    )}
                    {metric.serviceUsed && (
                      <Badge variant="outline" className="text-xs">
                        {metric.serviceUsed}
                      </Badge>
                    )}
                    <div className={`w-2 h-2 rounded-full ${
                      metric.status === 'completed' ? 'bg-green-500' :
                      metric.status === 'processing' ? 'bg-yellow-500' :
                      'bg-gray-300'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time estimates */}
        {estimatedTimeRemaining && isProcessing && (
          <div className="text-sm text-gray-600">
            <Clock className="h-4 w-4 inline mr-1" />
            Estimated time remaining: {formatDuration(estimatedTimeRemaining)}
          </div>
        )}

        {/* Error message */}
        {currentJob.errorMessage && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700">{currentJob.errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cost information */}
        {currentJob.processingMetrics.costBreakdown.totalCost > 0 && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Processing Cost: </span>
              <span>${currentJob.processingMetrics.costBreakdown.totalCost.toFixed(4)}</span>
            </div>
            {currentJob.processingMetrics.ttsService && (
              <div className="text-xs text-gray-600 mt-1">
                TTS Service: {currentJob.processingMetrics.ttsService.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {currentJob.status === JobStatus.COMPLETED && onDownload && (
            <Button 
              onClick={() => onDownload(currentJob.id)}
              className="flex-1"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
          
          {currentJob.status === JobStatus.FAILED && onRetry && (
            <Button 
              onClick={() => onRetry(currentJob.id)}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
          
          {isProcessing && onCancel && (
            <Button 
              onClick={() => onCancel(currentJob.id)}
              variant="destructive"
              size="sm"
            >
              <Square className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>

        {/* Timestamps */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          <div className="flex justify-between">
            <span>Created: {formatDistanceToNow(new Date(currentJob.createdAt), { addSuffix: true })}</span>
            <span>Updated: {formatDistanceToNow(new Date(currentJob.updatedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
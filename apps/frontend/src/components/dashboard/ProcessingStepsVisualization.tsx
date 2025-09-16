import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { 
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Play,
  Pause,
  FileAudio,
  FileText,
  Mic,
  Languages,
  Volume2,
  Layers,
  DollarSign,
  Timer,
  Activity,
  RefreshCw,
  TrendingUp,
  Zap
} from 'lucide-react';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { useJobWebSocket } from '../../hooks/useWebSocket';
import { apiClient } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

interface ProcessingStepsVisualizationProps {
  jobId: string;
  onClose: () => void;
}

interface ProcessingStep {
  id: string;
  name: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  serviceUsed?: string;
  costEstimate: number;
  metadata?: Record<string, any>;
  qualityScore?: number;
  estimatedTimeRemaining?: number;
  retryCount?: number;
  canRetry?: boolean;
}

const PROCESSING_STEPS: Omit<ProcessingStep, 'status' | 'progress' | 'startTime' | 'endTime' | 'duration' | 'costEstimate'>[] = [
  {
    id: 'upload',
    name: 'uploaded',
    label: 'File Upload',
    description: 'Video and subtitle files uploaded to the system',
    icon: FileAudio,
    serviceUsed: 'Storage',
    metadata: {}
  },
  {
    id: 'extract',
    name: 'extracting_audio',
    label: 'Audio Extraction',
    description: 'Extracting audio track from video file using FFmpeg',
    icon: FileAudio,
    serviceUsed: 'FFmpeg',
    metadata: {}
  },
  {
    id: 'transcribe',
    name: 'transcribing',
    label: 'Speech Transcription',
    description: 'Converting speech to text using Whisper AI',
    icon: Mic,
    serviceUsed: 'Whisper',
    metadata: {}
  },
  {
    id: 'translate',
    name: 'translating',
    label: 'Text Translation',
    description: 'Translating transcribed text to target language',
    icon: Languages,
    serviceUsed: 'Translation API',
    metadata: {}
  },
  {
    id: 'synthesize',
    name: 'generating_speech',
    label: 'Speech Synthesis',
    description: 'Converting translated text to speech using TTS',
    icon: Volume2,
    serviceUsed: 'TTS Engine',
    metadata: {}
  },
  {
    id: 'assemble',
    name: 'assembling_audio',
    label: 'Audio Assembly',
    description: 'Combining audio segments into final track',
    icon: Layers,
    serviceUsed: 'FFmpeg',
    metadata: {}
  }
];

export const ProcessingStepsVisualization: React.FC<ProcessingStepsVisualizationProps> = ({
  jobId,
  onClose
}) => {
  const [job, setJob] = useState<DubbingJob | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingStep, setRetryingStep] = useState<string | null>(null);
  const [selectedTTSService, setSelectedTTSService] = useState<'google' | 'coqui' | 'auto'>('auto');

  const {
    jobStatus,
    processingMetrics,
    isConnected
  } = useJobWebSocket(jobId);

  // Load job details
  useEffect(() => {
    const loadJob = async () => {
      try {
        setLoading(true);
        const jobData = await apiClient.getJob(jobId);
        setJob(jobData);
        initializeSteps(jobData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load job details');
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [jobId]);

  // Update steps based on real-time updates
  useEffect(() => {
    if (jobStatus && job) {
      const updatedJob = {
        ...job,
        status: jobStatus.status,
        progress: jobStatus.progress,
        errorMessage: jobStatus.error
      };
      setJob(updatedJob);
      updateStepsFromJob(updatedJob);
    }
  }, [jobStatus, job]);

  // Update steps from processing metrics
  useEffect(() => {
    if (processingMetrics.length > 0) {
      setSteps(prevSteps => 
        prevSteps.map(step => {
          const metric = processingMetrics.find(m => m.stepName === step.name);
          if (metric) {
            return {
              ...step,
              status: metric.status as ProcessingStep['status'],
              startTime: metric.startTime,
              endTime: metric.endTime,
              duration: metric.duration,
              serviceUsed: metric.serviceUsed || step.serviceUsed,
              costEstimate: metric.costEstimate || 0,
              metadata: metric.metadata || {}
            };
          }
          return step;
        })
      );
    }
  }, [processingMetrics]);

  const initializeSteps = (jobData: DubbingJob) => {
    const initialSteps: ProcessingStep[] = PROCESSING_STEPS.map(stepTemplate => ({
      ...stepTemplate,
      status: 'pending',
      progress: 0,
      costEstimate: 0
    }));

    updateStepsFromJob(jobData, initialSteps);
  };

  const updateStepsFromJob = (jobData: DubbingJob, initialSteps?: ProcessingStep[]) => {
    const stepsToUpdate = initialSteps || steps;
    
    const updatedSteps = stepsToUpdate.map(step => {
      let status: ProcessingStep['status'] = 'pending';
      let progress = 0;

      // Determine step status based on job status
      switch (jobData.status) {
        case JobStatus.UPLOADED:
          if (step.name === 'uploaded') {
            status = 'completed';
            progress = 100;
          }
          break;
        case JobStatus.EXTRACTING_AUDIO:
          if (step.name === 'uploaded') {
            status = 'completed';
            progress = 100;
          } else if (step.name === 'extracting_audio') {
            status = 'processing';
            progress = jobData.progress;
          }
          break;
        case JobStatus.TRANSCRIBING:
          if (['uploaded', 'extracting_audio'].includes(step.name)) {
            status = 'completed';
            progress = 100;
          } else if (step.name === 'transcribing') {
            status = 'processing';
            progress = jobData.progress;
          }
          break;
        case JobStatus.TRANSLATING:
          if (['uploaded', 'extracting_audio', 'transcribing'].includes(step.name)) {
            status = 'completed';
            progress = 100;
          } else if (step.name === 'translating') {
            status = 'processing';
            progress = jobData.progress;
          }
          break;
        case JobStatus.GENERATING_SPEECH:
          if (['uploaded', 'extracting_audio', 'transcribing', 'translating'].includes(step.name)) {
            status = 'completed';
            progress = 100;
          } else if (step.name === 'generating_speech') {
            status = 'processing';
            progress = jobData.progress;
          }
          break;
        case JobStatus.ASSEMBLING_AUDIO:
          if (['uploaded', 'extracting_audio', 'transcribing', 'translating', 'generating_speech'].includes(step.name)) {
            status = 'completed';
            progress = 100;
          } else if (step.name === 'assembling_audio') {
            status = 'processing';
            progress = jobData.progress;
          }
          break;
        case JobStatus.COMPLETED:
          status = 'completed';
          progress = 100;
          break;
        case JobStatus.FAILED:
          // Mark all steps up to current as completed, current as failed
          const stepOrder = ['uploaded', 'extracting_audio', 'transcribing', 'translating', 'generating_speech', 'assembling_audio'];
          const currentStepIndex = stepOrder.findIndex(s => s === step.name);
          const failedStepIndex = stepOrder.findIndex(s => jobData.errorMessage?.toLowerCase().includes(s));
          
          if (currentStepIndex < failedStepIndex || failedStepIndex === -1) {
            status = 'completed';
            progress = 100;
          } else if (currentStepIndex === failedStepIndex) {
            status = 'failed';
            progress = 0;
          } else {
            status = 'pending';
            progress = 0;
          }
          break;
      }

      return {
        ...step,
        status,
        progress
      };
    });

    if (initialSteps) {
      setSteps(updatedSteps);
    } else {
      setSteps(updatedSteps);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'processing':
        return 'border-blue-200 bg-blue-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const totalCost = steps.reduce((sum, step) => sum + step.costEstimate, 0);
  const totalDuration = steps.reduce((sum, step) => sum + (step.duration || 0), 0);
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const failedSteps = steps.filter(step => step.status === 'failed');
  const currentStep = steps.find(step => step.status === 'processing');
  const averageQuality = steps.filter(s => s.qualityScore).reduce((sum, s) => sum + (s.qualityScore || 0), 0) / steps.filter(s => s.qualityScore).length || 0;

  // Retry functionality
  const handleRetryStep = async (stepId: string) => {
    try {
      setRetryingStep(stepId);
      await apiClient.retryJobStep(jobId, stepId);
      // The step status will be updated via WebSocket
    } catch (err) {
      console.error('Failed to retry step:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry step');
    } finally {
      setRetryingStep(null);
    }
  };

  const handleRetryJob = async () => {
    try {
      setRetryingStep('job');
      await apiClient.retryJob(jobId);
    } catch (err) {
      console.error('Failed to retry job:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry job');
    } finally {
      setRetryingStep(null);
    }
  };

  const handleServiceSelection = async (service: 'google' | 'coqui' | 'auto') => {
    try {
      setSelectedTTSService(service);
      await apiClient.updateJobSettings(jobId, { ttsService: service });
    } catch (err) {
      console.error('Failed to update TTS service:', err);
    }
  };

  if (loading) {
    return (
      <Card className="fixed inset-4 z-50 overflow-auto">
        <CardContent className="flex items-center justify-center min-h-96">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-gray-600">Loading processing details...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="fixed inset-4 z-50 overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Error Loading Job Details</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
            <p className="text-red-600">{error}</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fixed inset-4 z-50 overflow-auto">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Processing Steps: {job?.title}
            </CardTitle>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant={job?.status === JobStatus.COMPLETED ? 'default' : 'secondary'}>
                {job?.status}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                {isConnected ? 'Live Updates' : 'Offline'}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Overall Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Overall Progress</h3>
            <span className="text-sm text-gray-600">
              {completedSteps}/{steps.length} steps completed
            </span>
          </div>
          <Progress value={(completedSteps / steps.length) * 100} className="h-3" />
          
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Timer className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Duration</span>
              </div>
              <p className="text-lg font-semibold">
                {totalDuration > 0 ? formatDuration(totalDuration) : 'Calculating...'}
              </p>
              {currentStep?.estimatedTimeRemaining && (
                <p className="text-xs text-gray-500">
                  ~{formatDuration(currentStep.estimatedTimeRemaining)} remaining
                </p>
              )}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Cost</span>
              </div>
              <p className="text-lg font-semibold">
                ${totalCost.toFixed(4)}
              </p>
              {job?.processingMetrics?.costBreakdown && (
                <p className="text-xs text-gray-500">
                  TTS: ${job.processingMetrics.costBreakdown.ttsCost.toFixed(4)}
                </p>
              )}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Activity className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Progress</span>
              </div>
              <p className="text-lg font-semibold">
                {job?.progress || 0}%
              </p>
              <p className="text-xs text-gray-500">
                {completedSteps}/{steps.length} steps
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Quality</span>
              </div>
              <p className="text-lg font-semibold">
                {averageQuality > 0 ? `${(averageQuality * 100).toFixed(0)}%` : 'N/A'}
              </p>
              {job?.processingMetrics?.ttsService && (
                <p className="text-xs text-gray-500 capitalize">
                  {job.processingMetrics.ttsService} TTS
                </p>
              )}
            </div>
          </div>
        </div>

        {/* TTS Service Selection */}
        {(job?.status === JobStatus.UPLOADED || job?.status === JobStatus.EXTRACTING_AUDIO || job?.status === JobStatus.TRANSCRIBING || job?.status === JobStatus.TRANSLATING) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-blue-600" />
              TTS Service Selection
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => handleServiceSelection('auto')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTTSService === 'auto' 
                    ? 'border-blue-500 bg-blue-100' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Auto Select</span>
                </div>
                <p className="text-sm text-gray-600">
                  Automatically choose the best service based on cost and quality
                </p>
              </button>
              
              <button
                onClick={() => handleServiceSelection('google')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTTSService === 'google' 
                    ? 'border-green-500 bg-green-100' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Google TTS</span>
                </div>
                <p className="text-sm text-gray-600">
                  High quality, cloud-based synthesis
                </p>
                <p className="text-xs text-green-600 mt-1">
                  ~$0.016 per 1K chars
                </p>
              </button>
              
              <button
                onClick={() => handleServiceSelection('coqui')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTTSService === 'coqui' 
                    ? 'border-purple-500 bg-purple-100' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">Coqui TTS</span>
                </div>
                <p className="text-sm text-gray-600">
                  Local processing, cost-effective
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  Free (local compute)
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Error Handling and Retry Options */}
        {failedSteps.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-800">Processing Failed</h4>
                  <p className="text-sm text-red-700 mt-1">
                    {failedSteps.length} step{failedSteps.length > 1 ? 's' : ''} failed. 
                    You can retry individual steps or restart the entire job.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryJob}
                  disabled={retryingStep === 'job'}
                  className="text-red-700 border-red-300 hover:bg-red-100"
                >
                  {retryingStep === 'job' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Retry Job
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Processing Steps */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4">Processing Steps</h3>
          
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            
            return (
              <div
                key={step.id}
                className={`border rounded-lg p-4 transition-all ${getStatusColor(step.status)}`}
              >
                <div className="flex items-start gap-4">
                  {/* Step Icon and Status */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2">
                      <StepIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`w-0.5 h-8 mt-2 ${
                        step.status === 'completed' ? 'bg-green-300' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{step.label}</h4>
                        {getStatusIcon(step.status)}
                        {step.serviceUsed && (
                          <Badge variant="outline" className="text-xs">
                            {step.serviceUsed}
                          </Badge>
                        )}
                        {step.qualityScore && (
                          <Badge variant="secondary" className="text-xs">
                            Quality: {(step.qualityScore * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {step.costEstimate > 0 && (
                          <div className="text-sm text-gray-600">
                            ${step.costEstimate.toFixed(4)}
                          </div>
                        )}
                        {step.status === 'failed' && step.canRetry && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetryStep(step.id)}
                            disabled={retryingStep === step.id}
                            className="text-xs"
                          >
                            {retryingStep === step.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-3">{step.description}</p>

                    {/* Progress Bar for Processing Steps */}
                    {step.status === 'processing' && (
                      <div className="mb-3">
                        <Progress value={step.progress} className="h-2" />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Processing...</span>
                          <div className="flex items-center gap-2">
                            <span>{step.progress}%</span>
                            {step.estimatedTimeRemaining && (
                              <span>• ~{formatDuration(step.estimatedTimeRemaining)} left</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Retry Information */}
                    {step.status === 'failed' && step.retryCount && step.retryCount > 0 && (
                      <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <span className="text-yellow-700">
                          Retried {step.retryCount} time{step.retryCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}

                    {/* Timing Information */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {step.startTime && (
                        <div className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          Started: {formatDistanceToNow(new Date(step.startTime), { addSuffix: true })}
                        </div>
                      )}
                      
                      {step.endTime && (
                        <div className="flex items-center gap-1">
                          <Pause className="h-3 w-3" />
                          Completed: {formatDistanceToNow(new Date(step.endTime), { addSuffix: true })}
                        </div>
                      )}
                      
                      {step.duration && (
                        <div className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Duration: {formatDuration(step.duration)}
                        </div>
                      )}
                    </div>

                    {/* Enhanced Metadata */}
                    {step.metadata && Object.keys(step.metadata).length > 0 && (
                      <div className="mt-2 p-3 bg-white rounded border">
                        <p className="text-xs font-medium text-gray-600 mb-2">Step Details:</p>
                        <div className="text-xs text-gray-500 space-y-1">
                          {Object.entries(step.metadata).map(([key, value]) => {
                            // Special formatting for specific metadata
                            let displayValue = String(value);
                            if (key.includes('size') && typeof value === 'number') {
                              displayValue = `${(value / 1024 / 1024).toFixed(2)} MB`;
                            } else if (key.includes('rate') && typeof value === 'number') {
                              displayValue = `${value} Hz`;
                            } else if (key.includes('duration') && typeof value === 'number') {
                              displayValue = formatDuration(value);
                            }
                            
                            return (
                              <div key={key} className="flex justify-between">
                                <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                                <span className="font-mono">{displayValue}</span>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Service-specific information */}
                        {step.name === 'generating_speech' && step.serviceUsed && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-2 text-xs">
                              <Volume2 className="h-3 w-3" />
                              <span className="font-medium">
                                {step.serviceUsed === 'google' ? 'Google Cloud TTS' : 'Coqui TTS'}
                              </span>
                              {step.serviceUsed === 'google' && (
                                <Badge variant="outline" className="text-xs">Cloud</Badge>
                              )}
                              {step.serviceUsed === 'coqui' && (
                                <Badge variant="outline" className="text-xs">Local</Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cost Breakdown Visualization */}
        {job?.processingMetrics?.costBreakdown && totalCost > 0 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Breakdown
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <p className="text-gray-600">Transcription</p>
                <p className="font-semibold text-green-700">
                  ${job.processingMetrics.costBreakdown.transcriptionCost.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600">Translation</p>
                <p className="font-semibold text-green-700">
                  ${job.processingMetrics.costBreakdown.translationCost.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600">TTS Generation</p>
                <p className="font-semibold text-green-700">
                  ${job.processingMetrics.costBreakdown.ttsCost.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600">Processing</p>
                <p className="font-semibold text-green-700">
                  ${job.processingMetrics.costBreakdown.processingCost.toFixed(4)}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-300 text-center">
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-xl font-bold text-green-800">
                ${job.processingMetrics.costBreakdown.totalCost.toFixed(4)}
              </p>
              {job.processingMetrics.ttsService === 'coqui' && (
                <p className="text-xs text-green-600 mt-1">
                  Saved ~${(job.processingMetrics.costBreakdown.ttsCost * 0.8).toFixed(4)} using local TTS
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error Information */}
        {job?.errorMessage && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-800">Processing Error</h4>
                <p className="text-sm text-red-700 mt-1">{job.errorMessage}</p>
                {failedSteps.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-red-600">Failed steps:</p>
                    <ul className="text-xs text-red-600 ml-4 list-disc">
                      {failedSteps.map(step => (
                        <li key={step.id}>{step.label}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
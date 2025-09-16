import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { 
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Play,
  FileAudio,
  Mic,
  Languages,
  Volume2,
  Layers,
  DollarSign,
  Timer,
  Activity,
  RefreshCw,
  TrendingUp,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';
import { DubbingJob, JobStatus } from '@dubai/shared';

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
}

interface MobileProcessingStepsProps {
  job: DubbingJob;
  steps: ProcessingStep[];
  onRetryStep?: (stepId: string) => void;
  onRetryJob?: () => void;
  isRetrying?: boolean;
  className?: string;
}

const STEP_ICONS = {
  uploaded: FileAudio,
  extracting_audio: FileAudio,
  transcribing: Mic,
  translating: Languages,
  generating_speech: Volume2,
  assembling_audio: Layers,
};

export const MobileProcessingSteps: React.FC<MobileProcessingStepsProps> = ({
  job,
  steps,
  onRetryStep,
  onRetryJob,
  isRetrying = false,
  className
}) => {
  const { isMobile } = useResponsive();
  const [selectedStep, setSelectedStep] = useState<ProcessingStep | null>(null);

  const getStatusIcon = (status: ProcessingStep['status'], size = 'h-4 w-4') => {
    switch (status) {
      case 'completed':
        return <CheckCircle className={cn(size, 'text-green-600')} />;
      case 'processing':
        return <Loader2 className={cn(size, 'text-blue-600 animate-spin')} />;
      case 'failed':
        return <AlertCircle className={cn(size, 'text-red-600')} />;
      default:
        return <Clock className={cn(size, 'text-muted-foreground')} />;
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
        return 'border-muted bg-muted/20';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const failedSteps = steps.filter(step => step.status === 'failed');
  const currentStep = steps.find(step => step.status === 'processing');
  const totalCost = steps.reduce((sum, step) => sum + step.costEstimate, 0);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Mobile Progress Overview */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-medium">Processing Progress</span>
            </div>
            <Badge variant={job.status === JobStatus.COMPLETED ? 'default' : 'secondary'}>
              {job.status}
            </Badge>
          </div>
          
          <Progress value={(completedSteps / steps.length) * 100} className="h-3 mb-3" />
          
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{completedSteps}/{steps.length} steps</span>
            <span>{job.progress}%</span>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Timer className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium">Duration</span>
              </div>
              <p className="text-sm font-semibold">
                {currentStep?.estimatedTimeRemaining 
                  ? `~${formatDuration(currentStep.estimatedTimeRemaining)}` 
                  : 'Calculating...'}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium">Cost</span>
              </div>
              <p className="text-sm font-semibold">
                ${totalCost.toFixed(4)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {failedSteps.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800 mb-1">Processing Failed</h4>
                <p className="text-sm text-red-700 mb-3">
                  {failedSteps.length} step{failedSteps.length > 1 ? 's' : ''} failed.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetryJob}
                  disabled={isRetrying}
                  className="w-full text-red-700 border-red-300 hover:bg-red-100 touch-manipulation"
                >
                  {isRetrying ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Retry Job
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile Steps List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Processing Steps</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            {steps.map((step, index) => {
              const StepIcon = STEP_ICONS[step.name as keyof typeof STEP_ICONS] || Activity;
              
              return (
                <Sheet key={step.id}>
                  <SheetTrigger asChild>
                    <button
                      className={cn(
                        'w-full p-4 text-left transition-colors hover:bg-accent/50 touch-manipulation',
                        index !== steps.length - 1 && 'border-b border-border/50'
                      )}
                      onClick={() => setSelectedStep(step)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Step Icon */}
                        <div className={cn(
                          'flex items-center justify-center w-10 h-10 rounded-full border-2',
                          step.status === 'completed' ? 'bg-green-100 border-green-300' :
                          step.status === 'processing' ? 'bg-blue-100 border-blue-300' :
                          step.status === 'failed' ? 'bg-red-100 border-red-300' :
                          'bg-muted border-muted-foreground/30'
                        )}>
                          <StepIcon className="h-5 w-5 text-muted-foreground" />
                        </div>

                        {/* Step Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-sm truncate">{step.label}</h4>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {getStatusIcon(step.status)}
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          
                          {/* Progress for processing steps */}
                          {step.status === 'processing' && (
                            <div className="mb-2">
                              <Progress value={step.progress} className="h-1.5" />
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Processing...</span>
                                <span>{step.progress}%</span>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate">{step.description}</span>
                            {step.costEstimate > 0 && (
                              <span className="flex-shrink-0 ml-2">
                                ${step.costEstimate.toFixed(4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </SheetTrigger>

                  {/* Step Details Sheet */}
                  <SheetContent side="bottom" className="h-auto max-h-[80vh]">
                    <div className="space-y-4 pb-safe">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex items-center justify-center w-12 h-12 rounded-full border-2',
                          getStatusColor(step.status)
                        )}>
                          <StepIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{step.label}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusIcon(step.status)}
                            <span className="text-sm text-muted-foreground capitalize">
                              {step.status}
                            </span>
                            {step.serviceUsed && (
                              <Badge variant="outline" className="text-xs">
                                {step.serviceUsed}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-muted-foreground">{step.description}</p>

                      {/* Progress */}
                      {step.status === 'processing' && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span>Progress</span>
                            <span>{step.progress}%</span>
                          </div>
                          <Progress value={step.progress} className="h-2" />
                          {step.estimatedTimeRemaining && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Estimated time remaining: {formatDuration(step.estimatedTimeRemaining)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        {step.duration && (
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Timer className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium">Duration</span>
                            </div>
                            <p className="text-lg font-semibold">
                              {formatDuration(step.duration)}
                            </p>
                          </div>
                        )}
                        
                        {step.costEstimate > 0 && (
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium">Cost</span>
                            </div>
                            <p className="text-lg font-semibold">
                              ${step.costEstimate.toFixed(4)}
                            </p>
                          </div>
                        )}
                        
                        {step.qualityScore && (
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingUp className="h-4 w-4 text-purple-600" />
                              <span className="text-sm font-medium">Quality</span>
                            </div>
                            <p className="text-lg font-semibold">
                              {(step.qualityScore * 100).toFixed(0)}%
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      {step.metadata && Object.keys(step.metadata).length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Technical Details
                          </h4>
                          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                            {Object.entries(step.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-muted-foreground capitalize">
                                  {key.replace(/_/g, ' ')}:
                                </span>
                                <span className="font-mono text-foreground">
                                  {String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Retry Button */}
                      {step.status === 'failed' && onRetryStep && (
                        <Button
                          onClick={() => onRetryStep(step.id)}
                          disabled={isRetrying}
                          className="w-full touch-manipulation"
                          variant="outline"
                        >
                          {isRetrying ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Retry This Step
                        </Button>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
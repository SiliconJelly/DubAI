import React from 'react';
import { CheckCircle, XCircle, Upload, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface UploadProgress {
  fileId: string;
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
}

interface ProgressIndicatorProps {
  uploads: UploadProgress[];
  className?: string;
  showDetails?: boolean;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  uploads,
  className,
  showDetails = true
}) => {
  const formatSpeed = (bytesPerSecond: number): string => {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let speed = bytesPerSecond;
    let unitIndex = 0;

    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }

    return `${speed.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'uploading':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Upload className="h-5 w-5 text-gray-400" />;
    }
  };

  const getProgressColor = (status: UploadProgress['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      case 'uploading':
        return 'bg-blue-600';
      default:
        return 'bg-gray-400';
    }
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {uploads.map((upload) => (
        <div
          key={upload.fileId}
          className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              {getStatusIcon(upload.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {upload.filename}
                </p>
                {upload.error && (
                  <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {upload.progress}%
              </p>
              {showDetails && upload.status === 'uploading' && (
                <div className="text-xs text-gray-500 space-y-1">
                  {upload.speed && (
                    <p>{formatSpeed(upload.speed)}</p>
                  )}
                  {upload.timeRemaining && (
                    <p>{formatTime(upload.timeRemaining)} left</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <Progress 
            value={upload.progress} 
            className="h-2"
          />
          
          {upload.status === 'completed' && (
            <p className="text-xs text-green-600 mt-2 flex items-center">
              <CheckCircle className="h-3 w-3 mr-1" />
              Upload completed successfully
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

// Summary component for overall upload progress
interface UploadSummaryProps {
  uploads: UploadProgress[];
  className?: string;
}

export const UploadSummary: React.FC<UploadSummaryProps> = ({
  uploads,
  className
}) => {
  const totalUploads = uploads.length;
  const completedUploads = uploads.filter(u => u.status === 'completed').length;
  const failedUploads = uploads.filter(u => u.status === 'error').length;
  const activeUploads = uploads.filter(u => u.status === 'uploading').length;
  
  const overallProgress = totalUploads > 0 
    ? Math.round(uploads.reduce((sum, upload) => sum + upload.progress, 0) / totalUploads)
    : 0;

  if (totalUploads === 0) {
    return null;
  }

  return (
    <div className={cn('bg-gray-50 border border-gray-200 rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Upload Progress</h3>
        <span className="text-sm text-gray-600">{overallProgress}%</span>
      </div>
      
      <Progress value={overallProgress} className="h-2 mb-3" />
      
      <div className="flex justify-between text-xs text-gray-600">
        <span>{completedUploads} completed</span>
        {activeUploads > 0 && <span>{activeUploads} uploading</span>}
        {failedUploads > 0 && <span className="text-red-600">{failedUploads} failed</span>}
      </div>
    </div>
  );
};
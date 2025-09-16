import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { FileUploader, FileUploadItem } from './FileUploader';
import { FileManagement } from './FilePreview';
import { ProgressIndicator, UploadSummary } from './ProgressIndicator';
import { useFileUpload } from '@/hooks/useFileUpload';
import { cn } from '@/lib/utils';

interface UploadContainerProps {
  onUploadComplete?: (fileIds: string[]) => void;
  onCreateJob?: (videoFileId?: string, srtFileId?: string) => void;
  className?: string;
  title?: string;
  description?: string;
  showCreateJobButton?: boolean;
}

export const UploadContainer: React.FC<UploadContainerProps> = ({
  onUploadComplete,
  onCreateJob,
  className,
  title = "Upload Your Files",
  description = "Upload your video file and SRT subtitle file to get started with dubbing.",
  showCreateJobButton = true
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);

  const {
    files,
    isUploading,
    addFiles,
    removeFile,
    startUpload,
    cancelUpload,
    clearFiles,
    hasVideoFile,
    hasSrtFile,
    canStartUpload
  } = useFileUpload({
    maxFiles: 2,
    onUploadComplete: (fileIds) => {
      setUploadedFileIds(fileIds);
      setSuccess('Files uploaded successfully!');
      setError(null);
      if (onUploadComplete) {
        onUploadComplete(fileIds);
      }
    },
    onUploadError: (uploadError) => {
      setError(uploadError.message);
      setSuccess(null);
    }
  });

  const handleFilesSelected = (newFiles: FileUploadItem[]) => {
    // Clear previous messages
    setError(null);
    setSuccess(null);
    
    // Add files using the file objects
    const fileObjects = newFiles.map(item => item.file);
    addFiles(fileObjects);
  };

  const handleCreateJob = () => {
    if (!onCreateJob) return;

    const videoFile = files.find(f => f.type === 'video' && f.status === 'completed');
    const srtFile = files.find(f => f.type === 'srt' && f.status === 'completed');
    
    // For now, we'll use the file IDs from the uploaded files
    // In a real implementation, these would come from the upload response
    const videoFileId = videoFile ? uploadedFileIds[files.indexOf(videoFile)] : undefined;
    const srtFileId = srtFile ? uploadedFileIds[files.indexOf(srtFile)] : undefined;
    
    onCreateJob(videoFileId, srtFileId);
  };

  const getUploadButtonText = () => {
    if (isUploading) return 'Uploading...';
    if (files.length === 0) return 'Select files first';
    return `Upload ${files.length} file${files.length > 1 ? 's' : ''}`;
  };

  const getJobButtonText = () => {
    if (!hasVideoFile && !hasSrtFile) return 'Upload files to create job';
    if (!hasVideoFile) return 'Video file required';
    return 'Create Dubbing Job';
  };

  const canCreateJob = hasVideoFile && files.some(f => f.status === 'completed');

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UploadIcon className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <p className="text-sm text-gray-600">{description}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* File Uploader */}
          <FileUploader
            onFilesSelected={handleFilesSelected}
            onFileRemove={removeFile}
            uploadedFiles={files}
            maxFiles={2}
            disabled={isUploading}
          />

          {/* Upload Progress */}
          {files.length > 0 && (
            <>
              <Separator />
              <UploadSummary 
                uploads={files.map(f => ({
                  fileId: f.id,
                  filename: f.file.name,
                  progress: f.progress,
                  status: f.status,
                  error: f.error
                }))}
              />
            </>
          )}

          {/* Action Buttons */}
          {files.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={startUpload}
                disabled={!canStartUpload}
                className="flex-1"
              >
                {getUploadButtonText()}
              </Button>
              
              {isUploading && (
                <Button
                  variant="outline"
                  onClick={cancelUpload}
                  className="flex-1 sm:flex-none"
                >
                  Cancel Upload
                </Button>
              )}
              
              {!isUploading && files.length > 0 && (
                <Button
                  variant="outline"
                  onClick={clearFiles}
                  className="flex-1 sm:flex-none"
                >
                  Clear All
                </Button>
              )}
            </div>
          )}

          {/* Create Job Button */}
          {showCreateJobButton && files.some(f => f.status === 'completed') && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Ready to Process</h3>
                <Button
                  onClick={handleCreateJob}
                  disabled={!canCreateJob}
                  className="w-full"
                  size="lg"
                >
                  {getJobButtonText()}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  {hasVideoFile && hasSrtFile 
                    ? 'Both video and subtitle files will be processed together'
                    : hasVideoFile 
                    ? 'Video will be processed without subtitles'
                    : 'At least a video file is required to create a job'
                  }
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* File Management */}
      {files.length > 0 && (
        <FileManagement
          files={files}
          onRemove={removeFile}
        />
      )}
    </div>
  );
};
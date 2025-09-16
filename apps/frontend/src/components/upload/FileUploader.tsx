import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileVideo, FileText, AlertCircle, Camera, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';

export interface FileUploadItem {
  file: File;
  id: string;
  type: 'video' | 'srt';
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FileUploaderProps {
  onFilesSelected: (files: FileUploadItem[]) => void;
  onFileRemove: (fileId: string) => void;
  uploadedFiles: FileUploadItem[];
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

const ACCEPTED_VIDEO_TYPES = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/webm': ['.webm']
};

const ACCEPTED_SRT_TYPES = {
  'text/plain': ['.srt'],
  'application/x-subrip': ['.srt']
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  onFileRemove,
  uploadedFiles,
  maxFiles = 2,
  disabled = false,
  className
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { isMobile, isTouchDevice } = useResponsive();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): { isValid: boolean; error?: string; type?: 'video' | 'srt' } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { isValid: false, error: `File size must be less than 500MB` };
    }

    // Check if it's a video file
    if (Object.keys(ACCEPTED_VIDEO_TYPES).includes(file.type) || 
        file.name.toLowerCase().match(/\.(mp4|mov|avi|webm)$/)) {
      return { isValid: true, type: 'video' };
    }

    // Check if it's an SRT file
    if (file.name.toLowerCase().endsWith('.srt')) {
      return { isValid: true, type: 'srt' };
    }

    return { 
      isValid: false, 
      error: 'Only video files (MP4, MOV, AVI, WebM) and SRT subtitle files are allowed' 
    };
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setValidationErrors([]);
    const errors: string[] = [];
    const validFiles: FileUploadItem[] = [];

    // Check if adding these files would exceed the limit
    if (uploadedFiles.length + acceptedFiles.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      setValidationErrors(errors);
      return;
    }

    acceptedFiles.forEach((file) => {
      const validation = validateFile(file);
      
      if (!validation.isValid) {
        errors.push(`${file.name}: ${validation.error}`);
        return;
      }

      // Check for duplicate file types
      const existingFileOfType = uploadedFiles.find(f => f.type === validation.type);
      if (existingFileOfType) {
        errors.push(`${validation.type === 'video' ? 'Video' : 'SRT'} file already uploaded`);
        return;
      }

      validFiles.push({
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: validation.type!,
        progress: 0,
        status: 'pending'
      });
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [uploadedFiles, maxFiles, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    multiple: true,
    noClick: isMobile, // Disable click on mobile to use custom buttons
    noKeyboard: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDropAccepted: () => setDragActive(false),
    onDropRejected: () => setDragActive(false)
  });

  const handleMobileFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleMobileFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onDrop(files);
    }
  };

  const getFileIcon = (type: 'video' | 'srt') => {
    return type === 'video' ? FileVideo : FileText;
  };

  const getStatusColor = (status: FileUploadItem['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'uploading':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Hidden file input for mobile */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp4,.mov,.avi,.webm,.srt"
        onChange={handleMobileFileChange}
        className="hidden"
      />

      {/* Upload Area */}
      <Card className={cn(
        'border-2 border-dashed transition-all duration-200',
        isDragActive || dragActive 
          ? 'border-primary bg-primary/5 scale-[1.02]' 
          : 'border-muted-foreground/25',
        disabled && 'opacity-50 cursor-not-allowed',
        !isMobile && 'cursor-pointer hover:border-primary/50 hover:bg-accent/20',
        isMobile && 'touch-manipulation'
      )}>
        <CardContent className={cn(
          'p-6',
          isMobile ? 'p-4' : 'p-8'
        )}>
          <div
            {...(!isMobile ? getRootProps() : {})}
            className="text-center"
          >
            {!isMobile && <input {...getInputProps()} />}
            
            <div className={cn(
              'flex flex-col items-center space-y-4',
              isMobile && 'space-y-3'
            )}>
              <div className={cn(
                'rounded-full p-4 bg-primary/10',
                isMobile && 'p-3'
              )}>
                <Upload className={cn(
                  'text-primary',
                  isMobile ? 'h-8 w-8' : 'h-12 w-12'
                )} />
              </div>
              
              <div className="space-y-2 text-center">
                <p className={cn(
                  'font-medium text-foreground',
                  isMobile ? 'text-base' : 'text-lg'
                )}>
                  {isDragActive || dragActive ? 'Drop files here' : 'Upload your files'}
                </p>
                
                {!isMobile && (
                  <p className="text-sm text-muted-foreground">
                    Drag and drop your video and SRT files, or click to browse
                  </p>
                )}
                
                <p className={cn(
                  'text-muted-foreground',
                  isMobile ? 'text-xs' : 'text-sm'
                )}>
                  Supported: MP4, MOV, AVI, WebM (max 500MB) • SRT subtitles
                </p>
              </div>

              {/* Mobile-specific buttons */}
              {isMobile ? (
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                  <Button 
                    type="button" 
                    variant="default"
                    className="flex-1 h-12 text-base touch-manipulation"
                    disabled={disabled}
                    onClick={handleMobileFileSelect}
                  >
                    <FolderOpen className="h-5 w-5 mr-2" />
                    Choose Files
                  </Button>
                  
                  {/* Camera button for mobile video capture */}
                  <Button 
                    type="button" 
                    variant="outline"
                    className="flex-1 h-12 text-base touch-manipulation"
                    disabled={disabled}
                    onClick={() => {
                      // This would open camera for video recording
                      // For now, just use file picker with camera preference
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/*';
                      input.capture = 'environment';
                      input.onchange = (e) => {
                        const files = Array.from((e.target as HTMLInputElement).files || []);
                        if (files.length > 0) {
                          onDrop(files);
                        }
                      };
                      input.click();
                    }}
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Record
                  </Button>
                </div>
              ) : (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="mt-4"
                  disabled={disabled}
                >
                  Choose Files
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className={cn(
            'font-medium text-foreground',
            isMobile ? 'text-sm' : 'text-base'
          )}>
            Uploaded Files
          </h3>
          
          <div className={cn(
            'space-y-2',
            isMobile && 'space-y-3'
          )}>
            {uploadedFiles.map((fileItem) => {
              const Icon = getFileIcon(fileItem.type);
              return (
                <Card key={fileItem.id} className={cn(
                  'transition-all duration-200',
                  isMobile ? 'p-3' : 'p-4'
                )}>
                  <div className={cn(
                    'flex items-center gap-3',
                    isMobile && 'flex-col space-y-3'
                  )}>
                    {/* File Info */}
                    <div className={cn(
                      'flex items-center gap-3 flex-1 min-w-0',
                      isMobile && 'w-full'
                    )}>
                      <div className={cn(
                        'flex-shrink-0 p-2 rounded-lg bg-accent/50',
                        isMobile && 'p-3'
                      )}>
                        <Icon className={cn(
                          getStatusColor(fileItem.status),
                          isMobile ? 'h-6 w-6' : 'h-5 w-5'
                        )} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-medium text-foreground truncate',
                          isMobile ? 'text-base' : 'text-sm'
                        )}>
                          {fileItem.file.name}
                        </p>
                        <p className={cn(
                          'text-muted-foreground',
                          isMobile ? 'text-sm' : 'text-xs'
                        )}>
                          {(fileItem.file.size / (1024 * 1024)).toFixed(2)} MB • {fileItem.type.toUpperCase()}
                        </p>
                        {fileItem.error && (
                          <p className={cn(
                            'text-destructive mt-1',
                            isMobile ? 'text-sm' : 'text-xs'
                          )}>
                            {fileItem.error}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress and Actions */}
                    <div className={cn(
                      'flex items-center gap-3',
                      isMobile && 'w-full justify-between'
                    )}>
                      {fileItem.status === 'uploading' && (
                        <div className={cn(
                          'flex-1',
                          isMobile ? 'max-w-none' : 'w-24'
                        )}>
                          <Progress 
                            value={fileItem.progress} 
                            className={cn(
                              isMobile ? 'h-3' : 'h-2'
                            )} 
                          />
                          <p className={cn(
                            'text-muted-foreground mt-1 text-center',
                            isMobile ? 'text-sm' : 'text-xs'
                          )}>
                            {fileItem.progress}%
                          </p>
                        </div>
                      )}
                      
                      <Button
                        variant="ghost"
                        size={isMobile ? "default" : "sm"}
                        onClick={() => onFileRemove(fileItem.id)}
                        disabled={fileItem.status === 'uploading'}
                        className={cn(
                          'flex-shrink-0 touch-manipulation',
                          isMobile && 'h-10 w-10 p-0'
                        )}
                      >
                        <X className={cn(
                          isMobile ? 'h-5 w-5' : 'h-4 w-4'
                        )} />
                        {!isMobile && <span className="sr-only">Remove file</span>}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
import { useState, useCallback, useRef } from 'react';
import { FileUploadItem } from '@/components/upload/FileUploader';
import { fileUploadService } from '@/services/fileUploadService';
import { validateFileList } from '@/components/upload/FileValidator';

export interface UseFileUploadOptions {
  maxFiles?: number;
  onUploadComplete?: (fileIds: string[]) => void;
  onUploadError?: (error: Error) => void;
}

export interface UseFileUploadReturn {
  files: FileUploadItem[];
  isUploading: boolean;
  uploadProgress: Record<string, number>;
  addFiles: (newFiles: File[]) => void;
  removeFile: (fileId: string) => void;
  startUpload: () => Promise<void>;
  cancelUpload: () => void;
  clearFiles: () => void;
  hasVideoFile: boolean;
  hasSrtFile: boolean;
  canStartUpload: boolean;
}

export const useFileUpload = (options: UseFileUploadOptions = {}): UseFileUploadReturn => {
  const { maxFiles = 2, onUploadComplete, onUploadError } = options;
  
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const { validFiles, errors } = validateFileList(newFiles, files);
    
    if (errors.length > 0) {
      console.warn('File validation errors:', errors);
      // You might want to show these errors to the user
      return;
    }

    // Check if adding these files would exceed the limit
    if (files.length + validFiles.length > maxFiles) {
      console.warn(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFileItems: FileUploadItem[] = validFiles.map(({ file, type }) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      progress: 0,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFileItems]);
  }, [files, maxFiles]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  }, []);

  const updateFileStatus = useCallback((fileId: string, status: FileUploadItem['status'], progress?: number, error?: string) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, status, progress: progress ?? file.progress, error }
        : file
    ));
  }, []);

  const startUpload = useCallback(async () => {
    if (files.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    abortControllerRef.current = new AbortController();
    
    try {
      const uploadPromises = files.map(async (fileItem) => {
        updateFileStatus(fileItem.id, 'uploading', 0);
        
        try {
          const fileId = await fileUploadService.uploadFileComplete(
            fileItem.file,
            {
              onProgress: (progress) => {
                setUploadProgress(prev => ({
                  ...prev,
                  [fileItem.id]: progress
                }));
                updateFileStatus(fileItem.id, 'uploading', progress);
              },
              signal: abortControllerRef.current?.signal
            }
          );

          updateFileStatus(fileItem.id, 'completed', 100);
          return fileId;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          updateFileStatus(fileItem.id, 'error', 0, errorMessage);
          throw error;
        }
      });

      const fileIds = await Promise.all(uploadPromises);
      
      if (onUploadComplete) {
        onUploadComplete(fileIds);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      if (onUploadError) {
        onUploadError(error instanceof Error ? error : new Error('Upload failed'));
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }, [files, isUploading, updateFileStatus, onUploadComplete, onUploadError]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsUploading(false);
    
    // Reset uploading files to pending
    setFiles(prev => prev.map(file => 
      file.status === 'uploading' 
        ? { ...file, status: 'pending', progress: 0 }
        : file
    ));
    
    setUploadProgress({});
  }, []);

  const clearFiles = useCallback(() => {
    if (isUploading) {
      cancelUpload();
    }
    
    setFiles([]);
    setUploadProgress({});
  }, [isUploading, cancelUpload]);

  // Computed properties
  const hasVideoFile = files.some(f => f.type === 'video');
  const hasSrtFile = files.some(f => f.type === 'srt');
  const canStartUpload = files.length > 0 && !isUploading && files.every(f => f.status !== 'uploading');

  return {
    files,
    isUploading,
    uploadProgress,
    addFiles,
    removeFile,
    startUpload,
    cancelUpload,
    clearFiles,
    hasVideoFile,
    hasSrtFile,
    canStartUpload
  };
};
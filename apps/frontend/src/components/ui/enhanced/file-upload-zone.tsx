import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileVideo, FileText, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  acceptedTypes?: string[];
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesSelected,
  maxFiles = 2,
  disabled = false,
  className,
  acceptedTypes = ['video/*', '.srt']
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const sparkleRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles(prev => [...prev, ...acceptedFiles]);
    onFilesSelected(acceptedFiles);
    
    // Simulate upload progress
    acceptedFiles.forEach((file, index) => {
      const fileId = `${file.name}-${Date.now()}-${index}`;
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
      }, 200);
    });
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    disabled,
    multiple: maxFiles > 1,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  const removeFile = (fileToRemove: File) => {
    setUploadedFiles(prev => prev.filter(file => file !== fileToRemove));
  };

  return (
    <div className={cn('relative', className)}>
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl opacity-50" />
      
      {/* Main Upload Zone */}
      <motion.div
        {...getRootProps()}
        className={cn(
          'relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500 cursor-pointer',
          'backdrop-blur-xl bg-white/30 shadow-2xl',
          isDragActive || dropzoneActive
            ? 'border-blue-400 bg-blue-50/50 shadow-blue-200/50'
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        animate={{
          borderColor: isDragActive ? '#60a5fa' : '#d1d5db',
        }}
      >
        <input {...getInputProps()} />
        
        {/* Sparkle Animation */}
        <div ref={sparkleRef} className="absolute inset-0 pointer-events-none">
          <AnimatePresence>
            {isDragActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-blue-400 rounded-full"
                    initial={{
                      x: Math.random() * 400,
                      y: Math.random() * 200,
                      scale: 0,
                    }}
                    animate={{
                      x: Math.random() * 400,
                      y: Math.random() * 200,
                      scale: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative p-12 text-center">
          {/* Upload Icon with Animation */}
          <motion.div
            className="mx-auto mb-6 relative"
            animate={{
              y: isDragActive ? -10 : 0,
              rotate: isDragActive ? 5 : 0,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="relative">
              <Upload className="w-16 h-16 text-gray-400 mx-auto" />
              {isDragActive && (
                <motion.div
                  className="absolute inset-0 bg-blue-400 rounded-full opacity-20"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </div>
          </motion.div>

          {/* Text Content */}
          <motion.div
            animate={{
              scale: isDragActive ? 1.05 : 1,
            }}
            className="space-y-4"
          >
            <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
              {isDragActive ? 'Drop your files here' : 'Upload your media files'}
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Drag and drop your video and SRT files, or click to browse. 
              We support MP4, MOV, AVI, WebM up to 500MB.
            </p>
          </motion.div>

          {/* Upload Button */}
          <motion.button
            type="button"
            className={cn(
              'mt-8 px-8 py-4 rounded-2xl font-semibold text-white',
              'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600',
              'shadow-lg hover:shadow-xl transition-all duration-300',
              'hover:scale-105 active:scale-95',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            disabled={disabled}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Choose Files
            </span>
          </motion.button>
        </div>
      </motion.div>

      {/* Uploaded Files Display */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6 space-y-3"
          >
            <h4 className="text-lg font-semibold text-gray-900">Uploaded Files</h4>
            {uploadedFiles.map((file, index) => (
              <FileCard
                key={`${file.name}-${index}`}
                file={file}
                progress={uploadProgress[`${file.name}-${Date.now()}-${index}`] || 0}
                onRemove={() => removeFile(file)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface FileCardProps {
  file: File;
  progress: number;
  onRemove: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, progress, onRemove }) => {
  const isVideo = file.type.startsWith('video/');
  const isComplete = progress >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/40 border border-white/20 shadow-lg"
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {isVideo ? (
                <FileVideo className="w-8 h-8 text-blue-600" />
              ) : (
                <FileText className="w-8 h-8 text-green-600" />
              )}
              {isComplete && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 bg-white rounded-full" />
                </motion.div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB • {isVideo ? 'Video' : 'Subtitle'}
              </p>
            </div>
          </div>

          <button
            onClick={onRemove}
            className="p-1 rounded-full hover:bg-red-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
          </button>
        </div>

        {/* Progress Bar */}
        {!isComplete && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Uploading...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
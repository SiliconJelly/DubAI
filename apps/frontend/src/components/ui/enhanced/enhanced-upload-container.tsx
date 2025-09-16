import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Sparkles, CheckCircle2, AlertCircle, Zap, ArrowRight } from 'lucide-react';
import { FileUploadZone } from './file-upload-zone';
import { AnimatedProgress } from './animated-progress';
import { FilePreviewCard } from './file-preview-card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface EnhancedUploadContainerProps {
  onUploadComplete?: (fileIds: string[]) => void;
  onCreateJob?: (videoFileId?: string, srtFileId?: string) => void;
  className?: string;
  title?: string;
  description?: string;
  showCreateJobButton?: boolean;
}

export const EnhancedUploadContainer: React.FC<EnhancedUploadContainerProps> = ({
  onUploadComplete,
  onCreateJob,
  className,
  title = "Upload Your Media Files",
  description = "Transform your content with AI-powered dubbing technology",
  showCreateJobButton = true
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFilesSelected = (files: File[]) => {
    setError(null);
    setSuccess(null);
    setUploadedFiles(prev => [...prev, ...files]);
    
    // Simulate upload process
    setIsUploading(true);
    files.forEach((file, index) => {
      const fileId = `${file.name}-${Date.now()}-${index}`;
      let progress = 0;
      
      const interval = setInterval(() => {
        progress += Math.random() * 10 + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          // Check if all files are done
          const allFiles = [...uploadedFiles, ...files];
          const allComplete = allFiles.every((_, i) => {
            const id = `${allFiles[i].name}-${Date.now()}-${i}`;
            return uploadProgress[id] === 100 || file === allFiles[i];
          });
          
          if (allComplete) {
            setIsUploading(false);
            setSuccess('All files uploaded successfully!');
            if (onUploadComplete) {
              onUploadComplete(['file1', 'file2']); // Mock file IDs
            }
          }
        }
        
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
      }, 150);
    });
  };

  const removeFile = (fileToRemove: File) => {
    setUploadedFiles(prev => prev.filter(file => file !== fileToRemove));
  };

  const handleCreateJob = () => {
    if (!onCreateJob) return;
    
    const videoFile = uploadedFiles.find(f => f.type.startsWith('video/'));
    const srtFile = uploadedFiles.find(f => f.name.endsWith('.srt'));
    
    onCreateJob(videoFile ? 'video-id' : undefined, srtFile ? 'srt-id' : undefined);
  };

  const hasVideoFile = uploadedFiles.some(f => f.type.startsWith('video/'));
  const hasSrtFile = uploadedFiles.some(f => f.name.endsWith('.srt'));
  const canCreateJob = hasVideoFile && !isUploading;

  return (
    <div className={cn('relative min-h-screen', className)}>
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/30 mb-6"
            whileHover={{ scale: 1.05 }}
          >
            <Upload className="w-8 h-8 text-blue-600" />
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4">
            {title}
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {description}
          </p>
        </motion.div>

        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <FileUploadZone
            onFilesSelected={handleFilesSelected}
            maxFiles={2}
            disabled={isUploading}
          />
        </motion.div>

        {/* Upload Progress */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-500" />
                  Upload Progress
                </h3>
                {uploadedFiles.map((file, index) => {
                  const fileId = `${file.name}-${Date.now()}-${index}`;
                  const progress = uploadProgress[fileId] || 0;
                  return (
                    <AnimatedProgress
                      key={fileId}
                      progress={progress}
                      status={progress === 100 ? 'completed' : 'uploading'}
                      filename={file.name}
                      speed={1024 * 1024 * 2} // 2 MB/s
                      timeRemaining={progress < 100 ? (100 - progress) / 10 : 0}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mb-6"
            >
              <Alert variant="destructive" className="backdrop-blur-xl bg-red-50/80 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mb-6"
            >
              <Alert className="backdrop-blur-xl bg-green-50/80 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Previews */}
        <AnimatePresence>
          {uploadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Uploaded Files
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                {uploadedFiles.map((file, index) => (
                  <FilePreviewCard
                    key={`${file.name}-${index}`}
                    file={file}
                    fileType={file.type.startsWith('video/') ? 'video' : 'srt'}
                    onRemove={() => removeFile(file)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Job Section */}
        <AnimatePresence>
          {showCreateJobButton && uploadedFiles.length > 0 && !isUploading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-white/20 border border-white/30 shadow-2xl p-8">
                {/* Animated Background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10"
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />

                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Ready to Create Magic? ✨
                  </h3>
                  
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {hasVideoFile && hasSrtFile 
                      ? 'Both video and subtitle files will be processed together for the best results'
                      : hasVideoFile 
                      ? 'Video will be processed. Add subtitles for enhanced accuracy'
                      : 'Upload a video file to get started'
                    }
                  </p>

                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={handleCreateJob}
                      disabled={!canCreateJob}
                      size="lg"
                      className={cn(
                        'px-8 py-4 rounded-2xl font-semibold text-white shadow-2xl',
                        'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600',
                        'hover:shadow-3xl transition-all duration-300',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5" />
                        Create Dubbing Job
                        <ArrowRight className="w-5 h-5" />
                      </span>
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature Highlights */}
        {uploadedFiles.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16 grid gap-8 md:grid-cols-3"
          >
            {[
              {
                icon: Upload,
                title: 'Drag & Drop',
                description: 'Simply drag your files or click to browse. Supports multiple formats.',
                gradient: 'from-blue-500 to-cyan-500'
              },
              {
                icon: Zap,
                title: 'Lightning Fast',
                description: 'Optimized upload with real-time progress and speed indicators.',
                gradient: 'from-purple-500 to-pink-500'
              },
              {
                icon: Sparkles,
                title: 'AI-Powered',
                description: 'Advanced processing with intelligent service selection.',
                gradient: 'from-green-500 to-emerald-500'
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{ y: -5 }}
                className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/20 border border-white/30 shadow-lg p-6 text-center"
              >
                <motion.div
                  className={cn(
                    'inline-flex items-center justify-center p-3 rounded-xl mb-4',
                    `bg-gradient-to-r ${feature.gradient} bg-opacity-20`
                  )}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </motion.div>
                
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h4>
                
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};
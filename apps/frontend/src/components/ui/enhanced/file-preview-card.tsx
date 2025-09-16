import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, FileText, Download, Eye, X, Maximize2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface FilePreviewCardProps {
  file: File;
  fileType: 'video' | 'srt';
  onRemove?: () => void;
  className?: string;
}

export const FilePreviewCard: React.FC<FilePreviewCardProps> = ({
  file,
  fileType,
  onRemove,
  className
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (fileType === 'video') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ y: -5 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={cn(
          'relative overflow-hidden rounded-3xl backdrop-blur-xl bg-white/20 border border-white/30 shadow-2xl',
          'hover:shadow-3xl transition-all duration-500',
          className
        )}
      >
        {/* Animated Background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10"
          animate={{
            opacity: isHovered ? 0.8 : 0.4,
          }}
        />

        {/* Header */}
        <div className="relative z-10 p-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ rotate: isHovered ? 5 : 0 }}
                className="p-2 rounded-xl bg-blue-500/20 backdrop-blur-sm"
              >
                <FileText className="w-5 h-5 text-blue-600" />
              </motion.div>
              <div>
                <p className="font-semibold text-gray-900 truncate max-w-48">
                  {file.name}
                </p>
                <p className="text-sm text-gray-600">
                  {formatFileSize(file.size)} • Video
                </p>
              </div>
            </div>
            
            {onRemove && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onRemove}
                className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
              >
                <X className="w-4 h-4 text-red-600" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Video Player */}
        <div className="relative bg-black/20 backdrop-blur-sm">
          <video
            ref={videoRef}
            src={URL.createObjectURL(file)}
            className="w-full h-48 object-cover"
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={() => setIsPlaying(false)}
          />
          
          {/* Video Controls Overlay */}
          <AnimatePresence>
            {(isHovered || !isPlaying) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"
              >
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
                  {/* Progress Bar */}
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={1}
                    onValueChange={([value]) => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = value;
                        setCurrentTime(value);
                      }
                    }}
                    className="w-full"
                  />
                  
                  {/* Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handlePlayPause}
                        className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white" />
                        )}
                      </motion.button>
                      
                      <span className="text-sm text-white font-medium">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setIsMuted(!isMuted);
                          if (videoRef.current) {
                            videoRef.current.muted = !isMuted;
                          }
                        }}
                        className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-white" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-white" />
                        )}
                      </motion.button>
                      
                      <div className="w-20">
                        <Slider
                          value={[volume]}
                          max={1}
                          step={0.1}
                          onValueChange={([value]) => {
                            setVolume(value);
                            if (videoRef.current) {
                              videoRef.current.volume = value;
                            }
                          }}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // SRT File Preview
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        'relative overflow-hidden rounded-3xl backdrop-blur-xl bg-white/20 border border-white/30 shadow-2xl',
        'hover:shadow-3xl transition-all duration-500',
        className
      )}
    >
      {/* Animated Background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10"
        animate={{
          opacity: isHovered ? 0.8 : 0.4,
        }}
      />

      {/* Header */}
      <div className="relative z-10 p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div
              animate={{ rotate: isHovered ? 5 : 0 }}
              className="p-2 rounded-xl bg-green-500/20 backdrop-blur-sm"
            >
              <FileText className="w-5 h-5 text-green-600" />
            </motion.div>
            <div>
              <p className="font-semibold text-gray-900 truncate max-w-48">
                {file.name}
              </p>
              <p className="text-sm text-gray-600">
                {formatFileSize(file.size)} • SRT Subtitles
              </p>
            </div>
          </div>
          
          {onRemove && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onRemove}
              className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
            >
              <X className="w-4 h-4 text-red-600" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 p-6">
        <div className="flex items-center justify-center space-x-4">
          <motion.div
            animate={{ 
              scale: isHovered ? 1.1 : 1,
              rotate: isHovered ? 5 : 0 
            }}
            className="p-4 rounded-2xl bg-green-500/20 backdrop-blur-sm"
          >
            <FileText className="w-12 h-12 text-green-600" />
          </motion.div>
          
          <div className="text-center">
            <p className="font-semibold text-gray-900 mb-2">SRT Subtitle File</p>
            <SrtPreviewDialog file={file} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// SRT Preview Dialog Component
interface SrtPreviewDialogProps {
  file: File;
}

const SrtPreviewDialog: React.FC<SrtPreviewDialogProps> = ({ file }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadSrtContent = async () => {
    setLoading(true);
    try {
      const text = await file.text();
      setContent(text);
    } catch (error) {
      setContent('Error loading subtitle content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={loadSrtContent}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <span className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Preview Content
          </span>
        </motion.button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] backdrop-blur-xl bg-white/90 border border-white/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            Subtitle Preview - {file.name}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-96 w-full border rounded-xl p-4 bg-gray-50/50 backdrop-blur-sm">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RotateCcw className="w-8 h-8 text-gray-500" />
              </motion.div>
              <p className="ml-3 text-gray-500">Loading subtitle content...</p>
            </div>
          ) : (
            <pre className="text-sm whitespace-pre-wrap font-mono text-gray-800">
              {content || 'No content available'}
            </pre>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
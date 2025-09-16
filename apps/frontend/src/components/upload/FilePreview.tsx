import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, FileText, Download, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { FileUploadItem } from './FileUploader';

interface FilePreviewProps {
  file: FileUploadItem;
  onRemove?: (fileId: string) => void;
  className?: string;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onRemove,
  className
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (file.type === 'video') {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium truncate">
              {file.file.name}
            </CardTitle>
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(file.id)}
                disabled={file.status === 'uploading'}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatFileSize(file.file.size)} • Video
          </p>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Video Player */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={URL.createObjectURL(file.file)}
              className="w-full h-48 object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
            
            {/* Video Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="space-y-2">
                {/* Progress Bar */}
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={handleSeek}
                  className="w-full"
                />
                
                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePlayPause}
                      className="text-white hover:bg-white/20"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <span className="text-xs text-white">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleMute}
                      className="text-white hover:bg-white/20"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <div className="w-16">
                      <Slider
                        value={[volume]}
                        max={1}
                        step={0.1}
                        onValueChange={handleVolumeChange}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // SRT File Preview
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate">
            {file.file.name}
          </CardTitle>
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(file.id)}
              disabled={file.status === 'uploading'}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.file.size)} • SRT Subtitles
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-center space-x-2">
          <FileText className="h-8 w-8 text-gray-400" />
          <div className="text-center">
            <p className="text-sm text-gray-600">SRT Subtitle File</p>
            <SrtPreviewDialog file={file.file} />
          </div>
        </div>
      </CardContent>
    </Card>
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
        <Button variant="outline" size="sm" onClick={loadSrtContent}>
          <Eye className="h-4 w-4 mr-1" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Subtitle Preview - {file.name}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-96 w-full border rounded-md p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">Loading subtitle content...</p>
            </div>
          ) : (
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {content || 'No content available'}
            </pre>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// File Management Interface
interface FileManagementProps {
  files: FileUploadItem[];
  onRemove: (fileId: string) => void;
  onDownload?: (file: FileUploadItem) => void;
  className?: string;
}

export const FileManagement: React.FC<FileManagementProps> = ({
  files,
  onRemove,
  onDownload,
  className
}) => {
  if (files.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-lg font-medium text-gray-900">Uploaded Files</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {files.map((file) => (
          <FilePreview
            key={file.id}
            file={file}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
};
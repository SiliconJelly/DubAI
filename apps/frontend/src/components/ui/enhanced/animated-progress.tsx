import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedProgressProps {
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  filename?: string;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
  className?: string;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  progress,
  status,
  filename,
  speed,
  timeRemaining,
  className
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'uploading':
      case 'processing':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-5 h-5 text-blue-500" />
          </motion.div>
        );
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-300" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'from-emerald-500 to-green-400';
      case 'error':
        return 'from-red-500 to-pink-400';
      case 'uploading':
        return 'from-blue-500 to-cyan-400';
      case 'processing':
        return 'from-purple-500 to-indigo-400';
      default:
        return 'from-gray-400 to-gray-300';
    }
  };

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
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/30 border border-white/20 shadow-lg p-6',
        className
      )}
    >
      {/* Animated Background Gradient */}
      <motion.div
        className={cn(
          'absolute inset-0 bg-gradient-to-r opacity-10',
          getStatusColor()
        )}
        animate={{
          x: status === 'uploading' || status === 'processing' ? ['-100%', '100%'] : '0%',
        }}
        transition={{
          duration: 2,
          repeat: status === 'uploading' || status === 'processing' ? Infinity : 0,
          ease: 'linear',
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium text-gray-900 truncate max-w-48">
                {filename || 'Processing...'}
              </p>
              <p className="text-sm text-gray-500 capitalize">{status}</p>
            </div>
          </div>
          
          <div className="text-right">
            <motion.p
              key={progress}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-lg font-bold text-gray-900"
            >
              {progress}%
            </motion.p>
            {speed && status === 'uploading' && (
              <p className="text-xs text-gray-500">{formatSpeed(speed)}</p>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="w-full bg-gray-200/50 rounded-full h-3 overflow-hidden backdrop-blur-sm">
            <motion.div
              className={cn(
                'h-full bg-gradient-to-r rounded-full relative',
                getStatusColor()
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {/* Shimmer Effect */}
              {(status === 'uploading' || status === 'processing') && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              )}
            </motion.div>
          </div>

          {/* Progress Markers */}
          <div className="absolute top-0 left-0 w-full h-full flex items-center">
            {[25, 50, 75].map((marker) => (
              <motion.div
                key={marker}
                className="absolute w-0.5 h-5 bg-white/50 rounded-full"
                style={{ left: `${marker}%` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: progress > marker ? 1 : 0.3 }}
              />
            ))}
          </div>
        </div>

        {/* Footer Info */}
        {(speed || timeRemaining) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-between items-center mt-3 text-xs text-gray-600"
          >
            {speed && (
              <div className="flex items-center space-x-1">
                <Zap className="w-3 h-3" />
                <span>{formatSpeed(speed)}</span>
              </div>
            )}
            {timeRemaining && (
              <span>{formatTime(timeRemaining)} remaining</span>
            )}
          </motion.div>
        )}

        {/* Status Messages */}
        {status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 flex items-center space-x-2 text-emerald-600"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Upload completed successfully!</span>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 flex items-center space-x-2 text-red-600"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Upload failed. Please try again.</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
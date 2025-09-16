import React, { useState, useEffect } from 'react';
import { JobProcessingDashboard } from '../components/dashboard';
import { DubbingJob, JobStatus } from '@dubai/shared';

// Mock data for demonstration
const createMockJob = (id: string, title: string, status: JobStatus, progress: number): DubbingJob => ({
  id,
  userId: 'user-123',
  title,
  status,
  progress,
  createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
  inputFiles: {
    video: {
      id: `video-${id}`,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}.mp4`,
      size: Math.floor(Math.random() * 500000000) + 50000000, // 50MB - 550MB
      mimeType: 'video/mp4',
      storagePath: `/uploads/videos/${id}/original.mp4`,
      uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    srt: Math.random() > 0.3 ? {
      id: `srt-${id}`,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}.srt`,
      size: Math.floor(Math.random() * 50000) + 1000, // 1KB - 50KB
      mimeType: 'text/plain',
      storagePath: `/uploads/srt/${id}/original.srt`,
      uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    } : undefined
  },
  outputFiles: status === JobStatus.COMPLETED ? {
    dubbedAudio: {
      id: `audio-${id}`,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}-dubbed.wav`,
      size: Math.floor(Math.random() * 100000000) + 10000000, // 10MB - 110MB
      mimeType: 'audio/wav',
      storagePath: `/outputs/audio/${id}/dubbed.wav`,
      uploadedAt: new Date().toISOString()
    },
    translatedSrt: {
      id: `translated-srt-${id}`,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}-bangla.srt`,
      size: Math.floor(Math.random() * 50000) + 1000,
      mimeType: 'text/plain',
      storagePath: `/outputs/srt/${id}/translated.srt`,
      uploadedAt: new Date().toISOString()
    }
  } : {},
  processingMetrics: {
    audioExtractionTime: status !== JobStatus.UPLOADED ? Math.floor(Math.random() * 30000) + 5000 : undefined,
    transcriptionTime: [JobStatus.TRANSLATING, JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO, JobStatus.COMPLETED].includes(status) 
      ? Math.floor(Math.random() * 120000) + 30000 : undefined,
    translationTime: [JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO, JobStatus.COMPLETED].includes(status) 
      ? Math.floor(Math.random() * 15000) + 2000 : undefined,
    ttsGenerationTime: [JobStatus.ASSEMBLING_AUDIO, JobStatus.COMPLETED].includes(status) 
      ? Math.floor(Math.random() * 180000) + 60000 : undefined,
    audioAssemblyTime: status === JobStatus.COMPLETED ? Math.floor(Math.random() * 45000) + 10000 : undefined,
    totalProcessingTime: status === JobStatus.COMPLETED ? Math.floor(Math.random() * 300000) + 120000 : undefined,
    ttsService: Math.random() > 0.5 ? 'google' : 'coqui',
    costBreakdown: {
      transcriptionCost: Math.random() * 0.05,
      translationCost: Math.random() * 0.02,
      ttsCost: Math.random() * 0.15,
      processingCost: Math.random() * 0.01,
      totalCost: Math.random() * 0.23
    }
  },
  errorMessage: status === JobStatus.FAILED ? 
    ['Audio extraction failed: Unsupported codec', 'Transcription timeout: File too large', 'TTS service unavailable', 'Network connection lost'][Math.floor(Math.random() * 4)] 
    : undefined
});

const MOCK_JOBS: DubbingJob[] = [
  createMockJob('job-001', 'The Avengers Movie Clip', JobStatus.COMPLETED, 100),
  createMockJob('job-002', 'Documentary Nature Sounds', JobStatus.GENERATING_SPEECH, 75),
  createMockJob('job-003', 'Comedy Show Episode 1', JobStatus.TRANSCRIBING, 45),
  createMockJob('job-004', 'News Report Breaking', JobStatus.FAILED, 0),
  createMockJob('job-005', 'Educational Video Math', JobStatus.COMPLETED, 100),
  createMockJob('job-006', 'Music Video Behind Scenes', JobStatus.TRANSLATING, 60),
  createMockJob('job-007', 'Interview Tech CEO', JobStatus.UPLOADED, 5),
  createMockJob('job-008', 'Sports Highlights Football', JobStatus.ASSEMBLING_AUDIO, 90),
  createMockJob('job-009', 'Cooking Tutorial Pasta', JobStatus.COMPLETED, 100),
  createMockJob('job-010', 'Travel Vlog Paris', JobStatus.EXTRACTING_AUDIO, 25),
  createMockJob('job-011', 'Product Review Smartphone', JobStatus.FAILED, 0),
  createMockJob('job-012', 'Animation Short Film', JobStatus.COMPLETED, 100),
];

export const JobProcessingDashboardDemo: React.FC = () => {
  const [jobs, setJobs] = useState<DubbingJob[]>(MOCK_JOBS);

  // Simulate real-time updates for active jobs
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prevJobs => 
        prevJobs.map(job => {
          // Only update jobs that are in progress
          if ([JobStatus.EXTRACTING_AUDIO, JobStatus.TRANSCRIBING, JobStatus.TRANSLATING, 
               JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO].includes(job.status)) {
            
            const newProgress = Math.min(job.progress + Math.floor(Math.random() * 10) + 1, 100);
            
            // Simulate status progression
            let newStatus = job.status;
            if (newProgress >= 100) {
              const statusProgression = [
                JobStatus.EXTRACTING_AUDIO,
                JobStatus.TRANSCRIBING,
                JobStatus.TRANSLATING,
                JobStatus.GENERATING_SPEECH,
                JobStatus.ASSEMBLING_AUDIO,
                JobStatus.COMPLETED
              ];
              
              const currentIndex = statusProgression.indexOf(job.status);
              if (currentIndex < statusProgression.length - 1) {
                newStatus = statusProgression[currentIndex + 1];
                return {
                  ...job,
                  status: newStatus,
                  progress: newStatus === JobStatus.COMPLETED ? 100 : Math.floor(Math.random() * 30) + 10,
                  updatedAt: new Date().toISOString()
                };
              } else {
                newStatus = JobStatus.COMPLETED;
              }
            }
            
            return {
              ...job,
              status: newStatus,
              progress: newProgress,
              updatedAt: new Date().toISOString()
            };
          }
          
          return job;
        })
      );
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const handleJobDownload = (jobId: string) => {
    console.log('Download job:', jobId);
    // In a real app, this would trigger a file download
  };

  const handleJobCancel = (jobId: string) => {
    console.log('Cancel job:', jobId);
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === jobId 
          ? { ...job, status: JobStatus.FAILED, errorMessage: 'Cancelled by user', updatedAt: new Date().toISOString() }
          : job
      )
    );
  };

  const handleJobRetry = (jobId: string) => {
    console.log('Retry job:', jobId);
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === jobId 
          ? { 
              ...job, 
              status: JobStatus.UPLOADED, 
              progress: 0, 
              errorMessage: undefined,
              updatedAt: new Date().toISOString()
            }
          : job
      )
    );
  };

  const handleJobDelete = (jobId: string) => {
    console.log('Delete job:', jobId);
    setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Job Processing Dashboard Demo
          </h1>
          <p className="text-gray-600">
            This demo showcases the complete job processing dashboard with real-time updates, 
            filtering, sorting, and management capabilities.
          </p>
        </div>

        <JobProcessingDashboard 
          className="space-y-6"
        />
      </div>
    </div>
  );
};
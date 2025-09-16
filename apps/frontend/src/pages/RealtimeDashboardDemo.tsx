import React, { useState, useEffect } from 'react';
import { RealtimeDashboard } from '../components/dashboard/RealtimeDashboard';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { useToast } from '../hooks/use-toast';

// Mock job data for demonstration
const createMockJob = (id: string, title: string, status: JobStatus, progress: number): DubbingJob => ({
  id,
  userId: 'demo-user',
  title,
  status,
  progress,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  inputFiles: {
    video: {
      id: `video-${id}`,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}.mp4`,
      size: 50 * 1024 * 1024, // 50MB
      mimeType: 'video/mp4',
      storagePath: `/uploads/demo-user/videos/${id}/original.mp4`,
      uploadedAt: new Date().toISOString()
    }
  },
  outputFiles: status === JobStatus.COMPLETED ? {
    dubbedAudio: {
      id: `audio-${id}`,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}-dubbed.wav`,
      size: 10 * 1024 * 1024, // 10MB
      mimeType: 'audio/wav',
      storagePath: `/outputs/demo-user/${id}/dubbed_audio.wav`,
      uploadedAt: new Date().toISOString()
    }
  } : {},
  processingMetrics: {
    audioExtractionTime: status !== JobStatus.UPLOADED ? 5000 : undefined,
    transcriptionTime: [JobStatus.TRANSLATING, JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO, JobStatus.COMPLETED].includes(status) ? 15000 : undefined,
    translationTime: [JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO, JobStatus.COMPLETED].includes(status) ? 8000 : undefined,
    ttsGenerationTime: [JobStatus.ASSEMBLING_AUDIO, JobStatus.COMPLETED].includes(status) ? 25000 : undefined,
    audioAssemblyTime: status === JobStatus.COMPLETED ? 7000 : undefined,
    totalProcessingTime: status === JobStatus.COMPLETED ? 60000 : undefined,
    ttsService: 'google' as const,
    costBreakdown: {
      totalCost: 0.0234,
      breakdown: {
        transcription: 0.0050,
        translation: 0.0030,
        tts: 0.0154
      }
    }
  },
  errorMessage: status === JobStatus.FAILED ? 'Audio extraction failed: Unsupported video format' : undefined
});

export const RealtimeDashboardDemo: React.FC = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<DubbingJob[]>([
    createMockJob('job-1', 'Movie Trailer Dubbing', JobStatus.COMPLETED, 100),
    createMockJob('job-2', 'Documentary Narration', JobStatus.GENERATING_SPEECH, 75),
    createMockJob('job-3', 'Commercial Advertisement', JobStatus.TRANSCRIBING, 35),
    createMockJob('job-4', 'Educational Video', JobStatus.UPLOADED, 0),
    createMockJob('job-5', 'Podcast Episode', JobStatus.FAILED, 0),
  ]);

  // Simulate job progress updates
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prevJobs => 
        prevJobs.map(job => {
          if (job.status === JobStatus.TRANSCRIBING && job.progress < 100) {
            const newProgress = Math.min(job.progress + Math.random() * 10, 100);
            const newStatus = newProgress >= 100 ? JobStatus.TRANSLATING : job.status;
            return { ...job, progress: newProgress, status: newStatus };
          }
          
          if (job.status === JobStatus.TRANSLATING && job.progress < 100) {
            const newProgress = Math.min(job.progress + Math.random() * 8, 100);
            const newStatus = newProgress >= 100 ? JobStatus.GENERATING_SPEECH : job.status;
            return { ...job, progress: newProgress, status: newStatus };
          }
          
          if (job.status === JobStatus.GENERATING_SPEECH && job.progress < 100) {
            const newProgress = Math.min(job.progress + Math.random() * 5, 100);
            const newStatus = newProgress >= 100 ? JobStatus.ASSEMBLING_AUDIO : job.status;
            return { ...job, progress: newProgress, status: newStatus };
          }
          
          if (job.status === JobStatus.ASSEMBLING_AUDIO && job.progress < 100) {
            const newProgress = Math.min(job.progress + Math.random() * 15, 100);
            const newStatus = newProgress >= 100 ? JobStatus.COMPLETED : job.status;
            return { ...job, progress: newProgress, status: newStatus };
          }
          
          return job;
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleJobUpdate = (updatedJob: DubbingJob) => {
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === updatedJob.id ? updatedJob : job
      )
    );
  };

  const handleDownload = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    toast({
      title: 'Download Started',
      description: `Downloading ${job?.title || 'job'} results...`,
    });
    
    // Simulate download
    setTimeout(() => {
      toast({
        title: 'Download Complete',
        description: `${job?.title || 'Job'} results downloaded successfully!`,
      });
    }, 2000);
  };

  const handleCancel = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    
    setJobs(prevJobs => 
      prevJobs.map(j => 
        j.id === jobId 
          ? { ...j, status: JobStatus.FAILED, errorMessage: 'Job cancelled by user' }
          : j
      )
    );
    
    toast({
      title: 'Job Cancelled',
      description: `${job?.title || 'Job'} has been cancelled.`,
      variant: 'destructive',
    });
  };

  const handleRetry = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    
    setJobs(prevJobs => 
      prevJobs.map(j => 
        j.id === jobId 
          ? { ...j, status: JobStatus.UPLOADED, progress: 0, errorMessage: undefined }
          : j
      )
    );
    
    toast({
      title: 'Job Restarted',
      description: `${job?.title || 'Job'} has been queued for processing.`,
    });
  };

  const addNewJob = () => {
    const newJob = createMockJob(
      `job-${Date.now()}`,
      `New Job ${jobs.length + 1}`,
      JobStatus.UPLOADED,
      0
    );
    
    setJobs(prevJobs => [newJob, ...prevJobs]);
    
    toast({
      title: 'New Job Added',
      description: `${newJob.title} has been uploaded and queued for processing.`,
    });
  };

  const simulateError = () => {
    const processingJob = jobs.find(job => 
      [JobStatus.TRANSCRIBING, JobStatus.TRANSLATING, JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO].includes(job.status)
    );
    
    if (processingJob) {
      setJobs(prevJobs => 
        prevJobs.map(j => 
          j.id === processingJob.id 
            ? { ...j, status: JobStatus.FAILED, errorMessage: 'Simulated processing error' }
            : j
        )
      );
      
      toast({
        title: 'Processing Error',
        description: `${processingJob.title} encountered an error.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'No Processing Jobs',
        description: 'No jobs are currently processing to simulate an error.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Real-time Dashboard Demo</h1>
          <p className="text-gray-600 mt-2">
            Demonstration of real-time job processing updates with WebSocket integration
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={addNewJob} variant="outline">
            Add New Job
          </Button>
          <Button onClick={simulateError} variant="destructive">
            Simulate Error
          </Button>
        </div>
      </div>

      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Features Demonstrated:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Real-time job progress updates</li>
                <li>• WebSocket connection status</li>
                <li>• Processing step visualization</li>
                <li>• Error handling and notifications</li>
                <li>• Job management actions</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Connection Status:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Green: Connected & Authenticated</li>
                <li>• Yellow: Connected, Authenticating</li>
                <li>• Red: Disconnected</li>
                <li>• Auto-reconnection on failure</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Job Actions:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Download: Completed jobs</li>
                <li>• Cancel: Processing jobs</li>
                <li>• Retry: Failed jobs</li>
                <li>• Real-time progress tracking</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Dashboard */}
      <RealtimeDashboard
        jobs={jobs}
        onJobUpdate={handleJobUpdate}
        onDownload={handleDownload}
        onCancel={handleCancel}
        onRetry={handleRetry}
      />
    </div>
  );
};
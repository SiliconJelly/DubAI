import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProcessingStepsVisualization } from '../ProcessingStepsVisualization';
import { JobStatus } from '@dubai/shared';
import * as apiModule from '../../../services/api';
import * as webSocketModule from '../../../hooks/useWebSocket';

// Mock the API client
vi.mock('../../../services/api', () => ({
  apiClient: {
    getJob: vi.fn(),
    retryJob: vi.fn(),
    retryJobStep: vi.fn(),
    updateJobSettings: vi.fn(),
  },
}));

// Mock the WebSocket hook
const mockWebSocketHook = {
  jobStatus: null,
  processingMetrics: [],
  isConnected: true,
};

vi.mock('../../../hooks/useWebSocket', () => ({
  useJobWebSocket: vi.fn(() => mockWebSocketHook),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 minutes ago'),
}));

const mockJob = {
  id: 'job-123',
  userId: 'user-123',
  title: 'Test Movie Dubbing',
  status: JobStatus.TRANSCRIBING,
  progress: 45,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:05:00Z',
  inputFiles: {
    video: {
      id: 'file-1',
      filename: 'movie.mp4',
      size: 1024000,
      mimeType: 'video/mp4',
      storagePath: '/uploads/movie.mp4',
      uploadedAt: '2024-01-01T00:00:00Z',
    },
  },
  outputFiles: {},
  processingMetrics: {
    transcriptionTime: 120000,
    ttsService: 'google' as const,
    costBreakdown: {
      transcriptionCost: 0.05,
      translationCost: 0.03,
      ttsCost: 0.12,
      processingCost: 0.02,
      totalCost: 0.22,
    },
  },
};

describe('ProcessingStepsVisualization', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const { apiClient } = vi.mocked(apiModule);
    apiClient.getJob.mockResolvedValue(mockJob);
  });

  it('renders loading state initially', () => {
    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    expect(screen.getByText('Loading processing details...')).toBeInTheDocument();
  });

  it('renders job details and processing steps', async () => {
    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Steps: Test Movie Dubbing')).toBeInTheDocument();
    });

    // Check if processing steps are rendered
    expect(screen.getByText('File Upload')).toBeInTheDocument();
    expect(screen.getByText('Audio Extraction')).toBeInTheDocument();
    expect(screen.getByText('Speech Transcription')).toBeInTheDocument();
    expect(screen.getByText('Text Translation')).toBeInTheDocument();
    expect(screen.getByText('Speech Synthesis')).toBeInTheDocument();
    expect(screen.getByText('Audio Assembly')).toBeInTheDocument();
  });

  it('displays overall progress correctly', async () => {
    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Overall Progress')).toBeInTheDocument();
    });

    // Should show progress percentage
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('shows cost breakdown when available', async () => {
    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cost Breakdown')).toBeInTheDocument();
    });

    expect(screen.getByText('$0.0500')).toBeInTheDocument(); // Transcription cost
    expect(screen.getByText('$0.0300')).toBeInTheDocument(); // Translation cost
    expect(screen.getByText('$0.1200')).toBeInTheDocument(); // TTS cost
    expect(screen.getByText('$0.0200')).toBeInTheDocument(); // Processing cost
    expect(screen.getByText('$0.2200')).toBeInTheDocument(); // Total cost
  });

  it('displays TTS service selection for early stage jobs', async () => {
    const earlyStageJob = { ...mockJob, status: JobStatus.UPLOADED };
    mockApiClient.getJob.mockResolvedValue(earlyStageJob);

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('TTS Service Selection')).toBeInTheDocument();
    });

    expect(screen.getByText('Auto Select')).toBeInTheDocument();
    expect(screen.getByText('Google TTS')).toBeInTheDocument();
    expect(screen.getByText('Coqui TTS')).toBeInTheDocument();
  });

  it('handles TTS service selection', async () => {
    const { apiClient } = vi.mocked(apiModule);
    const earlyStageJob = { ...mockJob, status: JobStatus.UPLOADED };
    apiClient.getJob.mockResolvedValue(earlyStageJob);
    apiClient.updateJobSettings.mockResolvedValue(earlyStageJob);

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('TTS Service Selection')).toBeInTheDocument();
    });

    const googleTTSButton = screen.getByText('Google TTS').closest('button');
    fireEvent.click(googleTTSButton!);

    await waitFor(() => {
      expect(apiClient.updateJobSettings).toHaveBeenCalledWith('job-123', {
        ttsService: 'google',
      });
    });
  });

  it('shows retry options for failed jobs', async () => {
    const { apiClient } = vi.mocked(apiModule);
    const failedJob = { 
      ...mockJob, 
      status: JobStatus.FAILED,
      errorMessage: 'Transcription failed due to audio quality'
    };
    apiClient.getJob.mockResolvedValue(failedJob);

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Failed')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry Job')).toBeInTheDocument();
  });

  it('handles job retry', async () => {
    const { apiClient } = vi.mocked(apiModule);
    const failedJob = { 
      ...mockJob, 
      status: JobStatus.FAILED,
      errorMessage: 'Processing failed'
    };
    apiClient.getJob.mockResolvedValue(failedJob);
    apiClient.retryJob.mockResolvedValue(mockJob);

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Retry Job')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry Job');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(apiClient.retryJob).toHaveBeenCalledWith('job-123');
    });
  });

  it('displays connection status', async () => {
    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Live Updates')).toBeInTheDocument();
    });
  });

  it('shows offline status when disconnected', async () => {
    const disconnectedWebSocket = { ...mockWebSocketHook, isConnected: false };
    vi.mocked(webSocketModule.useJobWebSocket).mockReturnValue(disconnectedWebSocket);

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  it('handles close button click', async () => {
    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Steps: Test Movie Dubbing')).toBeInTheDocument();
    });

    // Find the close button by its X icon
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(button => button.querySelector('svg'));
    fireEvent.click(closeButton!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays error state when job loading fails', async () => {
    const { apiClient } = vi.mocked(apiModule);
    apiClient.getJob.mockRejectedValue(new Error('Job not found'));

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Error Loading Job Details')).toBeInTheDocument();
    });

    expect(screen.getByText('Job not found')).toBeInTheDocument();
  });

  it('updates steps based on real-time WebSocket updates', async () => {
    const updatedWebSocket = {
      ...mockWebSocketHook,
      jobStatus: {
        jobId: 'job-123',
        status: JobStatus.TRANSLATING,
        progress: 60,
      },
    };
    vi.mocked(webSocketModule.useJobWebSocket).mockReturnValue(updatedWebSocket);

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getAllByText('60%')).toHaveLength(2); // Progress appears in multiple places
    });
  });

  it('displays quality metrics when available', async () => {
    const { apiClient } = vi.mocked(apiModule);
    const jobWithQuality = {
      ...mockJob,
      processingMetrics: {
        ...mockJob.processingMetrics,
        qualityScore: 0.85,
      },
    };
    apiClient.getJob.mockResolvedValue(jobWithQuality);

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality')).toBeInTheDocument();
    });
  });

  it('shows service-specific information for TTS steps', async () => {
    const processingMetrics = [
      {
        jobId: 'job-123',
        stepName: 'generating_speech',
        stepOrder: 4,
        status: 'completed',
        serviceUsed: 'google',
        costEstimate: 0.12,
        metadata: {
          voice: 'en-US-Neural2-A',
          audioFormat: 'mp3',
          sampleRate: 24000,
        },
      },
    ];

    const updatedWebSocket = {
      ...mockWebSocketHook,
      processingMetrics,
    };
    vi.mocked(webSocketModule.useJobWebSocket).mockReturnValue(updatedWebSocket);

    render(<ProcessingStepsVisualization jobId="job-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Speech Synthesis')).toBeInTheDocument();
    });
  });
});
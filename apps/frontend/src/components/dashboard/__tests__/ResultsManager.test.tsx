import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ResultsManager } from '../ResultsManager';
import { apiClient } from '../../../services/api';
import { useToast } from '../../../hooks/use-toast';
import { DubbingJob, JobStatus } from '@dubai/shared';

// Mock dependencies
vi.mock('../../../services/api');
vi.mock('../../../hooks/use-toast');

const mockApiClient = apiClient as any;
const mockUseToast = useToast as any;

const mockToast = vi.fn();
mockUseToast.mockReturnValue({ toast: mockToast });

// Mock job data
const mockCompletedJob: DubbingJob = {
  id: 'job-123',
  userId: 'user-123',
  title: 'Test Movie Dubbing',
  status: JobStatus.COMPLETED,
  progress: 100,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T01:00:00Z',
  inputFiles: {
    video: {
      id: 'video-123',
      filename: 'movie.mp4',
      size: 1000000,
      mimeType: 'video/mp4',
      storagePath: '/uploads/video-123',
      uploadedAt: '2024-01-01T00:00:00Z'
    },
    srt: {
      id: 'srt-123',
      filename: 'subtitles.srt',
      size: 5000,
      mimeType: 'text/plain',
      storagePath: '/uploads/srt-123',
      uploadedAt: '2024-01-01T00:00:00Z'
    }
  },
  outputFiles: {
    dubbedAudio: {
      id: 'audio-123',
      filename: 'dubbed_audio.wav',
      size: 2000000,
      mimeType: 'audio/wav',
      storagePath: '/outputs/audio-123',
      uploadedAt: '2024-01-01T01:00:00Z'
    },
    translatedSrt: {
      id: 'translated-srt-123',
      filename: 'translated_subtitles.srt',
      size: 6000,
      mimeType: 'text/plain',
      storagePath: '/outputs/translated-srt-123',
      uploadedAt: '2024-01-01T01:00:00Z'
    }
  },
  processingMetrics: {
    steps: [],
    totalDuration: 3600,
    totalCost: 5.50,
    ttsService: 'google',
    qualityScore: 4.2
  }
};

const mockJobResults = {
  outputFiles: {
    dubbedAudio: {
      id: 'audio-123',
      downloadUrl: 'https://example.com/audio-123',
      filename: 'dubbed_audio.wav',
      size: 2000000
    },
    translatedSrt: {
      id: 'translated-srt-123',
      downloadUrl: 'https://example.com/translated-srt-123',
      filename: 'translated_subtitles.srt',
      size: 6000
    }
  },
  qualityMetrics: {
    audioQuality: 4.2,
    translationAccuracy: 4.5,
    overallRating: 4.3
  }
};

describe('ResultsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.getJobResults.mockResolvedValue(mockJobResults);
    mockApiClient.getFileDownloadUrl.mockResolvedValue({
      downloadUrl: 'https://example.com/download/file-123',
      expiresAt: '2024-01-02T00:00:00Z'
    });
    mockApiClient.createShareLink.mockResolvedValue({
      shareUrl: 'https://example.com/share/abc123',
      shareId: 'abc123',
      expiresAt: '2024-01-02T00:00:00Z'
    });
    mockApiClient.submitQualityFeedback.mockResolvedValue();
  });

  it('should render processing in progress message for incomplete jobs', () => {
    const incompleteJob = { ...mockCompletedJob, status: JobStatus.TRANSCRIBING, progress: 50 };
    
    render(<ResultsManager job={incompleteJob} />);
    
    expect(screen.getByText('Processing In Progress')).toBeInTheDocument();
    expect(screen.getByText('Results will be available once processing is complete')).toBeInTheDocument();
  });

  it('should load and display job results for completed jobs', async () => {
    render(<ResultsManager job={mockCompletedJob} />);
    
    // Should show loading initially
    expect(screen.getByText('Loading results...')).toBeInTheDocument();
    
    // Wait for results to load
    await waitFor(() => {
      expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    });
    
    expect(mockApiClient.getJobResults).toHaveBeenCalledWith('job-123');
    expect(screen.getByText('Dubbed Audio')).toBeInTheDocument();
    expect(screen.getByText('Translated Subtitles')).toBeInTheDocument();
  });

  it('should handle file downloads', async () => {
    const user = userEvent.setup();
    
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    });
    
    // Click download button for audio file
    const downloadButtons = screen.getAllByText('Download');
    await user.click(downloadButtons[0]);
    
    expect(mockApiClient.getFileDownloadUrl).toHaveBeenCalledWith('audio-123');
    expect(mockToast).toHaveBeenCalledWith({
      title: "Download Started",
      description: "Downloading dubbed_audio.wav",
    });
  });

  it('should create and display share links', async () => {
    const user = userEvent.setup();
    
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    });
    
    // Open share dialog
    const shareButton = screen.getByText('Share');
    await user.click(shareButton);
    
    expect(screen.getByText('Share Results')).toBeInTheDocument();
    
    // Create share link
    const createLinkButton = screen.getByText('Create Link');
    await user.click(createLinkButton);
    
    await waitFor(() => {
      expect(mockApiClient.createShareLink).toHaveBeenCalledWith('job-123', {
        expiresIn: 24,
        allowDownload: true,
        password: ''
      });
    });
    
    expect(mockToast).toHaveBeenCalledWith({
      title: "Share Link Created",
      description: "Share link has been generated successfully",
    });
  });

  it('should submit quality feedback', async () => {
    const user = userEvent.setup();
    
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    });
    
    // Open feedback dialog
    const feedbackButton = screen.getByText('Feedback');
    await user.click(feedbackButton);
    
    expect(screen.getByText('Quality Feedback')).toBeInTheDocument();
    
    // Rate audio quality (click 4th star)
    const audioStars = screen.getAllByRole('button');
    const audioRatingStars = audioStars.filter(button => 
      button.querySelector('svg')?.classList.contains('lucide-star')
    );
    await user.click(audioRatingStars[3]); // 4th star (0-indexed)
    
    // Add comments
    const commentsTextarea = screen.getByPlaceholderText('Share your thoughts about the results...');
    await user.type(commentsTextarea, 'Great quality overall!');
    
    // Submit feedback
    const submitButton = screen.getByText('Submit Feedback');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockApiClient.submitQualityFeedback).toHaveBeenCalledWith('job-123', expect.objectContaining({
        audioQuality: 4,
        comments: 'Great quality overall!'
      }));
    });
    
    expect(mockToast).toHaveBeenCalledWith({
      title: "Feedback Submitted",
      description: "Thank you for your feedback!",
    });
  });

  it('should display quality metrics in quality tab', async () => {
    const user = userEvent.setup();
    
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    });
    
    // Switch to quality metrics tab
    const qualityTab = screen.getByText('Quality Metrics');
    await user.click(qualityTab);
    
    expect(screen.getByText('4.2/5')).toBeInTheDocument(); // Audio quality
    expect(screen.getByText('4.5/5')).toBeInTheDocument(); // Translation accuracy
    expect(screen.getByText('4.3/5')).toBeInTheDocument(); // Overall rating
  });

  it('should handle audio preview controls', async () => {
    const user = userEvent.setup();
    
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    });
    
    // Switch to preview tab
    const previewTab = screen.getByText('Preview');
    await user.click(previewTab);
    
    expect(screen.getByText('Audio Preview')).toBeInTheDocument();
    
    // Check for audio controls
    const audioElement = screen.getByRole('application'); // audio element
    expect(audioElement).toBeInTheDocument();
    expect(audioElement).toHaveAttribute('src', 'https://example.com/audio-123');
  });

  it('should handle API errors gracefully', async () => {
    mockApiClient.getJobResults.mockRejectedValue(new Error('Failed to load results'));
    
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to load job results",
        variant: "destructive",
      });
    });
  });

  it('should show no results message when results are unavailable', async () => {
    mockApiClient.getJobResults.mockResolvedValue(null as any);
    
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('No Results Available')).toBeInTheDocument();
      expect(screen.getByText('Unable to load results for this job')).toBeInTheDocument();
    });
  });

  it('should format file sizes correctly', async () => {
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    });
    
    // Check file size formatting
    expect(screen.getByText(/1.91 MB/)).toBeInTheDocument(); // 2000000 bytes
    expect(screen.getByText(/5.86 KB/)).toBeInTheDocument(); // 6000 bytes
  });

  it('should copy share link to clipboard', async () => {
    const user = userEvent.setup();
    
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    
    render(<ResultsManager job={mockCompletedJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    });
    
    // Open share dialog and create link
    const shareButton = screen.getByText('Share');
    await user.click(shareButton);
    
    const createLinkButton = screen.getByText('Create Link');
    await user.click(createLinkButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('https://example.com/share/abc123')).toBeInTheDocument();
    });
    
    // Copy link
    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/share/abc123');
    expect(mockToast).toHaveBeenCalledWith({
      title: "Copied",
      description: "Share link copied to clipboard",
    });
  });
});
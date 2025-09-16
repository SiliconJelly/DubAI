import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QualityAssessment } from '../QualityAssessment';
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

const mockJob: DubbingJob = {
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

describe('QualityAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.submitQualityFeedback.mockResolvedValue();
  });

  it('should display quality metrics and overall score', async () => {
    render(<QualityAssessment job={mockJob} />);
    
    // Should show loading initially
    expect(screen.getByText('Analyzing quality metrics...')).toBeInTheDocument();
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Check overall score
    expect(screen.getByText('4.3/5.0')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    
    // Check individual metrics
    expect(screen.getByText('4.2')).toBeInTheDocument(); // Audio Quality
    expect(screen.getByText('4.5')).toBeInTheDocument(); // Translation Accuracy
    expect(screen.getByText('4.1')).toBeInTheDocument(); // Cost Efficiency
  });

  it('should display performance comparison with benchmarks', async () => {
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Check performance comparison section
    expect(screen.getByText('Performance Comparison')).toBeInTheDocument();
    
    // Check benchmark comparisons
    expect(screen.getByText('Industry Avg: 3.8')).toBeInTheDocument();
    expect(screen.getByText('Your Best: 4.8')).toBeInTheDocument();
  });

  it('should display issues and recommendations', async () => {
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Check issues section
    expect(screen.getByText('Issues & Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Minor background noise detected')).toBeInTheDocument();
    expect(screen.getByText('Some segments have slight timing misalignment')).toBeInTheDocument();
    
    // Check recommendations
    expect(screen.getByText('Consider using Coqui TTS for better voice naturalness')).toBeInTheDocument();
    expect(screen.getByText('Audio quality could be improved with noise reduction')).toBeInTheDocument();
  });

  it('should open feedback dialog and submit feedback', async () => {
    const user = userEvent.setup();
    
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Open feedback dialog
    const feedbackButton = screen.getByText('Provide Feedback');
    await user.click(feedbackButton);
    
    expect(screen.getByText('Quality Feedback')).toBeInTheDocument();
    expect(screen.getByText('Help us improve by rating the quality of your results')).toBeInTheDocument();
    
    // Rate audio quality (click 3rd star)
    const audioStars = screen.getAllByRole('button');
    const starButtons = audioStars.filter(button => 
      button.querySelector('svg')?.classList.contains('lucide-star')
    );
    await user.click(starButtons[2]); // 3rd star for audio quality
    
    // Add comments
    const commentsTextarea = screen.getByPlaceholderText('Share your thoughts about the results...');
    await user.type(commentsTextarea, 'Good quality but could be better');
    
    // Set recommendation to No
    const noButton = screen.getByText('No');
    await user.click(noButton);
    
    // Submit feedback
    const submitButton = screen.getByText('Submit Feedback');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockApiClient.submitQualityFeedback).toHaveBeenCalledWith('job-123', expect.objectContaining({
        audioQuality: 3,
        comments: 'Good quality but could be better',
        wouldRecommend: false
      }));
    });
    
    expect(mockToast).toHaveBeenCalledWith({
      title: "Feedback Submitted",
      description: "Thank you for your feedback! It helps us improve.",
    });
  });

  it('should display different quality badges based on score', async () => {
    // Test excellent quality
    const excellentJob = { ...mockJob, processingMetrics: { ...mockJob.processingMetrics, qualityScore: 4.8 } };
    const { rerender } = render(<QualityAssessment job={excellentJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });
    
    // Test needs improvement quality
    const poorJob = { ...mockJob, processingMetrics: { ...mockJob.processingMetrics, qualityScore: 2.5 } };
    rerender(<QualityAssessment job={poorJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Needs Improvement')).toBeInTheDocument();
    });
  });

  it('should display trend icons correctly', async () => {
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Check for trend icons (should show trending up for metrics above industry average)
    const trendingUpIcons = screen.getAllByTestId('trending-up-icon');
    expect(trendingUpIcons.length).toBeGreaterThan(0);
  });

  it('should handle API errors when submitting feedback', async () => {
    const user = userEvent.setup();
    mockApiClient.submitQualityFeedback.mockRejectedValue(new Error('Failed to submit'));
    
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Open feedback dialog and submit
    const feedbackButton = screen.getByText('Provide Feedback');
    await user.click(feedbackButton);
    
    const submitButton = screen.getByText('Submit Feedback');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to submit feedback",
        variant: "destructive",
      });
    });
  });

  it('should show loading state while submitting feedback', async () => {
    const user = userEvent.setup();
    
    // Make the API call hang
    mockApiClient.submitQualityFeedback.mockImplementation(() => new Promise(() => {}));
    
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Open feedback dialog and submit
    const feedbackButton = screen.getByText('Provide Feedback');
    await user.click(feedbackButton);
    
    const submitButton = screen.getByText('Submit Feedback');
    await user.click(submitButton);
    
    // Should show loading state
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('should display severity badges for issues', async () => {
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Check for severity badges
    expect(screen.getByText('LOW')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });

  it('should render star ratings correctly', async () => {
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Check that star ratings are rendered for each metric
    const starIcons = screen.getAllByTestId('star-icon');
    expect(starIcons.length).toBeGreaterThan(0);
    
    // Check that some stars are filled (yellow) and some are not
    const filledStars = starIcons.filter(star => 
      star.classList.contains('fill-yellow-400')
    );
    expect(filledStars.length).toBeGreaterThan(0);
  });

  it('should close feedback dialog when cancelled', async () => {
    const user = userEvent.setup();
    
    render(<QualityAssessment job={mockJob} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quality Assessment')).toBeInTheDocument();
    });
    
    // Open feedback dialog
    const feedbackButton = screen.getByText('Provide Feedback');
    await user.click(feedbackButton);
    
    expect(screen.getByText('Quality Feedback')).toBeInTheDocument();
    
    // Cancel dialog
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    // Dialog should be closed
    expect(screen.queryByText('Quality Feedback')).not.toBeInTheDocument();
  });
});
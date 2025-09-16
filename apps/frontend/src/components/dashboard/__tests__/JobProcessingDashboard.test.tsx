import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { JobProcessingDashboard } from '../JobProcessingDashboard';
import { DubbingJob, JobStatus } from '@dubai/shared';

// Mock the API client
vi.mock('../../../services/api', () => ({
  apiClient: {
    getJobs: vi.fn(),
    deleteJob: vi.fn(),
  }
}));

// Mock the WebSocket hook
vi.mock('../../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
    onJobUpdate: vi.fn(() => () => {}),
    onError: vi.fn(() => () => {}),
  }))
}));

// Mock the toast hook
vi.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 minutes ago'),
  format: vi.fn(() => '2024-01-15')
}));

const mockJobs: DubbingJob[] = [
  {
    id: 'job-1',
    userId: 'user-1',
    title: 'Test Job 1',
    status: JobStatus.COMPLETED,
    progress: 100,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
    inputFiles: {
      video: {
        id: 'video-1',
        filename: 'test.mp4',
        size: 1000000,
        mimeType: 'video/mp4',
        storagePath: '/uploads/test.mp4',
        uploadedAt: '2024-01-15T10:00:00Z'
      }
    },
    outputFiles: {},
    processingMetrics: {
      totalProcessingTime: 120000,
      ttsService: 'google',
      costBreakdown: {
        transcriptionCost: 0.01,
        translationCost: 0.005,
        ttsCost: 0.02,
        processingCost: 0.001,
        totalCost: 0.036
      }
    }
  },
  {
    id: 'job-2',
    userId: 'user-1',
    title: 'Test Job 2',
    status: JobStatus.TRANSCRIBING,
    progress: 45,
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    inputFiles: {
      video: {
        id: 'video-2',
        filename: 'test2.mp4',
        size: 2000000,
        mimeType: 'video/mp4',
        storagePath: '/uploads/test2.mp4',
        uploadedAt: '2024-01-15T09:00:00Z'
      }
    },
    outputFiles: {},
    processingMetrics: {
      ttsService: 'coqui',
      costBreakdown: {
        transcriptionCost: 0,
        translationCost: 0,
        ttsCost: 0,
        processingCost: 0,
        totalCost: 0
      }
    }
  }
];

describe('JobProcessingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    const { apiClient } = require('../../../services/api');
    apiClient.getJobs.mockResolvedValue(mockJobs);
    apiClient.deleteJob.mockResolvedValue(undefined);
  });

  it('renders the dashboard with job statistics', async () => {
    render(<JobProcessingDashboard />);
    
    // Wait for jobs to load
    await waitFor(() => {
      expect(screen.getByText('Job Processing Dashboard')).toBeInTheDocument();
    });

    // Check if statistics are displayed
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('displays jobs in different tabs', async () => {
    render(<JobProcessingDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Job 1')).toBeInTheDocument();
      expect(screen.getByText('Test Job 2')).toBeInTheDocument();
    });

    // Check tab structure
    expect(screen.getByRole('tab', { name: /Active/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Completed/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Failed/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /History/ })).toBeInTheDocument();
  });

  it('allows searching for jobs', async () => {
    render(<JobProcessingDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Job 1')).toBeInTheDocument();
    });

    // Find and use the search input
    const searchInput = screen.getByPlaceholderText(/Search jobs/);
    fireEvent.change(searchInput, { target: { value: 'Test Job 1' } });

    // The search functionality should filter jobs (this would be tested with actual filtering logic)
    expect(searchInput).toHaveValue('Test Job 1');
  });

  it('allows filtering by status', async () => {
    render(<JobProcessingDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Job 1')).toBeInTheDocument();
    });

    // Find the filter dropdown (this would need proper testing with actual filtering)
    const filterButton = screen.getByRole('combobox');
    expect(filterButton).toBeInTheDocument();
  });

  it('handles refresh functionality', async () => {
    render(<JobProcessingDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Job Processing Dashboard')).toBeInTheDocument();
    });

    // Find and click refresh button
    const refreshButton = screen.getByRole('button', { name: /Refresh/ });
    fireEvent.click(refreshButton);

    // Verify API was called again
    const { apiClient } = require('../../../services/api');
    expect(apiClient.getJobs).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
  });

  it('displays loading state initially', () => {
    // Mock a delayed API response
    const { apiClient } = require('../../../services/api');
    apiClient.getJobs.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockJobs), 1000)));

    render(<JobProcessingDashboard />);
    
    expect(screen.getByText('Loading your jobs...')).toBeInTheDocument();
  });

  it('displays error state when API fails', async () => {
    // Mock API failure
    const { apiClient } = require('../../../services/api');
    apiClient.getJobs.mockRejectedValue(new Error('API Error'));

    render(<JobProcessingDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/API Error/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no jobs exist', async () => {
    // Mock empty jobs response
    const { apiClient } = require('../../../services/api');
    apiClient.getJobs.mockResolvedValue([]);

    render(<JobProcessingDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('No Active Jobs')).toBeInTheDocument();
    });
  });
});
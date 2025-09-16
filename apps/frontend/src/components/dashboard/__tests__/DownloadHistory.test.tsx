import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DownloadHistory } from '../DownloadHistory';
import { apiClient } from '../../../services/api';
import { useToast } from '../../../hooks/use-toast';

// Mock dependencies
vi.mock('../../../services/api');
vi.mock('../../../hooks/use-toast');

const mockApiClient = apiClient as any;
const mockUseToast = useToast as any;

const mockToast = vi.fn();
mockUseToast.mockReturnValue({ toast: mockToast });

const mockDownloadHistory = {
  downloads: [
    {
      id: 'download-1',
      jobId: 'job-1',
      jobTitle: 'Movie Dubbing 1',
      fileType: 'audio' as const,
      filename: 'dubbed_audio_1.wav',
      downloadedAt: '2024-01-01T12:00:00Z',
      fileSize: 2000000
    },
    {
      id: 'download-2',
      jobId: 'job-1',
      jobTitle: 'Movie Dubbing 1',
      fileType: 'srt' as const,
      filename: 'subtitles_1.srt',
      downloadedAt: '2024-01-01T12:05:00Z',
      fileSize: 5000
    },
    {
      id: 'download-3',
      jobId: 'job-2',
      jobTitle: 'Movie Dubbing 2',
      fileType: 'video' as const,
      filename: 'final_video_2.mp4',
      downloadedAt: '2024-01-02T10:00:00Z',
      fileSize: 50000000
    }
  ],
  totalDownloads: 3,
  totalSize: 52005000
};

describe('DownloadHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.getDownloadHistory.mockResolvedValue(mockDownloadHistory);
  });

  it('should load and display download history', async () => {
    render(<DownloadHistory />);
    
    // Should show loading initially
    expect(screen.getByText('Loading download history...')).toBeInTheDocument();
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    expect(mockApiClient.getDownloadHistory).toHaveBeenCalled();
    
    // Check statistics cards
    expect(screen.getByText('3')).toBeInTheDocument(); // Total downloads
    expect(screen.getByText('49.6 MB')).toBeInTheDocument(); // Total size
    
    // Check download entries
    expect(screen.getByText('dubbed_audio_1.wav')).toBeInTheDocument();
    expect(screen.getByText('subtitles_1.srt')).toBeInTheDocument();
    expect(screen.getByText('final_video_2.mp4')).toBeInTheDocument();
  });

  it('should show empty state when no downloads exist', async () => {
    mockApiClient.getDownloadHistory.mockResolvedValue({
      downloads: [],
      totalDownloads: 0,
      totalSize: 0
    });
    
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('No Downloads Yet')).toBeInTheDocument();
      expect(screen.getByText('Your download history will appear here once you start downloading files')).toBeInTheDocument();
    });
  });

  it('should filter downloads by search term', async () => {
    const user = userEvent.setup();
    
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Search for specific file
    const searchInput = screen.getByPlaceholderText('Search downloads...');
    await user.type(searchInput, 'audio');
    
    // Should show only audio files
    expect(screen.getByText('dubbed_audio_1.wav')).toBeInTheDocument();
    expect(screen.queryByText('subtitles_1.srt')).not.toBeInTheDocument();
    expect(screen.queryByText('final_video_2.mp4')).not.toBeInTheDocument();
  });

  it('should filter downloads by file type', async () => {
    const user = userEvent.setup();
    
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Open filter dropdown
    const filterButton = screen.getByText('All Types');
    await user.click(filterButton);
    
    // Select audio files only
    const audioFilter = screen.getByText('Audio Files');
    await user.click(audioFilter);
    
    // Should show only audio files
    expect(screen.getByText('dubbed_audio_1.wav')).toBeInTheDocument();
    expect(screen.queryByText('subtitles_1.srt')).not.toBeInTheDocument();
    expect(screen.queryByText('final_video_2.mp4')).not.toBeInTheDocument();
  });

  it('should display correct file type badges', async () => {
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Check for file type badges
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Subtitles')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('should format file sizes correctly', async () => {
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Check file size formatting
    expect(screen.getByText('1.91 MB')).toBeInTheDocument(); // 2000000 bytes
    expect(screen.getByText('4.88 KB')).toBeInTheDocument(); // 5000 bytes
    expect(screen.getByText('47.68 MB')).toBeInTheDocument(); // 50000000 bytes
  });

  it('should handle re-download action', async () => {
    const user = userEvent.setup();
    
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Click on actions menu for first download
    const actionButtons = screen.getAllByRole('button', { name: /more/i });
    await user.click(actionButtons[0]);
    
    // Click download again
    const downloadAgainButton = screen.getByText('Download Again');
    await user.click(downloadAgainButton);
    
    expect(mockToast).toHaveBeenCalledWith({
      title: "Download Started",
      description: "Re-downloading dubbed_audio_1.wav",
    });
  });

  it('should navigate to job details', async () => {
    const user = userEvent.setup();
    
    // Mock window.location
    delete (window as any).location;
    window.location = { href: '' } as any;
    
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Click on actions menu for first download
    const actionButtons = screen.getAllByRole('button', { name: /more/i });
    await user.click(actionButtons[0]);
    
    // Click view job
    const viewJobButton = screen.getByText('View Job');
    await user.click(viewJobButton);
    
    expect(window.location.href).toBe('/jobs/job-1');
  });

  it('should show no results message when search has no matches', async () => {
    const user = userEvent.setup();
    
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Search for non-existent file
    const searchInput = screen.getByPlaceholderText('Search downloads...');
    await user.type(searchInput, 'nonexistent');
    
    expect(screen.getByText('No downloads match your search criteria')).toBeInTheDocument();
  });

  it('should calculate monthly downloads correctly', async () => {
    // Mock current date to January 2024
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
    
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Should show 2 downloads for January 2024 (download-1 and download-2)
    expect(screen.getByText('2')).toBeInTheDocument();
    
    vi.useRealTimers();
  });

  it('should handle API errors gracefully', async () => {
    mockApiClient.getDownloadHistory.mockRejectedValue(new Error('Failed to load history'));
    
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to load download history",
        variant: "destructive",
      });
    });
  });

  it('should display relative time correctly', async () => {
    render(<DownloadHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Download History')).toBeInTheDocument();
    });
    
    // Check for relative time display (will vary based on current date)
    const relativeTimes = screen.getAllByText(/ago$/);
    expect(relativeTimes.length).toBeGreaterThan(0);
  });
});
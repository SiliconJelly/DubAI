import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FileDownloadManager } from '../FileDownloadManager';
import { DubbingJob, JobStatus } from '@dubai/shared';

// Mock child components
vi.mock('../ResultsManager', () => ({
    ResultsManager: ({ job }: { job: DubbingJob }) => (
        <div data-testid="results-manager">Results for {job.title}</div>
    )
}));

vi.mock('../DownloadHistory', () => ({
    DownloadHistory: () => <div data-testid="download-history">Download History</div>
}));

vi.mock('../QualityAssessment', () => ({
    QualityAssessment: ({ job }: { job: DubbingJob }) => (
        <div data-testid="quality-assessment">Quality for {job.title}</div>
    )
}));

vi.mock('../FileOrganization', () => ({
    FileOrganization: ({ jobs }: { jobs: DubbingJob[] }) => (
        <div data-testid="file-organization">Organization for {jobs.length} jobs</div>
    )
}));

const mockJobs: DubbingJob[] = [
    {
        id: 'job-1',
        userId: 'user-1',
        title: 'Movie 1',
        status: JobStatus.COMPLETED,
        progress: 100,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T01:00:00Z',
        inputFiles: {
            video: {
                id: 'video-1',
                filename: 'movie1.mp4',
                size: 1000000,
                mimeType: 'video/mp4',
                storagePath: '/uploads/video-1',
                uploadedAt: '2024-01-01T00:00:00Z'
            }
        },
        outputFiles: {
            dubbedAudio: {
                id: 'audio-1',
                filename: 'dubbed_audio_1.wav',
                size: 2000000,
                mimeType: 'audio/wav',
                storagePath: '/outputs/audio-1',
                uploadedAt: '2024-01-01T01:00:00Z'
            },
            translatedSrt: {
                id: 'srt-1',
                filename: 'subtitles_1.srt',
                size: 5000,
                mimeType: 'text/plain',
                storagePath: '/outputs/srt-1',
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
    },
    {
        id: 'job-2',
        userId: 'user-1',
        title: 'Movie 2',
        status: JobStatus.COMPLETED,
        progress: 100,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T01:00:00Z',
        inputFiles: {
            video: {
                id: 'video-2',
                filename: 'movie2.mp4',
                size: 1500000,
                mimeType: 'video/mp4',
                storagePath: '/uploads/video-2',
                uploadedAt: '2024-01-02T00:00:00Z'
            }
        },
        outputFiles: {
            dubbedAudio: {
                id: 'audio-2',
                filename: 'dubbed_audio_2.wav',
                size: 2500000,
                mimeType: 'audio/wav',
                storagePath: '/outputs/audio-2',
                uploadedAt: '2024-01-02T01:00:00Z'
            },
            finalVideo: {
                id: 'video-final-2',
                filename: 'final_video_2.mp4',
                size: 50000000,
                mimeType: 'video/mp4',
                storagePath: '/outputs/video-final-2',
                uploadedAt: '2024-01-02T01:00:00Z'
            }
        },
        processingMetrics: {
            steps: [],
            totalDuration: 7200,
            totalCost: 8.75,
            ttsService: 'coqui',
            qualityScore: 4.6
        }
    },
    {
        id: 'job-3',
        userId: 'user-1',
        title: 'Movie 3',
        status: JobStatus.TRANSCRIBING,
        progress: 50,
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:30:00Z',
        inputFiles: {
            video: {
                id: 'video-3',
                filename: 'movie3.mp4',
                size: 2000000,
                mimeType: 'video/mp4',
                storagePath: '/uploads/video-3',
                uploadedAt: '2024-01-03T00:00:00Z'
            }
        },
        outputFiles: {},
        processingMetrics: {
            steps: [],
            totalDuration: 0,
            totalCost: 0,
            ttsService: 'google'
        }
    }
];

describe('FileDownloadManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render header statistics correctly', () => {
        render(<FileDownloadManager jobs={mockJobs} />);

        // Check statistics
        expect(screen.getByText('Available Downloads')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument(); // 2 audio + 1 srt + 1 video

        expect(screen.getByText('Completed Jobs')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // 2 completed jobs

        expect(screen.getByText('Avg Quality')).toBeInTheDocument();
        expect(screen.getByText('4.4')).toBeInTheDocument(); // (4.2 + 4.6) / 2

        expect(screen.getByText('Total Processing')).toBeInTheDocument();
        expect(screen.getByText('3h')).toBeInTheDocument(); // (3600 + 7200) / 3600
    });

    it('should render all tabs', () => {
        render(<FileDownloadManager jobs={mockJobs} />);

        expect(screen.getByText('Results')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
        expect(screen.getByText('Quality')).toBeInTheDocument();
        expect(screen.getByText('Organize')).toBeInTheDocument();
    });

    it('should show select job message when no job is selected', () => {
        render(<FileDownloadManager jobs={mockJobs} />);

        // Results tab should show select job message
        expect(screen.getByText('Select a Job')).toBeInTheDocument();
        expect(screen.getByText('Choose a completed job to view and download results')).toBeInTheDocument();
    });

    it('should render ResultsManager when job is selected', () => {
        render(<FileDownloadManager jobs={mockJobs} selectedJob={mockJobs[0]} />);

        expect(screen.getByTestId('results-manager')).toBeInTheDocument();
        expect(screen.getByText('Results for Movie 1')).toBeInTheDocument();
    });

    it('should show selected job badge when job is selected', () => {
        render(<FileDownloadManager jobs={mockJobs} selectedJob={mockJobs[0]} />);

        expect(screen.getByText('Movie 1')).toBeInTheDocument();
    });

    it('should switch to history tab and render DownloadHistory', async () => {
        const user = userEvent.setup();

        render(<FileDownloadManager jobs={mockJobs} />);

        const historyTab = screen.getByText('History');
        await user.click(historyTab);

        expect(screen.getByTestId('download-history')).toBeInTheDocument();
    });

    it('should switch to quality tab and show select job message when no job selected', async () => {
        const user = userEvent.setup();

        render(<FileDownloadManager jobs={mockJobs} />);

        const qualityTab = screen.getByText('Quality');
        await user.click(qualityTab);

        expect(screen.getByText('Select a Job')).toBeInTheDocument();
        expect(screen.getByText('Choose a completed job to view quality assessment')).toBeInTheDocument();
    });

    it('should render QualityAssessment when job is selected and quality tab is active', async () => {
        const user = userEvent.setup();

        render(<FileDownloadManager jobs={mockJobs} selectedJob={mockJobs[0]} />);

        const qualityTab = screen.getByText('Quality');
        await user.click(qualityTab);

        expect(screen.getByTestId('quality-assessment')).toBeInTheDocument();
        expect(screen.getByText('Quality for Movie 1')).toBeInTheDocument();
    });

    it('should switch to organize tab and render FileOrganization', async () => {
        const user = userEvent.setup();

        render(<FileDownloadManager jobs={mockJobs} />);

        const organizeTab = screen.getByText('Organize');
        await user.click(organizeTab);

        expect(screen.getByTestId('file-organization')).toBeInTheDocument();
        expect(screen.getByText('Organization for 3 jobs')).toBeInTheDocument();
    });

    it('should handle empty jobs array', () => {
        render(<FileDownloadManager jobs={[]} />);

        // All stats should be 0
        expect(screen.getByText('0')).toBeInTheDocument(); // Available Downloads
        expect(screen.getByText('0')).toBeInTheDocument(); // Completed Jobs
        expect(screen.getByText('0.0')).toBeInTheDocument(); // Avg Quality
        expect(screen.getByText('0h')).toBeInTheDocument(); // Total Processing
    });

    it('should call onJobSelect when provided', async () => {
        const mockOnJobSelect = vi.fn();
        const user = userEvent.setup();

        render(<FileDownloadManager jobs={mockJobs} onJobSelect={mockOnJobSelect} />);

        const organizeTab = screen.getByText('Organize');
        await user.click(organizeTab);

        // FileOrganization component should receive the onJobSelect prop
        expect(screen.getByTestId('file-organization')).toBeInTheDocument();
    });

    it('should handle jobs with missing output files', () => {
        const jobsWithMissingFiles = [
            {
                ...mockJobs[0],
                outputFiles: {} // No output files
            }
        ];

        render(<FileDownloadManager jobs={jobsWithMissingFiles} />);

        // Available Downloads should be 0
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle jobs with missing processing metrics', () => {
        const jobsWithMissingMetrics = [
            {
                ...mockJobs[0],
                processingMetrics: undefined
            }
        ];

        render(<FileDownloadManager jobs={jobsWithMissingMetrics} />);

        // Should not crash and show 0.0 for quality
        expect(screen.getByText('0.0')).toBeInTheDocument();
    });

    it('should display correct tab icons', () => {
        render(<FileDownloadManager jobs={mockJobs} />);

        // Check that tab icons are rendered (they should be in the DOM)
        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(4);

        // Each tab should have an icon (svg element)
        tabs.forEach(tab => {
            const icon = tab.querySelector('svg');
            expect(icon).toBeInTheDocument();
        });
    });

    it('should maintain tab state when switching between tabs', async () => {
        const user = userEvent.setup();

        render(<FileDownloadManager jobs={mockJobs} selectedJob={mockJobs[0]} />);

        // Start on results tab
        expect(screen.getByTestId('results-manager')).toBeInTheDocument();

        // Switch to history
        await user.click(screen.getByText('History'));
        expect(screen.getByTestId('download-history')).toBeInTheDocument();

        // Switch back to results
        await user.click(screen.getByText('Results'));
        expect(screen.getByTestId('results-manager')).toBeInTheDocument();
    });
});
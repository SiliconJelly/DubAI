import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../contexts/AuthContext';
import { Dashboard } from '../../components/Dashboard';

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN,
};

global.WebSocket = vi.fn(() => mockWebSocket) as any;

// Mock API service
vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAuthContext = {
  user: { id: '1', email: 'test@example.com' },
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  loading: false,
};

const JobManagementIntegrationTest = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthContext}>
          <Dashboard />
        </AuthContext.Provider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Job Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays job list and allows job management', async () => {
    const { api } = await import('../../services/api');
    
    // Mock jobs API response
    (api.get as any).mockResolvedValue({
      data: [
        {
          id: 'job-1',
          title: 'Test Video 1',
          status: 'completed',
          progress: 100,
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'job-2',
          title: 'Test Video 2',
          status: 'processing',
          progress: 50,
          createdAt: '2024-01-02T00:00:00Z',
        },
      ],
    });

    render(<JobManagementIntegrationTest />);
    
    // Wait for jobs to load
    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
      expect(screen.getByText('Test Video 2')).toBeInTheDocument();
    });
    
    // Check job statuses
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    
    // Check progress indicators
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('handles real-time job updates via WebSocket', async () => {
    const user = userEvent.setup();
    const { api } = await import('../../services/api');
    
    // Mock initial jobs
    (api.get as any).mockResolvedValue({
      data: [
        {
          id: 'job-1',
          title: 'Test Video',
          status: 'processing',
          progress: 25,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    });

    render(<JobManagementIntegrationTest />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
    
    // Simulate WebSocket message for job update
    const messageHandler = mockWebSocket.addEventListener.mock.calls
      .find(call => call[0] === 'message')?.[1];
    
    if (messageHandler) {
      messageHandler({
        data: JSON.stringify({
          type: 'job_update',
          payload: {
            jobId: 'job-1',
            status: 'processing',
            progress: 75,
          },
        }),
      });
    }
    
    // Check for updated progress
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  it('allows job cancellation', async () => {
    const user = userEvent.setup();
    const { api } = await import('../../services/api');
    
    // Mock jobs with processing job
    (api.get as any).mockResolvedValue({
      data: [
        {
          id: 'job-1',
          title: 'Test Video',
          status: 'processing',
          progress: 30,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    
    // Mock cancel job API
    (api.post as any).mockResolvedValue({ data: { success: true } });

    render(<JobManagementIntegrationTest />);
    
    // Wait for job to load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });
    
    // Find and click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    // Confirm cancellation
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/jobs/job-1/cancel');
    });
  });

  it('handles job deletion', async () => {
    const user = userEvent.setup();
    const { api } = await import('../../services/api');
    
    // Mock jobs
    (api.get as any).mockResolvedValue({
      data: [
        {
          id: 'job-1',
          title: 'Test Video',
          status: 'completed',
          progress: 100,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    
    // Mock delete job API
    (api.delete as any).mockResolvedValue({ data: { success: true } });

    render(<JobManagementIntegrationTest />);
    
    // Wait for job to load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });
    
    // Find and click delete button
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);
    
    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/jobs/job-1');
    });
  });

  it('displays job processing steps', async () => {
    const { api } = await import('../../services/api');
    
    // Mock job with detailed processing info
    (api.get as any).mockResolvedValue({
      data: [
        {
          id: 'job-1',
          title: 'Test Video',
          status: 'generating_speech',
          progress: 60,
          currentStep: 'TTS Generation',
          processingSteps: [
            { name: 'Audio Extraction', status: 'completed', progress: 100 },
            { name: 'Transcription', status: 'completed', progress: 100 },
            { name: 'Translation', status: 'completed', progress: 100 },
            { name: 'TTS Generation', status: 'processing', progress: 60 },
            { name: 'Audio Assembly', status: 'pending', progress: 0 },
          ],
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    });

    render(<JobManagementIntegrationTest />);
    
    // Wait for job to load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });
    
    // Check processing steps
    expect(screen.getByText('Audio Extraction')).toBeInTheDocument();
    expect(screen.getByText('Transcription')).toBeInTheDocument();
    expect(screen.getByText('Translation')).toBeInTheDocument();
    expect(screen.getByText('TTS Generation')).toBeInTheDocument();
    expect(screen.getByText('Audio Assembly')).toBeInTheDocument();
    
    // Check step statuses
    expect(screen.getAllByText(/completed/i)).toHaveLength(3);
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });
});
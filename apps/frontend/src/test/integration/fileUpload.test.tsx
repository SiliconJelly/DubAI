import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../contexts/AuthContext';
import { FileUploader } from '../../components/upload/FileUploader';

// Mock the file upload service
vi.mock('../../services/fileUploadService', () => ({
  uploadFile: vi.fn(),
  validateFile: vi.fn().mockReturnValue({ valid: true }),
}));

// Mock the API service
vi.mock('../../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const mockAuthContext = {
  user: { id: '1', email: 'test@example.com' },
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  loading: false,
};

const FileUploadIntegrationTest = () => {
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
          <FileUploader onUploadComplete={vi.fn()} />
        </AuthContext.Provider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('File Upload Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes full file upload flow', async () => {
    const user = userEvent.setup();
    const { uploadFile } = await import('../../services/fileUploadService');
    const { api } = await import('../../services/api');
    
    // Mock successful upload
    (uploadFile as any).mockResolvedValue({
      id: '1',
      filename: 'test.mp4',
      url: 'https://example.com/test.mp4',
    });
    
    // Mock job creation
    (api.post as any).mockResolvedValue({
      data: { id: 'job-1', status: 'uploaded' },
    });

    render(<FileUploadIntegrationTest />);
    
    // Create a test file
    const file = new File(['test video content'], 'test.mp4', { type: 'video/mp4' });
    
    // Find file input and upload file
    const fileInput = screen.getByLabelText(/upload video/i);
    await user.upload(fileInput, file);
    
    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    });
    
    // Verify upload service was called
    expect(uploadFile).toHaveBeenCalledWith(file, expect.any(Function));
    
    // Start processing
    const processButton = screen.getByRole('button', { name: /start processing/i });
    await user.click(processButton);
    
    // Verify job creation API was called
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/jobs', expect.objectContaining({
        videoFileId: '1',
      }));
    });
  });

  it('handles file validation errors', async () => {
    const user = userEvent.setup();
    const { validateFile } = await import('../../services/fileUploadService');
    
    // Mock validation failure
    (validateFile as any).mockReturnValue({
      valid: false,
      error: 'File size too large',
    });

    render(<FileUploadIntegrationTest />);
    
    // Create a test file
    const file = new File(['test'], 'large-file.mp4', { type: 'video/mp4' });
    
    // Upload file
    const fileInput = screen.getByLabelText(/upload video/i);
    await user.upload(fileInput, file);
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/file size too large/i)).toBeInTheDocument();
    });
  });

  it('shows upload progress', async () => {
    const user = userEvent.setup();
    const { uploadFile } = await import('../../services/fileUploadService');
    
    // Mock upload with progress
    (uploadFile as any).mockImplementation((file: File, onProgress: (progress: number) => void) => {
      return new Promise((resolve) => {
        setTimeout(() => onProgress(25), 100);
        setTimeout(() => onProgress(50), 200);
        setTimeout(() => onProgress(75), 300);
        setTimeout(() => {
          onProgress(100);
          resolve({ id: '1', filename: 'test.mp4', url: 'https://example.com/test.mp4' });
        }, 400);
      });
    });

    render(<FileUploadIntegrationTest />);
    
    const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
    const fileInput = screen.getByLabelText(/upload video/i);
    
    await user.upload(fileInput, file);
    
    // Check for progress indicator
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Wait for progress updates
    await waitFor(() => {
      expect(screen.getByText(/25%/)).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    });
  });

  it('handles network errors gracefully', async () => {
    const user = userEvent.setup();
    const { uploadFile } = await import('../../services/fileUploadService');
    
    // Mock network error
    (uploadFile as any).mockRejectedValue(new Error('Network error'));

    render(<FileUploadIntegrationTest />);
    
    const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
    const fileInput = screen.getByLabelText(/upload video/i);
    
    await user.upload(fileInput, file);
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
    
    // Check for retry button
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from '../useFileUpload';

// Mock the file upload service
vi.mock('../../services/fileUploadService', () => ({
  uploadFile: vi.fn(),
  validateFile: vi.fn(),
}));

describe('useFileUpload Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useFileUpload());
    
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.uploadedFiles).toEqual([]);
  });

  it('handles file upload successfully', async () => {
    const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
    const { uploadFile } = await import('../../services/fileUploadService');
    
    (uploadFile as any).mockResolvedValue({
      id: '1',
      filename: 'test.mp4',
      url: 'https://example.com/test.mp4',
    });

    const { result } = renderHook(() => useFileUpload());
    
    await act(async () => {
      await result.current.uploadFile(mockFile);
    });
    
    expect(result.current.uploading).toBe(false);
    expect(result.current.uploadedFiles).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles file upload error', async () => {
    const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
    const { uploadFile } = await import('../../services/fileUploadService');
    
    (uploadFile as any).mockRejectedValue(new Error('Upload failed'));

    const { result } = renderHook(() => useFileUpload());
    
    await act(async () => {
      await result.current.uploadFile(mockFile);
    });
    
    expect(result.current.uploading).toBe(false);
    expect(result.current.error).toBe('Upload failed');
    expect(result.current.uploadedFiles).toHaveLength(0);
  });

  it('validates file before upload', async () => {
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const { validateFile } = await import('../../services/fileUploadService');
    
    (validateFile as any).mockReturnValue({ valid: false, error: 'Invalid file type' });

    const { result } = renderHook(() => useFileUpload());
    
    await act(async () => {
      await result.current.uploadFile(mockFile);
    });
    
    expect(result.current.error).toBe('Invalid file type');
    expect(result.current.uploadedFiles).toHaveLength(0);
  });

  it('tracks upload progress', async () => {
    const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
    const { uploadFile } = await import('../../services/fileUploadService');
    
    let progressCallback: ((progress: number) => void) | undefined;
    (uploadFile as any).mockImplementation((file: File, onProgress: (progress: number) => void) => {
      progressCallback = onProgress;
      return new Promise((resolve) => {
        setTimeout(() => {
          progressCallback?.(50);
          setTimeout(() => {
            progressCallback?.(100);
            resolve({ id: '1', filename: 'test.mp4', url: 'https://example.com/test.mp4' });
          }, 100);
        }, 100);
      });
    });

    const { result } = renderHook(() => useFileUpload());
    
    act(() => {
      result.current.uploadFile(mockFile);
    });
    
    expect(result.current.uploading).toBe(true);
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 250));
    });
    
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(100);
  });
});
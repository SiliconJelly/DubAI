import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useApi } from '../useApi';

// Mock the API service
vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useApi Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches data successfully', async () => {
    const { api } = await import('../../services/api');
    (api.get as any).mockResolvedValue({ data: { id: 1, name: 'Test' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useApi('/test'), { wrapper });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(result.current.data).toEqual({ id: 1, name: 'Test' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles API errors', async () => {
    const { api } = await import('../../services/api');
    (api.get as any).mockRejectedValue(new Error('API Error'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useApi('/test'), { wrapper });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeDefined();
  });

  it('shows loading state initially', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApi('/test'), { wrapper });
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('refetches data when called', async () => {
    const { api } = await import('../../services/api');
    (api.get as any).mockResolvedValue({ data: { id: 1, name: 'Test' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useApi('/test'), { wrapper });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(api.get).toHaveBeenCalledTimes(1);
    
    await act(async () => {
      await result.current.refetch();
    });
    
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
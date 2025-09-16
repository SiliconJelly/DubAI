import { renderHook, act } from '@testing-library/react';
import { AuthContext } from '../../contexts/AuthContext';
import { useAuth } from '../useAuth';

const mockAuthContext = {
  user: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  loading: false,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={mockAuthContext}>
    {children}
  </AuthContext.Provider>
);

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns auth context values', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(typeof result.current.signIn).toBe('function');
    expect(typeof result.current.signOut).toBe('function');
    expect(typeof result.current.signUp).toBe('function');
  });

  it('calls signIn function', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.signIn('test@example.com', 'password');
    });
    
    expect(mockAuthContext.signIn).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('calls signOut function', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.signOut();
    });
    
    expect(mockAuthContext.signOut).toHaveBeenCalled();
  });

  it('calls signUp function', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.signUp('test@example.com', 'password');
    });
    
    expect(mockAuthContext.signUp).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('throws error when used outside AuthContext', () => {
    const { result } = renderHook(() => useAuth());
    
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('useAuth must be used within an AuthProvider');
  });
});
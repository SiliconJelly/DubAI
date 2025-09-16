import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../contexts/AuthContext';
import { Dashboard } from '../Dashboard';

const mockAuthContext = {
  user: { id: '1', email: 'test@example.com' },
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  loading: false,
};

const DashboardWithProviders = () => {
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

// Mock the API calls
vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard layout', async () => {
    render(<DashboardWithProviders />);
    
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });

  it('displays job statistics', async () => {
    render(<DashboardWithProviders />);
    
    await waitFor(() => {
      expect(screen.getByText(/total jobs/i)).toBeInTheDocument();
      expect(screen.getByText(/completed/i)).toBeInTheDocument();
    });
  });

  it('shows upload section', async () => {
    render(<DashboardWithProviders />);
    
    await waitFor(() => {
      expect(screen.getByText(/upload new video/i)).toBeInTheDocument();
    });
  });

  it('displays recent jobs section', async () => {
    render(<DashboardWithProviders />);
    
    await waitFor(() => {
      expect(screen.getByText(/recent jobs/i)).toBeInTheDocument();
    });
  });

  it('has proper accessibility structure', async () => {
    render(<DashboardWithProviders />);
    
    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
    });
  });
});
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { ProtectedRoute } from '../ProtectedRoute';

const mockAuthContext = {
  user: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  loading: false,
};

const ProtectedRouteWithProviders = ({ user = null, loading = false }) => (
  <BrowserRouter>
    <AuthContext.Provider value={{ ...mockAuthContext, user, loading }}>
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    </AuthContext.Provider>
  </BrowserRouter>
);

describe('ProtectedRoute Component', () => {
  it('shows loading spinner when loading', () => {
    render(<ProtectedRouteWithProviders loading={true} />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('redirects to auth when user is not authenticated', () => {
    render(<ProtectedRouteWithProviders />);
    
    // Should not show protected content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    render(<ProtectedRouteWithProviders user={mockUser} />);
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('has proper accessibility attributes for loading state', () => {
    render(<ProtectedRouteWithProviders loading={true} />);
    
    const loadingElement = screen.getByRole('status');
    expect(loadingElement).toHaveAttribute('aria-live', 'polite');
  });
});
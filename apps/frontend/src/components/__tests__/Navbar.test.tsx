import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { Navbar } from '../Navbar';

const mockAuthContext = {
  user: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  loading: false,
};

const NavbarWithProviders = ({ user = null }) => (
  <BrowserRouter>
    <AuthContext.Provider value={{ ...mockAuthContext, user }}>
      <Navbar />
    </AuthContext.Provider>
  </BrowserRouter>
);

describe('Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders logo and navigation links', () => {
    render(<NavbarWithProviders />);
    
    expect(screen.getByText(/dubai/i)).toBeInTheDocument();
    expect(screen.getByText(/features/i)).toBeInTheDocument();
    expect(screen.getByText(/how it works/i)).toBeInTheDocument();
  });

  it('shows login button when user is not authenticated', () => {
    render(<NavbarWithProviders />);
    
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('shows user profile when user is authenticated', () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    render(<NavbarWithProviders user={mockUser} />);
    
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });

  it('handles mobile menu toggle', () => {
    render(<NavbarWithProviders />);
    
    const mobileMenuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(mobileMenuButton);
    
    // Check if mobile menu is visible
    expect(screen.getByRole('navigation')).toHaveClass('mobile-menu-open');
  });

  it('has proper accessibility attributes', () => {
    render(<NavbarWithProviders />);
    
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Main navigation');
  });
});
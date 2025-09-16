import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MobileNavigation } from '../MobileNavigation';
import { useResponsive } from '@/hooks/useResponsive';

// Mock the responsive hook
vi.mock('@/hooks/useResponsive');
const mockUseResponsive = vi.mocked(useResponsive);

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null })
    }
  }
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' })
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('MobileNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render mobile bottom navigation on mobile devices', () => {
    mockUseResponsive.mockReturnValue({
      width: 375,
      height: 812,
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'xs',
      isPortrait: true,
      isLandscape: false,
      isTouchDevice: true
    });

    renderWithRouter(<MobileNavigation />);

    // Should show bottom navigation with main items
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('should render tablet side navigation on tablet devices', () => {
    mockUseResponsive.mockReturnValue({
      width: 768,
      height: 1024,
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      currentBreakpoint: 'md',
      isPortrait: true,
      isLandscape: false,
      isTouchDevice: true
    });

    renderWithRouter(<MobileNavigation />);

    // Should show side navigation (icons only)
    const navigationButtons = screen.getAllByRole('button');
    expect(navigationButtons.length).toBeGreaterThan(0);
  });

  it('should not render on desktop devices', () => {
    mockUseResponsive.mockReturnValue({
      width: 1200,
      height: 800,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      currentBreakpoint: 'lg',
      isPortrait: false,
      isLandscape: true,
      isTouchDevice: false
    });

    const { container } = renderWithRouter(<MobileNavigation />);

    // Should not render anything on desktop
    expect(container.firstChild).toBeNull();
  });

  it('should navigate when navigation items are clicked', () => {
    mockUseResponsive.mockReturnValue({
      width: 375,
      height: 812,
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'xs',
      isPortrait: true,
      isLandscape: false,
      isTouchDevice: true
    });

    renderWithRouter(<MobileNavigation />);

    const homeButton = screen.getByText('Home');
    fireEvent.click(homeButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should highlight active navigation item', () => {
    mockUseResponsive.mockReturnValue({
      width: 375,
      height: 812,
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'xs',
      isPortrait: true,
      isLandscape: false,
      isTouchDevice: true
    });

    renderWithRouter(<MobileNavigation />);

    const homeButton = screen.getByText('Home').closest('button');
    expect(homeButton).toHaveClass('text-primary', 'bg-primary/10');
  });

  it('should open mobile menu sheet when More button is clicked', () => {
    mockUseResponsive.mockReturnValue({
      width: 375,
      height: 812,
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'xs',
      isPortrait: true,
      isLandscape: false,
      isTouchDevice: true
    });

    renderWithRouter(<MobileNavigation />);

    const moreButton = screen.getByText('More');
    fireEvent.click(moreButton);

    // Should open the sheet with additional menu items
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
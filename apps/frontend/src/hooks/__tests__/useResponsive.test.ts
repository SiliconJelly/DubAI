import { renderHook, act } from '@testing-library/react';
import { useResponsive, useBreakpoint, useResponsiveValue } from '../useResponsive';

// Mock window.matchMedia
const mockMatchMedia = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 800,
  });

  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('useResponsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect mobile screen size', () => {
    mockMatchMedia(375); // iPhone size
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.currentBreakpoint).toBe('xs');
  });

  it('should detect tablet screen size', () => {
    mockMatchMedia(768); // iPad size
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.currentBreakpoint).toBe('md');
  });

  it('should detect desktop screen size', () => {
    mockMatchMedia(1200); // Desktop size
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.currentBreakpoint).toBe('lg');
  });

  it('should detect portrait orientation', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 812,
    });
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.isPortrait).toBe(true);
    expect(result.current.isLandscape).toBe(false);
  });

  it('should update on window resize', () => {
    mockMatchMedia(375); // Start mobile
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.isMobile).toBe(true);
    
    // Simulate resize to desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });
      
      window.dispatchEvent(new Event('resize'));
    });
    
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
  });
});

describe('useBreakpoint', () => {
  it('should return true for current breakpoint', () => {
    mockMatchMedia(1024); // lg breakpoint
    
    const { result } = renderHook(() => useBreakpoint('lg'));
    
    expect(result.current).toBe(true);
  });

  it('should return false for larger breakpoint', () => {
    mockMatchMedia(768); // md breakpoint
    
    const { result } = renderHook(() => useBreakpoint('lg'));
    
    expect(result.current).toBe(false);
  });
});

describe('useResponsiveValue', () => {
  it('should return appropriate value for current breakpoint', () => {
    mockMatchMedia(768); // md breakpoint
    
    const values = {
      xs: 'mobile',
      md: 'tablet',
      lg: 'desktop'
    };
    
    const { result } = renderHook(() => useResponsiveValue(values));
    
    expect(result.current).toBe('tablet');
  });

  it('should fallback to smaller breakpoint value', () => {
    mockMatchMedia(640); // sm breakpoint
    
    const values = {
      xs: 'mobile',
      lg: 'desktop'
    };
    
    const { result } = renderHook(() => useResponsiveValue(values));
    
    expect(result.current).toBe('mobile');
  });
});
import { render, screen } from '@testing-library/react';
import { Features } from '../Features';

describe('Features Component', () => {
  it('renders all feature cards', () => {
    render(<Features />);
    
    // Check for key features
    expect(screen.getByText(/ai-powered translation/i)).toBeInTheDocument();
    expect(screen.getByText(/high-quality voice synthesis/i)).toBeInTheDocument();
    expect(screen.getByText(/fast processing/i)).toBeInTheDocument();
  });

  it('renders feature icons', () => {
    render(<Features />);
    
    // Check that icons are present (assuming they have proper alt text or aria-labels)
    const icons = screen.getAllByRole('img', { hidden: true });
    expect(icons.length).toBeGreaterThan(0);
  });

  it('has proper section structure', () => {
    render(<Features />);
    
    const section = screen.getByRole('region', { name: /features/i });
    expect(section).toBeInTheDocument();
  });

  it('displays feature descriptions', () => {
    render(<Features />);
    
    expect(screen.getByText(/advanced ai technology/i)).toBeInTheDocument();
    expect(screen.getByText(/natural-sounding voices/i)).toBeInTheDocument();
  });
});
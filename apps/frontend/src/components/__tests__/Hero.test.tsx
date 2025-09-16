import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Hero } from '../Hero';

const HeroWithRouter = () => (
  <BrowserRouter>
    <Hero />
  </BrowserRouter>
);

describe('Hero Component', () => {
  it('renders hero heading', () => {
    render(<HeroWithRouter />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders call-to-action button', () => {
    render(<HeroWithRouter />);
    const ctaButton = screen.getByRole('button', { name: /get started/i });
    expect(ctaButton).toBeInTheDocument();
  });

  it('renders hero description', () => {
    render(<HeroWithRouter />);
    expect(screen.getByText(/transform your english videos/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<HeroWithRouter />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAttribute('aria-level', '1');
  });
});
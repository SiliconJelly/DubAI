import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../contexts/AuthContext';
import { Hero } from '../../components/Hero';
import { Features } from '../../components/Features';
import { Navbar } from '../../components/Navbar';
import { Dashboard } from '../../components/Dashboard';
import { FileUploader } from '../../components/upload/FileUploader';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

const mockAuthContext = {
  user: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  loading: false,
};

const TestWrapper = ({ children, user = null }: { children: React.ReactNode; user?: any }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ ...mockAuthContext, user }}>
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Accessibility Tests', () => {
  it('Hero component should be accessible', async () => {
    const { container } = render(
      <TestWrapper>
        <Hero />
      </TestWrapper>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Features component should be accessible', async () => {
    const { container } = render(<Features />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Navbar component should be accessible', async () => {
    const { container } = render(
      <TestWrapper>
        <Navbar />
      </TestWrapper>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Navbar with authenticated user should be accessible', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    const { container } = render(
      <TestWrapper user={mockUser}>
        <Navbar />
      </TestWrapper>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Dashboard component should be accessible', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    const { container } = render(
      <TestWrapper user={mockUser}>
        <Dashboard />
      </TestWrapper>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('FileUploader component should be accessible', async () => {
    const { container } = render(
      <TestWrapper>
        <FileUploader onUploadComplete={vi.fn()} />
      </TestWrapper>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', async () => {
    const { container } = render(
      <TestWrapper>
        <div>
          <h1>Main Title</h1>
          <h2>Section Title</h2>
          <h3>Subsection Title</h3>
        </div>
      </TestWrapper>
    );
    
    const results = await axe(container, {
      rules: {
        'heading-order': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper form labels', async () => {
    const { container } = render(
      <div>
        <form>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" />
          
          <label htmlFor="password">Password</label>
          <input id="password" type="password" />
          
          <button type="submit">Submit</button>
        </form>
      </div>
    );
    
    const results = await axe(container, {
      rules: {
        'label': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper color contrast', async () => {
    const { container } = render(
      <div>
        <p style={{ color: '#000000', backgroundColor: '#ffffff' }}>
          High contrast text
        </p>
        <button style={{ color: '#ffffff', backgroundColor: '#007bff' }}>
          Accessible button
        </button>
      </div>
    );
    
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', async () => {
    const { container } = render(
      <div>
        <button aria-label="Close dialog" aria-expanded="false">
          ×
        </button>
        <div role="dialog" aria-labelledby="dialog-title" aria-modal="true">
          <h2 id="dialog-title">Dialog Title</h2>
          <p>Dialog content</p>
        </div>
        <nav aria-label="Main navigation">
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
          </ul>
        </nav>
      </div>
    );
    
    const results = await axe(container, {
      rules: {
        'aria-valid-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });

  it('should have keyboard navigation support', async () => {
    const { container } = render(
      <div>
        <button tabIndex={0}>First button</button>
        <a href="#" tabIndex={0}>Link</a>
        <input type="text" tabIndex={0} />
        <button tabIndex={0}>Last button</button>
      </div>
    );
    
    const results = await axe(container, {
      rules: {
        'tabindex': { enabled: true },
        'focusable-content': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper image alt text', async () => {
    const { container } = render(
      <div>
        <img src="/logo.png" alt="DubAI Logo" />
        <img src="/hero-bg.jpg" alt="Video dubbing illustration" />
        <img src="/decorative.png" alt="" role="presentation" />
      </div>
    );
    
    const results = await axe(container, {
      rules: {
        'image-alt': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper landmark regions', async () => {
    const { container } = render(
      <div>
        <header>
          <nav aria-label="Main navigation">Navigation</nav>
        </header>
        <main>
          <section aria-labelledby="features-title">
            <h2 id="features-title">Features</h2>
            <p>Feature content</p>
          </section>
        </main>
        <footer>
          <p>Footer content</p>
        </footer>
      </div>
    );
    
    const results = await axe(container, {
      rules: {
        'landmark-one-main': { enabled: true },
        'region': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });
});
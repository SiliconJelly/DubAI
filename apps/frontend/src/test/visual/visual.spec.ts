import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for visual tests
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('homepage should match visual snapshot', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Hide dynamic content that might cause flaky tests
    await page.addStyleTag({
      content: `
        [data-testid="current-time"],
        .animate-pulse,
        .animate-spin {
          animation: none !important;
        }
      `
    });
    
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('authentication page should match visual snapshot', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('auth-page.png');
  });

  test('dashboard should match visual snapshot', async ({ page }) => {
    // Mock authentication
    await page.route('**/auth/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: '1', email: 'test@example.com' }
        })
      });
    });
    
    // Mock jobs data for consistent visuals
    await page.route('**/jobs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'job-1',
            title: 'Sample Video 1',
            status: 'completed',
            progress: 100,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'job-2',
            title: 'Sample Video 2',
            status: 'processing',
            progress: 65,
            currentStep: 'TTS Generation',
            createdAt: '2024-01-02T00:00:00Z'
          }
        ])
      });
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Hide dynamic timestamps and animations
    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        .animate-pulse,
        .animate-spin,
        .animate-bounce {
          animation: none !important;
        }
      `
    });
    
    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('file upload component should match visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Focus on file upload area
    const uploadArea = page.locator('[data-testid="file-upload-zone"]');
    await expect(uploadArea).toBeVisible();
    
    await expect(uploadArea).toHaveScreenshot('file-upload-zone.png');
  });

  test('job processing steps should match visual snapshot', async ({ page }) => {
    // Mock detailed job data
    await page.route('**/jobs/job-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'job-1',
          title: 'Sample Video',
          status: 'processing',
          progress: 60,
          currentStep: 'TTS Generation',
          processingSteps: [
            { name: 'Audio Extraction', status: 'completed', progress: 100 },
            { name: 'Transcription', status: 'completed', progress: 100 },
            { name: 'Translation', status: 'completed', progress: 100 },
            { name: 'TTS Generation', status: 'processing', progress: 60 },
            { name: 'Audio Assembly', status: 'pending', progress: 0 }
          ]
        })
      });
    });
    
    await page.goto('/dashboard');
    await page.click('[data-testid="job-1"]');
    
    const processingSteps = page.locator('[data-testid="processing-steps"]');
    await expect(processingSteps).toBeVisible();
    
    await expect(processingSteps).toHaveScreenshot('processing-steps.png');
  });

  test('mobile dashboard should match visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    // Mock authentication and data
    await page.route('**/auth/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: '1', email: 'test@example.com' }
        })
      });
    });
    
    await page.route('**/jobs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'job-1',
            title: 'Mobile Test Video',
            status: 'processing',
            progress: 45,
            createdAt: '2024-01-01T00:00:00Z'
          }
        ])
      });
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('mobile-dashboard.png');
  });

  test('error states should match visual snapshot', async ({ page }) => {
    // Mock error response
    await page.route('**/jobs', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    
    await expect(errorMessage).toHaveScreenshot('error-state.png');
  });

  test('loading states should match visual snapshot', async ({ page }) => {
    // Delay the response to capture loading state
    await page.route('**/jobs', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
    
    await page.goto('/dashboard');
    
    // Capture loading state
    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible();
    
    await expect(loadingSpinner).toHaveScreenshot('loading-state.png');
  });

  test('dark mode should match visual snapshot', async ({ page }) => {
    await page.goto('/');
    
    // Enable dark mode
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(500); // Wait for theme transition
    
    await expect(page).toHaveScreenshot('homepage-dark.png');
  });

  test('high contrast mode should match visual snapshot', async ({ page }) => {
    await page.goto('/');
    
    // Simulate high contrast mode
    await page.addStyleTag({
      content: `
        * {
          background-color: black !important;
          color: white !important;
          border-color: white !important;
        }
        button, input, select, textarea {
          background-color: black !important;
          color: white !important;
          border: 2px solid white !important;
        }
      `
    });
    
    await expect(page).toHaveScreenshot('homepage-high-contrast.png');
  });

  test('component states should match visual snapshots', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Test button states
    const button = page.locator('button').first();
    
    // Normal state
    await expect(button).toHaveScreenshot('button-normal.png');
    
    // Hover state
    await button.hover();
    await expect(button).toHaveScreenshot('button-hover.png');
    
    // Focus state
    await button.focus();
    await expect(button).toHaveScreenshot('button-focus.png');
    
    // Disabled state (if applicable)
    await page.addStyleTag({
      content: `
        button:first-of-type {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `
    });
    await expect(button).toHaveScreenshot('button-disabled.png');
  });
});
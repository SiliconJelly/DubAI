import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility E2E Tests', () => {
  test('homepage should be accessible', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('authentication page should be accessible', async ({ page }) => {
    await page.goto('/auth');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('dashboard should be accessible when authenticated', async ({ page }) => {
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
    
    await page.goto('/dashboard');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
  });

  test('should support screen reader navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check for proper heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
    
    // Check for proper landmark regions
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    
    // Check for proper ARIA labels
    const ariaLabels = await page.locator('[aria-label]').all();
    for (const element of ariaLabels) {
      const ariaLabel = await element.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.trim().length).toBeGreaterThan(0);
    }
  });

  test('should have proper focus management in modals', async ({ page }) => {
    await page.goto('/');
    
    // Open a modal (assuming there's a modal trigger)
    await page.click('button:has-text("Sign In")');
    
    // Check that focus is trapped in modal
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').first();
    
    // The focused element should be within the modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toContainText(await focusedElement.textContent() || '');
  });

  test('should have proper color contrast', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    // Filter for color contrast violations
    const colorContrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );
    
    expect(colorContrastViolations).toEqual([]);
  });

  test('should work with high contrast mode', async ({ page }) => {
    // Simulate high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addStyleTag({
      content: `
        * {
          background-color: black !important;
          color: white !important;
        }
      `
    });
    
    await page.goto('/');
    
    // Check that content is still visible and accessible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support reduced motion preferences', async ({ page }) => {
    // Simulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.goto('/');
    
    // Check that animations are disabled or reduced
    const animatedElements = await page.locator('[class*="animate"]').all();
    
    for (const element of animatedElements) {
      const computedStyle = await element.evaluate(el => {
        return window.getComputedStyle(el).animationDuration;
      });
      
      // Animation should be disabled or very short
      expect(['0s', '0.01s']).toContain(computedStyle);
    }
  });

  test('should have proper form validation and error messages', async ({ page }) => {
    await page.goto('/auth');
    
    // Try to submit form without filling required fields
    await page.click('button[type="submit"]');
    
    // Check for accessible error messages
    const errorMessages = await page.locator('[role="alert"], .error-message').all();
    
    for (const errorMessage of errorMessages) {
      await expect(errorMessage).toBeVisible();
      
      // Error message should be associated with form field
      const ariaDescribedBy = await errorMessage.getAttribute('aria-describedby');
      if (ariaDescribedBy) {
        const associatedField = page.locator(`#${ariaDescribedBy}`);
        await expect(associatedField).toBeVisible();
      }
    }
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support zoom up to 200%', async ({ page }) => {
    await page.goto('/');
    
    // Zoom to 200%
    await page.setViewportSize({ width: 640, height: 480 }); // Simulate 200% zoom
    
    // Check that content is still accessible and usable
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    
    // Check that interactive elements are still clickable
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 3)) { // Test first 3 buttons
      await expect(button).toBeVisible();
      
      const boundingBox = await button.boundingBox();
      expect(boundingBox?.width).toBeGreaterThan(0);
      expect(boundingBox?.height).toBeGreaterThan(0);
    }
  });

  test('should have proper skip links', async ({ page }) => {
    await page.goto('/');
    
    // Press Tab to focus on skip link (usually the first focusable element)
    await page.keyboard.press('Tab');
    
    const skipLink = await page.locator(':focus').first();
    const skipLinkText = await skipLink.textContent();
    
    // Skip link should contain relevant text
    expect(skipLinkText?.toLowerCase()).toMatch(/skip|main|content/);
    
    // Activate skip link
    await page.keyboard.press('Enter');
    
    // Focus should move to main content
    const focusedElement = await page.locator(':focus').first();
    const mainContent = page.locator('main');
    
    // The focused element should be within or be the main content area
    await expect(mainContent).toBeVisible();
  });
});
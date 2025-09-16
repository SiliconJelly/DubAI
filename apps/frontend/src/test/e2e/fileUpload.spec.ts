import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('should display file upload interface', async ({ page }) => {
    await expect(page.locator('[data-testid="file-upload-zone"]')).toBeVisible();
    await expect(page.locator('text=Drag and drop your video file here')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test('should accept valid video files', async ({ page }) => {
    // Mock file upload API
    await page.route('**/files/upload', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'file-1',
          filename: 'test.mp4',
          url: 'https://example.com/test.mp4'
        })
      });
    });

    // Create a test file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Choose file');
    const fileChooser = await fileChooserPromise;
    
    // Upload a mock video file
    await fileChooser.setFiles({
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('mock video content')
    });

    await expect(page.locator('text=test.mp4')).toBeVisible();
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
  });

  test('should reject invalid file types', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Choose file');
    const fileChooser = await fileChooserPromise;
    
    // Try to upload a text file
    await fileChooser.setFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('text content')
    });

    await expect(page.locator('text=Invalid file type')).toBeVisible();
  });

  test('should show upload progress', async ({ page }) => {
    // Mock progressive upload response
    let progressStep = 0;
    await page.route('**/files/upload', async route => {
      progressStep += 25;
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (progressStep >= 100) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'file-1',
            filename: 'test.mp4',
            url: 'https://example.com/test.mp4'
          })
        });
      } else {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ progress: progressStep })
        });
      }
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Choose file');
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles({
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('mock video content')
    });

    // Check for progress indicators
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('text=25%')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('text=Upload complete')).toBeVisible();
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Mock upload failure
    await page.route('**/files/upload', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Upload failed' })
      });
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Choose file');
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles({
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('mock video content')
    });

    await expect(page.locator('text=Upload failed')).toBeVisible();
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
  });

  test('should allow SRT file upload alongside video', async ({ page }) => {
    // Mock file uploads
    await page.route('**/files/upload', async route => {
      const request = route.request();
      const filename = request.url().includes('video') ? 'test.mp4' : 'test.srt';
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: filename === 'test.mp4' ? 'video-1' : 'srt-1',
          filename,
          url: `https://example.com/${filename}`
        })
      });
    });

    // Upload video file
    const videoChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="video-upload"] text=Choose file');
    const videoChooser = await videoChooserPromise;
    
    await videoChooser.setFiles({
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('mock video content')
    });

    // Upload SRT file
    const srtChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="srt-upload"] text=Choose file');
    const srtChooser = await srtChooserPromise;
    
    await srtChooser.setFiles({
      name: 'test.srt',
      mimeType: 'text/plain',
      buffer: Buffer.from('1\n00:00:00,000 --> 00:00:05,000\nTest subtitle')
    });

    await expect(page.locator('text=test.mp4')).toBeVisible();
    await expect(page.locator('text=test.srt')).toBeVisible();
    await expect(page.locator('button:has-text("Start Processing")')).toBeEnabled();
  });
});
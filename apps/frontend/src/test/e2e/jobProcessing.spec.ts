import { test, expect } from '@playwright/test';

test.describe('Job Processing Flow', () => {
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
    
    // Mock jobs API
    await page.route('**/jobs', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'job-1',
              title: 'Test Video',
              status: 'processing',
              progress: 45,
              currentStep: 'Translation',
              createdAt: '2024-01-01T00:00:00Z'
            }
          ])
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'job-2',
            title: 'New Job',
            status: 'uploaded',
            progress: 0
          })
        });
      }
    });
    
    await page.goto('/dashboard');
  });

  test('should display job processing dashboard', async ({ page }) => {
    await expect(page.locator('[data-testid="job-dashboard"]')).toBeVisible();
    await expect(page.locator('text=Test Video')).toBeVisible();
    await expect(page.locator('text=45%')).toBeVisible();
    await expect(page.locator('text=Translation')).toBeVisible();
  });

  test('should show processing steps visualization', async ({ page }) => {
    await page.click('[data-testid="job-1"]');
    
    await expect(page.locator('[data-testid="processing-steps"]')).toBeVisible();
    await expect(page.locator('text=Audio Extraction')).toBeVisible();
    await expect(page.locator('text=Transcription')).toBeVisible();
    await expect(page.locator('text=Translation')).toBeVisible();
    await expect(page.locator('text=TTS Generation')).toBeVisible();
    await expect(page.locator('text=Audio Assembly')).toBeVisible();
  });

  test('should handle real-time updates via WebSocket', async ({ page }) => {
    // Mock WebSocket connection
    await page.addInitScript(() => {
      class MockWebSocket {
        constructor(url) {
          this.url = url;
          this.readyState = WebSocket.CONNECTING;
          setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            this.onopen?.();
          }, 100);
        }
        
        send(data) {
          // Mock sending data
        }
        
        close() {
          this.readyState = WebSocket.CLOSED;
          this.onclose?.();
        }
        
        // Simulate receiving a message
        simulateMessage(data) {
          this.onmessage?.({ data: JSON.stringify(data) });
        }
      }
      
      window.MockWebSocket = MockWebSocket;
      window.WebSocket = MockWebSocket;
    });

    await page.waitForTimeout(200); // Wait for WebSocket connection
    
    // Simulate job progress update
    await page.evaluate(() => {
      const ws = window.mockWebSocketInstance;
      if (ws) {
        ws.simulateMessage({
          type: 'job_update',
          payload: {
            jobId: 'job-1',
            status: 'processing',
            progress: 75,
            currentStep: 'TTS Generation'
          }
        });
      }
    });

    await expect(page.locator('text=75%')).toBeVisible();
    await expect(page.locator('text=TTS Generation')).toBeVisible();
  });

  test('should allow job cancellation', async ({ page }) => {
    // Mock cancel job API
    await page.route('**/jobs/job-1/cancel', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.click('[data-testid="job-1"] button:has-text("Cancel")');
    
    // Confirm cancellation in dialog
    await expect(page.locator('[data-testid="cancel-dialog"]')).toBeVisible();
    await page.click('button:has-text("Confirm")');
    
    await expect(page.locator('text=Job cancelled')).toBeVisible();
  });

  test('should display job completion and download options', async ({ page }) => {
    // Mock completed job
    await page.route('**/jobs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'job-1',
            title: 'Completed Video',
            status: 'completed',
            progress: 100,
            outputFiles: {
              dubbedAudio: {
                id: 'audio-1',
                filename: 'dubbed.wav',
                downloadUrl: 'https://example.com/dubbed.wav'
              },
              translatedSrt: {
                id: 'srt-1',
                filename: 'translated.srt',
                downloadUrl: 'https://example.com/translated.srt'
              }
            },
            createdAt: '2024-01-01T00:00:00Z'
          }
        ])
      });
    });

    await page.reload();
    
    await expect(page.locator('text=Completed Video')).toBeVisible();
    await expect(page.locator('text=100%')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    
    // Check download buttons
    await expect(page.locator('button:has-text("Download Audio")')).toBeVisible();
    await expect(page.locator('button:has-text("Download Subtitles")')).toBeVisible();
  });

  test('should handle job errors gracefully', async ({ page }) => {
    // Mock failed job
    await page.route('**/jobs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'job-1',
            title: 'Failed Video',
            status: 'failed',
            progress: 30,
            errorMessage: 'Processing failed: Invalid video format',
            createdAt: '2024-01-01T00:00:00Z'
          }
        ])
      });
    });

    await page.reload();
    
    await expect(page.locator('text=Failed Video')).toBeVisible();
    await expect(page.locator('text=Failed')).toBeVisible();
    await expect(page.locator('text=Processing failed: Invalid video format')).toBeVisible();
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
  });

  test('should show job statistics and metrics', async ({ page }) => {
    // Mock job statistics
    await page.route('**/jobs/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalJobs: 15,
          completedJobs: 12,
          failedJobs: 1,
          processingJobs: 2,
          totalProcessingTime: 3600,
          averageProcessingTime: 240
        })
      });
    });

    await expect(page.locator('[data-testid="job-stats"]')).toBeVisible();
    await expect(page.locator('text=15')).toBeVisible(); // Total jobs
    await expect(page.locator('text=12')).toBeVisible(); // Completed jobs
    await expect(page.locator('text=2')).toBeVisible();  // Processing jobs
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    
    await expect(page.locator('[data-testid="mobile-job-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    
    // Check that job cards are properly sized for mobile
    const jobCard = page.locator('[data-testid="job-1"]');
    await expect(jobCard).toBeVisible();
    
    const boundingBox = await jobCard.boundingBox();
    expect(boundingBox?.width).toBeLessThan(375);
  });
});
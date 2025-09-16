/**
 * Test Configuration for DubAI Frontend
 * 
 * Centralized configuration for all testing environments and scenarios
 */

export interface TestConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  coverage: {
    enabled: boolean;
    threshold: number;
  };
  accessibility: {
    enabled: boolean;
    standards: string[];
  };
  visual: {
    enabled: boolean;
    threshold: number;
  };
  e2e: {
    enabled: boolean;
    browsers: string[];
    devices: string[];
  };
}

const environments = {
  development: {
    baseUrl: 'http://localhost:5173',
    timeout: 30000,
    retries: 0,
    parallel: true,
    coverage: {
      enabled: true,
      threshold: 70,
    },
    accessibility: {
      enabled: true,
      standards: ['wcag2a', 'wcag2aa'],
    },
    visual: {
      enabled: true,
      threshold: 0.2,
    },
    e2e: {
      enabled: true,
      browsers: ['chromium'],
      devices: ['Desktop Chrome'],
    },
  },
  ci: {
    baseUrl: 'http://localhost:5173',
    timeout: 60000,
    retries: 2,
    parallel: false,
    coverage: {
      enabled: true,
      threshold: 80,
    },
    accessibility: {
      enabled: true,
      standards: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    },
    visual: {
      enabled: true,
      threshold: 0.1,
    },
    e2e: {
      enabled: true,
      browsers: ['chromium', 'firefox', 'webkit'],
      devices: ['Desktop Chrome', 'Desktop Firefox', 'Desktop Safari', 'iPhone 12', 'Pixel 5'],
    },
  },
  production: {
    baseUrl: 'https://dubai.example.com',
    timeout: 90000,
    retries: 3,
    parallel: false,
    coverage: {
      enabled: false,
      threshold: 85,
    },
    accessibility: {
      enabled: true,
      standards: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    },
    visual: {
      enabled: true,
      threshold: 0.05,
    },
    e2e: {
      enabled: true,
      browsers: ['chromium', 'firefox', 'webkit'],
      devices: ['Desktop Chrome', 'Desktop Firefox', 'Desktop Safari', 'iPhone 12', 'Pixel 5'],
    },
  },
} as const;

export function getTestConfig(env: keyof typeof environments = 'development'): TestConfig {
  return environments[env];
}

export const mockData = {
  users: {
    testUser: {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    },
    adminUser: {
      id: '2',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
    },
  },
  jobs: {
    completedJob: {
      id: 'job-1',
      title: 'Completed Video',
      status: 'completed',
      progress: 100,
      createdAt: '2024-01-01T00:00:00Z',
      outputFiles: {
        dubbedAudio: {
          id: 'audio-1',
          filename: 'dubbed.wav',
          downloadUrl: 'https://example.com/dubbed.wav',
        },
        translatedSrt: {
          id: 'srt-1',
          filename: 'translated.srt',
          downloadUrl: 'https://example.com/translated.srt',
        },
      },
    },
    processingJob: {
      id: 'job-2',
      title: 'Processing Video',
      status: 'processing',
      progress: 65,
      currentStep: 'TTS Generation',
      createdAt: '2024-01-02T00:00:00Z',
      processingSteps: [
        { name: 'Audio Extraction', status: 'completed', progress: 100 },
        { name: 'Transcription', status: 'completed', progress: 100 },
        { name: 'Translation', status: 'completed', progress: 100 },
        { name: 'TTS Generation', status: 'processing', progress: 65 },
        { name: 'Audio Assembly', status: 'pending', progress: 0 },
      ],
    },
    failedJob: {
      id: 'job-3',
      title: 'Failed Video',
      status: 'failed',
      progress: 30,
      errorMessage: 'Processing failed: Invalid video format',
      createdAt: '2024-01-03T00:00:00Z',
    },
  },
  files: {
    videoFile: {
      id: 'file-1',
      filename: 'test.mp4',
      size: 1024000,
      mimeType: 'video/mp4',
      url: 'https://example.com/test.mp4',
    },
    srtFile: {
      id: 'file-2',
      filename: 'test.srt',
      size: 2048,
      mimeType: 'text/plain',
      url: 'https://example.com/test.srt',
    },
  },
};

export const testSelectors = {
  // Authentication
  loginForm: '[data-testid="login-form"]',
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  loginButton: 'button[type="submit"]',
  
  // Dashboard
  dashboard: '[data-testid="job-dashboard"]',
  jobCard: '[data-testid^="job-"]',
  jobStats: '[data-testid="job-stats"]',
  
  // File Upload
  fileUploadZone: '[data-testid="file-upload-zone"]',
  fileInput: 'input[type="file"]',
  uploadProgress: '[data-testid="upload-progress"]',
  
  // Job Processing
  processingSteps: '[data-testid="processing-steps"]',
  cancelButton: 'button:has-text("Cancel")',
  retryButton: 'button:has-text("Retry")',
  downloadButton: 'button:has-text("Download")',
  
  // Navigation
  navbar: '[data-testid="navbar"]',
  mobileMenu: '[data-testid="mobile-menu"]',
  themeToggle: '[data-testid="theme-toggle"]',
  
  // Common
  loadingSpinner: '[data-testid="loading-spinner"]',
  errorMessage: '[data-testid="error-message"]',
  successMessage: '[data-testid="success-message"]',
};

export const apiEndpoints = {
  auth: {
    login: '/auth/signin',
    logout: '/auth/signout',
    user: '/auth/user',
  },
  jobs: {
    list: '/jobs',
    create: '/jobs',
    get: (id: string) => `/jobs/${id}`,
    cancel: (id: string) => `/jobs/${id}/cancel`,
    delete: (id: string) => `/jobs/${id}`,
    stats: '/jobs/stats',
  },
  files: {
    upload: '/files/upload',
    download: (id: string) => `/files/${id}/download`,
  },
};

export const testUtils = {
  /**
   * Wait for element to be visible with timeout
   */
  waitForElement: async (page: any, selector: string, timeout = 5000) => {
    await page.waitForSelector(selector, { state: 'visible', timeout });
  },

  /**
   * Mock API response
   */
  mockApiResponse: async (page: any, endpoint: string, response: any, status = 200) => {
    await page.route(`**${endpoint}`, async (route: any) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  },

  /**
   * Mock authentication
   */
  mockAuth: async (page: any, user = mockData.users.testUser) => {
    await page.route('**/auth/user', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user }),
      });
    });
  },

  /**
   * Create test file
   */
  createTestFile: (name: string, type: string, content = 'test content') => {
    return new File([content], name, { type });
  },

  /**
   * Generate random test data
   */
  generateTestData: {
    email: () => `test-${Date.now()}@example.com`,
    jobTitle: () => `Test Video ${Date.now()}`,
    filename: (ext = 'mp4') => `test-${Date.now()}.${ext}`,
  },
};
import { ConfigurationManagerImpl } from '../services/ConfigurationManager';
import { ApplicationConfig, ConfigurationValidationResult } from '../types/configuration';
import { 
  getConfigurationManager, 
  initializeConfiguration, 
  validateEnvironmentVariables,
  generateEnvironmentTemplate,
  getConfigurationSummary
} from '../utils/configurationUtils';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManagerImpl;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    configManager = new ConfigurationManagerImpl();
    originalEnv = { ...process.env };
    
    // Clear environment variables
    delete process.env['NODE_ENV'];
    delete process.env['PORT'];
    delete process.env['GOOGLE_CLOUD_PROJECT_ID'];
    delete process.env['AB_TESTING_ENABLED'];
    delete process.env['GOOGLE_TTS_WEIGHT'];
    delete process.env['COQUI_TTS_WEIGHT'];
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfiguration', () => {
    it('should load default configuration when no config file is provided', async () => {
      const config = await configManager.loadConfiguration();
      
      expect(config.environment).toBe('development');
      expect(config.port).toBe(3000);
      expect(config.host).toBe('localhost');
      expect(config.ttsServices.abTesting.enabled).toBe(false);
    });

    it('should load configuration from file when provided', async () => {
      const mockConfig = {
        environment: 'staging',
        port: 4000,
        ttsServices: {
          googleCloud: {
            projectId: 'test-project'
          },
          abTesting: {
            enabled: true,
            googleTTSWeight: 70,
            coquiTTSWeight: 30
          }
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = await configManager.loadConfiguration('./test-config.json');
      
      expect(config.environment).toBe('staging');
      expect(config.port).toBe(4000);
      expect(config.ttsServices.abTesting.enabled).toBe(true);
      expect(config.ttsServices.abTesting.googleTTSWeight).toBe(70);
    });

    it('should apply environment variable overrides', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['PORT'] = '8080';
      process.env['AB_TESTING_ENABLED'] = 'true';
      process.env['GOOGLE_TTS_WEIGHT'] = '80';
      process.env['COQUI_TTS_WEIGHT'] = '20';
      process.env['GOOGLE_CLOUD_PROJECT_ID'] = 'test-project'; // Add project ID to avoid validation error

      const config = await configManager.loadConfiguration();
      
      expect(config.environment).toBe('production');
      expect(config.port).toBe(8080);
      expect(config.ttsServices.abTesting.enabled).toBe(true);
      expect(config.ttsServices.abTesting.googleTTSWeight).toBe(80);
      expect(config.ttsServices.abTesting.coquiTTSWeight).toBe(20);
    });

    it('should throw error for invalid configuration', async () => {
      process.env['PORT'] = 'invalid';
      process.env['AB_TESTING_ENABLED'] = 'true';
      process.env['GOOGLE_TTS_WEIGHT'] = '50';
      // This will trigger validation error for missing project ID and invalid port
      
      await expect(configManager.loadConfiguration()).rejects.toThrow('Configuration validation failed');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate valid configuration', () => {
      const validConfig: ApplicationConfig = {
        environment: 'development',
        port: 3000,
        host: 'localhost',
        database: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
          ssl: false,
          connectionTimeout: 30000,
          maxConnections: 10
        },
        ttsServices: {
          googleCloud: {
            projectId: 'test-project',
            quotaLimits: {
              charactersPerMonth: 4000000,
              charactersPerMinute: 1000
            },
            defaultVoiceSettings: {
              languageCode: 'bn-IN',
              voiceName: 'bn-IN-Wavenet-A',
              gender: 'FEMALE',
              speakingRate: 1.0,
              pitch: 0.0,
              volumeGainDb: 0.0
            }
          },
          coquiTTS: {
            modelPath: './models/coqui-bangla',
            cachePath: './cache/coqui',
            maxCacheSize: 1073741824,
            gpuEnabled: false,
            defaultVoiceSettings: {
              languageCode: 'bn',
              voiceName: 'coqui-bangla-female',
              gender: 'FEMALE',
              speakingRate: 1.0,
              pitch: 0.0,
              volumeGainDb: 0.0,
              temperature: 0.7,
              lengthPenalty: 1.0
            }
          },
          abTesting: {
            enabled: true,
            googleTTSWeight: 60,
            coquiTTSWeight: 40,
            sessionDuration: 60,
            minimumSampleSize: 100,
            confidenceLevel: 0.95
          },
          quotaThresholds: {
            googleTTS: 100000,
            warningThreshold: 50000
          },
          fallbackEnabled: true,
          retryAttempts: 3,
          retryDelayMs: 1000
        },
        processing: {
          tempDirectory: './temp',
          maxFileSize: 1073741824,
          supportedVideoFormats: ['mp4', 'avi'],
          supportedAudioFormats: ['mp3', 'wav'],
          maxConcurrentJobs: 3,
          jobTimeoutMs: 3600000
        },
        quality: {
          audioQualityThreshold: 0.8,
          synchronizationToleranceMs: 100,
          minimumConfidenceScore: 0.7,
          enableQualityChecks: true,
          qualityMetricsEnabled: true
        },
        costTracking: {
          enabled: true,
          alertThresholds: {
            dailyCost: 10.0,
            monthlyCost: 100.0,
            perVideoCost: 1.0
          },
          currency: 'USD',
          costPerCharacter: {
            googleTTS: 0.000016,
            computeTime: 0.001
          }
        },
        security: {
          apiKeyEncryption: false,
          fileEncryption: false,
          maxUploadSize: 1073741824,
          allowedOrigins: ['*'],
          rateLimiting: {
            windowMs: 900000,
            maxRequests: 100
          }
        },
        logging: {
          level: 'info',
          enableFileLogging: true,
          logDirectory: './logs',
          maxLogFileSize: 10485760,
          maxLogFiles: 5,
          enableConsoleLogging: true
        }
      };

      const result = configManager.validateConfiguration(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid environment', async () => {
      await configManager.loadConfiguration();
      const baseConfig = configManager.getConfiguration();
      const config = { ...baseConfig, environment: 'invalid' } as unknown as ApplicationConfig;
      
      const result = configManager.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'environment',
          message: 'Environment must be one of: development, staging, production'
        })
      );
    });

    it('should detect invalid port', async () => {
      await configManager.loadConfiguration();
      const baseConfig = configManager.getConfiguration();
      const config = { ...baseConfig, port: 70000 };
      
      const result = configManager.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'port',
          message: 'Port must be between 1 and 65535'
        })
      );
    });

    it('should detect invalid A/B testing weights', async () => {
      await configManager.loadConfiguration();
      const baseConfig = configManager.getConfiguration();
      const config = {
        ...baseConfig,
        ttsServices: {
          ...baseConfig.ttsServices,
          abTesting: {
            ...baseConfig.ttsServices.abTesting,
            enabled: true,
            googleTTSWeight: 60,
            coquiTTSWeight: 50 // Total = 110, should be 100
          }
        }
      };
      
      const result = configManager.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'ttsServices.abTesting',
          message: 'A/B testing weights must sum to 100'
        })
      );
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration successfully', async () => {
      // Set up environment with project ID to avoid validation error
      process.env['GOOGLE_CLOUD_PROJECT_ID'] = 'test-project';
      await configManager.loadConfiguration();
      
      configManager.updateConfiguration({
        port: 4000,
        ttsServices: {
          ...configManager.getConfiguration().ttsServices,
          abTesting: {
            enabled: true,
            googleTTSWeight: 70,
            coquiTTSWeight: 30,
            sessionDuration: 60,
            minimumSampleSize: 100,
            confidenceLevel: 0.95
          }
        }
      });
      
      const config = configManager.getConfiguration();
      expect(config.port).toBe(4000);
      expect(config.ttsServices.abTesting.enabled).toBe(true);
      expect(config.ttsServices.abTesting.googleTTSWeight).toBe(70);
    });

    it('should throw error for invalid update', async () => {
      await configManager.loadConfiguration();
      
      expect(() => {
        configManager.updateConfiguration({
          port: 70000 // Invalid port
        });
      }).toThrow('Configuration update validation failed');
    });
  });

  describe('A/B Testing Configuration', () => {
    it('should update A/B testing configuration', async () => {
      await configManager.loadConfiguration();
      
      configManager.updateABTestingConfig({
        enabled: true,
        googleTTSWeight: 80,
        coquiTTSWeight: 20
      });
      
      const abConfig = configManager.getABTestingConfig();
      expect(abConfig.enabled).toBe(true);
      expect(abConfig.googleTTSWeight).toBe(80);
      expect(abConfig.coquiTTSWeight).toBe(20);
    });

    it('should throw error for invalid A/B testing weights', async () => {
      await configManager.loadConfiguration();
      
      expect(() => {
        configManager.updateABTestingConfig({
          googleTTSWeight: 60,
          coquiTTSWeight: 50 // Total = 110
        });
      }).toThrow('A/B testing weights must sum to 100');
    });
  });

  describe('exportConfiguration', () => {
    it('should export configuration to file', async () => {
      await configManager.loadConfiguration();
      
      const outputPath = './test-export.json';
      await configManager.exportConfiguration(outputPath);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('"environment"'),
        'utf8'
      );
    });
  });
});

describe('Configuration Utils', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateEnvironmentVariables', () => {
    it('should validate required environment variables', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['PORT'] = '3000';
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(true);
      expect(result.missingVars).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      delete process.env['NODE_ENV'];
      delete process.env['PORT'];
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(false);
      expect(result.missingVars).toContain('NODE_ENV');
      expect(result.missingVars).toContain('PORT');
    });

    it('should validate conditional variables', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['PORT'] = '3000';
      process.env['AB_TESTING_ENABLED'] = 'true';
      process.env['GOOGLE_TTS_WEIGHT'] = '50';
      // Missing GOOGLE_CLOUD_PROJECT_ID
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(false);
      expect(result.missingVars).toContain('GOOGLE_CLOUD_PROJECT_ID');
    });
  });

  describe('generateEnvironmentTemplate', () => {
    it('should generate environment template', () => {
      const template = generateEnvironmentTemplate();
      
      expect(template).toContain('NODE_ENV=development');
      expect(template).toContain('PORT=3000');
      expect(template).toContain('GOOGLE_CLOUD_PROJECT_ID=');
      expect(template).toContain('AB_TESTING_ENABLED=false');
    });
  });

  describe('getConfigurationSummary', () => {
    it('should return configuration summary', async () => {
      process.env['NODE_ENV'] = 'development';
      process.env['PORT'] = '3000';
      process.env['AB_TESTING_ENABLED'] = 'false'; // Disable A/B testing to avoid validation issues
      
      await initializeConfiguration();
      const summary = getConfigurationSummary();
      
      expect(summary).toHaveProperty('environment', 'development');
      expect(summary).toHaveProperty('port', 3000);
      expect(summary).toHaveProperty('ttsServices');
      expect(summary).toHaveProperty('processing');
      expect(summary).toHaveProperty('costTracking');
      expect(summary).toHaveProperty('logging');
    });
  });
});

describe('Configuration Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should handle complete configuration lifecycle', async () => {
    // Set up environment
    process.env['NODE_ENV'] = 'staging';
    process.env['PORT'] = '3001';
    process.env['AB_TESTING_ENABLED'] = 'true';
    process.env['GOOGLE_TTS_WEIGHT'] = '70';
    process.env['COQUI_TTS_WEIGHT'] = '30';
    process.env['GOOGLE_CLOUD_PROJECT_ID'] = 'test-project';

    // Mock config file
    const mockConfig = {
      ttsServices: {
        quotaThresholds: {
          googleTTS: 200000
        }
      }
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

    // Initialize configuration
    const config = await initializeConfiguration('./staging.json');

    // Verify merged configuration
    expect(config.environment).toBe('staging');
    expect(config.port).toBe(3001);
    expect(config.ttsServices.abTesting.enabled).toBe(true);
    expect(config.ttsServices.abTesting.googleTTSWeight).toBe(70);
    expect(config.ttsServices.quotaThresholds.googleTTS).toBe(200000);

    // Test configuration updates
    const manager = getConfigurationManager();
    manager.updateABTestingConfig({
      googleTTSWeight: 80,
      coquiTTSWeight: 20
    });

    const updatedConfig = manager.getABTestingConfig();
    expect(updatedConfig.googleTTSWeight).toBe(80);
    expect(updatedConfig.coquiTTSWeight).toBe(20);
  });

  it('should handle configuration validation errors gracefully', async () => {
    process.env['NODE_ENV'] = 'invalid-env';
    process.env['PORT'] = '70000';

    await expect(initializeConfiguration()).rejects.toThrow('Configuration validation failed');
  });
});
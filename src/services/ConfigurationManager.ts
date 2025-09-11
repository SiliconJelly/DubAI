import { 
  ApplicationConfig, 
  ConfigurationValidationResult, 
  ConfigurationError, 
  ConfigurationWarning,
  EnvironmentOverride,
  ConfigurationSource,
  TTSServiceConfig,
  ABTestingConfig,
  GoogleCloudConfig,
  CoquiTTSConfig
} from '../types/configuration';
import * as fs from 'fs';
import * as path from 'path';

export interface ConfigurationManager {
  loadConfiguration(configPath?: string): Promise<ApplicationConfig>;
  validateConfiguration(config: ApplicationConfig): ConfigurationValidationResult;
  getConfiguration(): ApplicationConfig;
  updateConfiguration(updates: Partial<ApplicationConfig>): void;
  getTTSServiceConfig(): TTSServiceConfig;
  getABTestingConfig(): ABTestingConfig;
  updateABTestingConfig(config: Partial<ABTestingConfig>): void;
  updateTTSServiceConfig(config: Partial<TTSServiceConfig>): void;
  getEnvironmentOverrides(): EnvironmentOverride[];
  reloadConfiguration(): Promise<void>;
  exportConfiguration(outputPath: string): Promise<void>;
}

export class ConfigurationManagerImpl implements ConfigurationManager {
  private config: ApplicationConfig;
  private configPath?: string | undefined;
  private environmentOverrides: EnvironmentOverride[] = [];

  constructor() {
    this.config = this.getDefaultConfiguration();
  }

  async loadConfiguration(configPath?: string): Promise<ApplicationConfig> {
    this.configPath = configPath;
    
    // Start with default configuration
    let config = this.getDefaultConfiguration();
    
    // Load from config file if provided
    if (configPath && fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        config = this.mergeConfigurations(config, fileConfig, ConfigurationSource.CONFIG_FILE);
      } catch (error) {
        console.warn(`Failed to load configuration from ${configPath}:`, error);
      }
    }
    
    // Apply environment overrides
    config = this.applyEnvironmentOverrides(config);
    
    // Validate the final configuration
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }
    
    // Log warnings
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        console.warn(`Configuration warning - ${warning.field}: ${warning.message}`);
        if (warning.recommendation) {
          console.warn(`Recommendation: ${warning.recommendation}`);
        }
      });
    }
    
    this.config = config;
    return config;
  }

  validateConfiguration(config: ApplicationConfig): ConfigurationValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationWarning[] = [];

    // Validate environment
    if (!['development', 'staging', 'production'].includes(config.environment)) {
      errors.push({
        field: 'environment',
        message: 'Environment must be one of: development, staging, production',
        severity: 'error'
      });
    }

    // Validate port
    const port = typeof config.port === 'string' ? parseInt(config.port) : config.port;
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push({
        field: 'port',
        message: 'Port must be between 1 and 65535',
        severity: 'error'
      });
    }

    // Validate TTS service configuration
    this.validateTTSServiceConfig(config.ttsServices, errors, warnings);
    
    // Validate processing configuration
    this.validateProcessingConfig(config.processing, errors, warnings);
    
    // Validate A/B testing configuration
    this.validateABTestingConfig(config.ttsServices.abTesting, errors, warnings);

    // Validate cost tracking
    if (config.costTracking.enabled) {
      if (config.costTracking.alertThresholds.dailyCost <= 0) {
        warnings.push({
          field: 'costTracking.alertThresholds.dailyCost',
          message: 'Daily cost threshold should be greater than 0',
          recommendation: 'Set a reasonable daily cost limit'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getConfiguration(): ApplicationConfig {
    return { ...this.config };
  }

  updateConfiguration(updates: Partial<ApplicationConfig>): void {
    this.config = this.mergeConfigurations(this.config, updates, ConfigurationSource.RUNTIME);
    
    // Validate after update
    const validation = this.validateConfiguration(this.config);
    if (!validation.isValid) {
      throw new Error(`Configuration update validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }
  }

  getTTSServiceConfig(): TTSServiceConfig {
    return { ...this.config.ttsServices };
  }

  getABTestingConfig(): ABTestingConfig {
    return { ...this.config.ttsServices.abTesting };
  }

  updateABTestingConfig(config: Partial<ABTestingConfig>): void {
    this.config.ttsServices.abTesting = {
      ...this.config.ttsServices.abTesting,
      ...config
    };
    
    // Validate weights sum to 100
    const totalWeight = this.config.ttsServices.abTesting.googleTTSWeight + 
                       this.config.ttsServices.abTesting.coquiTTSWeight;
    
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('A/B testing weights must sum to 100');
    }
  }

  updateTTSServiceConfig(config: Partial<TTSServiceConfig>): void {
    this.config.ttsServices = {
      ...this.config.ttsServices,
      ...config
    };
  }

  getEnvironmentOverrides(): EnvironmentOverride[] {
    return [...this.environmentOverrides];
  }

  async reloadConfiguration(): Promise<void> {
    if (this.configPath) {
      await this.loadConfiguration(this.configPath);
    } else {
      // Reload from environment only
      this.config = this.applyEnvironmentOverrides(this.getDefaultConfiguration());
    }
  }

  async exportConfiguration(outputPath: string): Promise<void> {
    try {
      const configJson = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(outputPath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to export configuration to ${outputPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getDefaultConfiguration(): ApplicationConfig {
    const getEnv = (key: string, defaultValue?: string): string => {
      return process.env[key] || defaultValue || '';
    };

    return {
      environment: (getEnv('NODE_ENV', 'development') as any),
      port: parseInt(getEnv('PORT', '3000')),
      host: getEnv('HOST', 'localhost'),
      database: {
        host: getEnv('DB_HOST', 'localhost'),
        port: parseInt(getEnv('DB_PORT', '5432')),
        database: getEnv('DB_NAME', 'dubbing_workflow'),
        username: getEnv('DB_USER', 'postgres'),
        password: getEnv('DB_PASSWORD', ''),
        ssl: getEnv('DB_SSL') === 'true',
        connectionTimeout: 30000,
        maxConnections: 10
      },
      ttsServices: {
        googleCloud: {
          projectId: getEnv('GOOGLE_CLOUD_PROJECT_ID', ''),
          keyFilename: getEnv('GOOGLE_CLOUD_KEY_FILE') || undefined,
          quotaLimits: {
            charactersPerMonth: 4000000, // Free tier limit
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
          modelPath: getEnv('COQUI_MODEL_PATH', './models/coqui-bangla'),
          cachePath: getEnv('COQUI_CACHE_PATH', './cache/coqui'),
          maxCacheSize: 1024 * 1024 * 1024, // 1GB
          gpuEnabled: getEnv('COQUI_GPU_ENABLED') === 'true',
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
          enabled: getEnv('AB_TESTING_ENABLED') === 'true',
          googleTTSWeight: parseFloat(getEnv('GOOGLE_TTS_WEIGHT', '50')),
          coquiTTSWeight: parseFloat(getEnv('COQUI_TTS_WEIGHT', '50')),
          sessionDuration: 60, // 60 minutes
          minimumSampleSize: 100,
          confidenceLevel: 0.95
        },
        quotaThresholds: {
          googleTTS: parseInt(getEnv('GOOGLE_TTS_QUOTA_THRESHOLD', '100000')),
          warningThreshold: parseInt(getEnv('QUOTA_WARNING_THRESHOLD', '50000'))
        },
        fallbackEnabled: getEnv('TTS_FALLBACK_ENABLED') !== 'false',
        retryAttempts: parseInt(getEnv('TTS_RETRY_ATTEMPTS', '3')),
        retryDelayMs: parseInt(getEnv('TTS_RETRY_DELAY_MS', '1000'))
      },
      processing: {
        tempDirectory: getEnv('TEMP_DIR', './temp'),
        maxFileSize: parseInt(getEnv('MAX_FILE_SIZE', '1073741824')), // 1GB
        supportedVideoFormats: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
        supportedAudioFormats: ['mp3', 'wav', 'aac', 'flac'],
        ffmpegPath: getEnv('FFMPEG_PATH') || undefined,
        whisperModelPath: getEnv('WHISPER_MODEL_PATH') || undefined,
        maxConcurrentJobs: parseInt(getEnv('MAX_CONCURRENT_JOBS', '3')),
        jobTimeoutMs: parseInt(getEnv('JOB_TIMEOUT_MS', '3600000')) // 1 hour
      },
      quality: {
        audioQualityThreshold: parseFloat(getEnv('AUDIO_QUALITY_THRESHOLD', '0.8')),
        synchronizationToleranceMs: parseInt(getEnv('SYNC_TOLERANCE_MS', '100')),
        minimumConfidenceScore: parseFloat(getEnv('MIN_CONFIDENCE_SCORE', '0.7')),
        enableQualityChecks: getEnv('ENABLE_QUALITY_CHECKS') !== 'false',
        qualityMetricsEnabled: getEnv('QUALITY_METRICS_ENABLED') !== 'false'
      },
      costTracking: {
        enabled: getEnv('COST_TRACKING_ENABLED') !== 'false',
        alertThresholds: {
          dailyCost: parseFloat(getEnv('DAILY_COST_THRESHOLD', '10.0')),
          monthlyCost: parseFloat(getEnv('MONTHLY_COST_THRESHOLD', '100.0')),
          perVideoCost: parseFloat(getEnv('PER_VIDEO_COST_THRESHOLD', '1.0'))
        },
        currency: getEnv('CURRENCY', 'USD'),
        costPerCharacter: {
          googleTTS: parseFloat(getEnv('GOOGLE_TTS_COST_PER_CHAR', '0.000016')),
          computeTime: parseFloat(getEnv('COMPUTE_COST_PER_SECOND', '0.001'))
        }
      },
      security: {
        apiKeyEncryption: getEnv('API_KEY_ENCRYPTION') === 'true',
        fileEncryption: getEnv('FILE_ENCRYPTION') === 'true',
        maxUploadSize: parseInt(getEnv('MAX_UPLOAD_SIZE', '1073741824')), // 1GB
        allowedOrigins: getEnv('ALLOWED_ORIGINS')?.split(',') || ['*'],
        rateLimiting: {
          windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000')), // 15 minutes
          maxRequests: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '100'))
        }
      },
      logging: {
        level: (getEnv('LOG_LEVEL', 'info') as any),
        enableFileLogging: getEnv('ENABLE_FILE_LOGGING') !== 'false',
        logDirectory: getEnv('LOG_DIR', './logs'),
        maxLogFileSize: parseInt(getEnv('MAX_LOG_FILE_SIZE', '10485760')), // 10MB
        maxLogFiles: parseInt(getEnv('MAX_LOG_FILES', '5')),
        enableConsoleLogging: getEnv('ENABLE_CONSOLE_LOGGING') !== 'false'
      }
    };
  }

  private mergeConfigurations(base: ApplicationConfig, override: any, source: ConfigurationSource): ApplicationConfig {
    const merged = JSON.parse(JSON.stringify(base)); // Deep clone
    
    // Deep merge logic
    this.deepMerge(merged, override);
    
    return merged;
  }

  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  private applyEnvironmentOverrides(config: ApplicationConfig): ApplicationConfig {
    this.environmentOverrides = [];
    
    // Apply environment variable overrides
    const envMappings = this.getEnvironmentMappings();
    
    for (const [envVar, configPath] of envMappings) {
      const envValue = process.env[envVar];
      if (envValue !== undefined) {
        this.setNestedProperty(config, configPath, this.parseEnvironmentValue(envValue));
        this.environmentOverrides.push({
          path: configPath,
          value: envValue,
          source: 'env'
        });
      }
    }
    
    return config;
  }

  private getEnvironmentMappings(): Map<string, string> {
    return new Map([
      ['NODE_ENV', 'environment'],
      ['PORT', 'port'],
      ['HOST', 'host'],
      ['DB_HOST', 'database.host'],
      ['DB_PORT', 'database.port'],
      ['DB_NAME', 'database.database'],
      ['DB_USER', 'database.username'],
      ['DB_PASSWORD', 'database.password'],
      ['GOOGLE_CLOUD_PROJECT_ID', 'ttsServices.googleCloud.projectId'],
      ['GOOGLE_CLOUD_KEY_FILE', 'ttsServices.googleCloud.keyFilename'],
      ['COQUI_MODEL_PATH', 'ttsServices.coquiTTS.modelPath'],
      ['AB_TESTING_ENABLED', 'ttsServices.abTesting.enabled'],
      ['GOOGLE_TTS_WEIGHT', 'ttsServices.abTesting.googleTTSWeight'],
      ['COQUI_TTS_WEIGHT', 'ttsServices.abTesting.coquiTTSWeight'],
      ['TEMP_DIR', 'processing.tempDirectory'],
      ['MAX_FILE_SIZE', 'processing.maxFileSize'],
      ['COST_TRACKING_ENABLED', 'costTracking.enabled'],
      ['LOG_LEVEL', 'logging.level']
    ]);
  }

  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  private parseEnvironmentValue(value: string): any {
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Try to parse as number
    const numValue = Number(value);
    if (!isNaN(numValue)) return numValue;
    
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Return as string
      return value;
    }
  }

  private validateTTSServiceConfig(config: TTSServiceConfig, errors: ConfigurationError[], warnings: ConfigurationWarning[]): void {
    // Validate Google Cloud TTS config
    if (config.googleCloud && config.abTesting && 
        !config.googleCloud.projectId && config.abTesting.enabled && config.abTesting.googleTTSWeight > 0) {
      errors.push({
        field: 'ttsServices.googleCloud.projectId',
        message: 'Google Cloud Project ID is required when Google TTS is enabled',
        severity: 'error'
      });
    }

    // Validate Coqui TTS config
    if (config.coquiTTS && !config.coquiTTS.modelPath) {
      warnings.push({
        field: 'ttsServices.coquiTTS.modelPath',
        message: 'Coqui TTS model path not specified',
        recommendation: 'Set COQUI_MODEL_PATH environment variable or provide in config file'
      });
    }

    // Validate quota thresholds
    if (config.quotaThresholds && config.googleCloud && 
        config.quotaThresholds.googleTTS > config.googleCloud.quotaLimits.charactersPerMonth) {
      warnings.push({
        field: 'ttsServices.quotaThresholds.googleTTS',
        message: 'Google TTS quota threshold exceeds monthly limit',
        recommendation: 'Reduce threshold or increase quota limit'
      });
    }
  }

  private validateProcessingConfig(config: any, errors: ConfigurationError[], warnings: ConfigurationWarning[]): void {
    if (config.maxConcurrentJobs < 1) {
      errors.push({
        field: 'processing.maxConcurrentJobs',
        message: 'Maximum concurrent jobs must be at least 1',
        severity: 'error'
      });
    }

    if (config.maxFileSize < 1024 * 1024) { // 1MB minimum
      warnings.push({
        field: 'processing.maxFileSize',
        message: 'Maximum file size is very small',
        recommendation: 'Consider increasing to at least 100MB for video files'
      });
    }
  }

  private validateABTestingConfig(config: ABTestingConfig, errors: ConfigurationError[], warnings: ConfigurationWarning[]): void {
    if (!config) return;
    
    const totalWeight = config.googleTTSWeight + config.coquiTTSWeight;
    
    if (Math.abs(totalWeight - 100) > 0.01) {
      errors.push({
        field: 'ttsServices.abTesting',
        message: 'A/B testing weights must sum to 100',
        severity: 'error'
      });
    }

    if (config.enabled && config.minimumSampleSize < 10) {
      warnings.push({
        field: 'ttsServices.abTesting.minimumSampleSize',
        message: 'Minimum sample size is very low for reliable A/B testing',
        recommendation: 'Consider increasing to at least 100 samples'
      });
    }
  }
}
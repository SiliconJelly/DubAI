import { ConfigurationManagerImpl } from '../services/ConfigurationManager';
import { ApplicationConfig } from '../types/configuration';
import * as path from 'path';

// Singleton instance of configuration manager
let configurationManager: ConfigurationManagerImpl | null = null;

/**
 * Get the singleton instance of ConfigurationManager
 */
export function getConfigurationManager(): ConfigurationManagerImpl {
  if (!configurationManager) {
    configurationManager = new ConfigurationManagerImpl();
  }
  return configurationManager;
}

/**
 * Initialize configuration from file or environment
 */
export async function initializeConfiguration(configPath?: string): Promise<ApplicationConfig> {
  const manager = getConfigurationManager();
  
  // Determine config path based on environment if not provided
  if (!configPath) {
    const environment = process.env['NODE_ENV'] || 'development';
    configPath = path.join(process.cwd(), 'config', `${environment}.json`);
    
    // Fallback to default.json if environment-specific config doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'config', 'default.json');
    }
  }
  
  return await manager.loadConfiguration(configPath);
}

/**
 * Get current configuration
 */
export function getConfiguration(): ApplicationConfig {
  return getConfigurationManager().getConfiguration();
}

/**
 * Get TTS service configuration
 */
export function getTTSServiceConfig() {
  return getConfigurationManager().getTTSServiceConfig();
}

/**
 * Get A/B testing configuration
 */
export function getABTestingConfig() {
  return getConfigurationManager().getABTestingConfig();
}

/**
 * Update A/B testing configuration
 */
export function updateABTestingConfig(config: any) {
  return getConfigurationManager().updateABTestingConfig(config);
}

/**
 * Validate environment variables for required configuration
 */
export function validateEnvironmentVariables(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    'NODE_ENV',
    'PORT'
  ];
  
  const conditionalVars = [
    { var: 'GOOGLE_CLOUD_PROJECT_ID', condition: () => process.env['AB_TESTING_ENABLED'] === 'true' && parseFloat(process.env['GOOGLE_TTS_WEIGHT'] || '0') > 0 },
    { var: 'COQUI_MODEL_PATH', condition: () => parseFloat(process.env['COQUI_TTS_WEIGHT'] || '0') > 0 }
  ];
  
  const missingVars: string[] = [];
  
  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  // Check conditional variables
  for (const { var: varName, condition } of conditionalVars) {
    if (condition() && !process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  return {
    isValid: missingVars.length === 0,
    missingVars
  };
}

/**
 * Create environment template file
 */
export function generateEnvironmentTemplate(): string {
  return `# Automated Dubbing Workflow Configuration
# Copy this file to .env and fill in the values

# Application Settings
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dubbing_workflow
DB_USER=postgres
DB_PASSWORD=
DB_SSL=false

# Google Cloud TTS Configuration
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_KEY_FILE=

# Coqui TTS Configuration
COQUI_MODEL_PATH=./models/coqui-bangla
COQUI_CACHE_PATH=./cache/coqui
COQUI_GPU_ENABLED=false

# A/B Testing Configuration
AB_TESTING_ENABLED=false
GOOGLE_TTS_WEIGHT=50
COQUI_TTS_WEIGHT=50

# Processing Configuration
TEMP_DIR=./temp
MAX_FILE_SIZE=1073741824
MAX_CONCURRENT_JOBS=3
JOB_TIMEOUT_MS=3600000

# Quality Configuration
AUDIO_QUALITY_THRESHOLD=0.8
SYNC_TOLERANCE_MS=100
MIN_CONFIDENCE_SCORE=0.7
ENABLE_QUALITY_CHECKS=true

# Cost Tracking Configuration
COST_TRACKING_ENABLED=true
DAILY_COST_THRESHOLD=10.0
MONTHLY_COST_THRESHOLD=100.0
PER_VIDEO_COST_THRESHOLD=1.0
CURRENCY=USD

# Security Configuration
API_KEY_ENCRYPTION=false
FILE_ENCRYPTION=false
MAX_UPLOAD_SIZE=1073741824
ALLOWED_ORIGINS=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
ENABLE_FILE_LOGGING=true
LOG_DIR=./logs
MAX_LOG_FILE_SIZE=10485760
MAX_LOG_FILES=5
ENABLE_CONSOLE_LOGGING=true

# External Tool Paths (optional)
FFMPEG_PATH=
WHISPER_MODEL_PATH=

# TTS Service Configuration
GOOGLE_TTS_QUOTA_THRESHOLD=100000
QUOTA_WARNING_THRESHOLD=50000
TTS_FALLBACK_ENABLED=true
TTS_RETRY_ATTEMPTS=3
TTS_RETRY_DELAY_MS=1000

# Google TTS Pricing (per character)
GOOGLE_TTS_COST_PER_CHAR=0.000016
COMPUTE_COST_PER_SECOND=0.001
`;
}

/**
 * Get configuration summary for debugging
 */
export function getConfigurationSummary(): any {
  const config = getConfiguration();
  
  return {
    environment: config.environment,
    port: config.port,
    host: config.host,
    ttsServices: {
      abTestingEnabled: config.ttsServices.abTesting.enabled,
      googleTTSWeight: config.ttsServices.abTesting.googleTTSWeight,
      coquiTTSWeight: config.ttsServices.abTesting.coquiTTSWeight,
      fallbackEnabled: config.ttsServices.fallbackEnabled
    },
    processing: {
      maxConcurrentJobs: config.processing.maxConcurrentJobs,
      tempDirectory: config.processing.tempDirectory
    },
    costTracking: {
      enabled: config.costTracking.enabled,
      currency: config.costTracking.currency
    },
    logging: {
      level: config.logging.level,
      fileLogging: config.logging.enableFileLogging
    }
  };
}
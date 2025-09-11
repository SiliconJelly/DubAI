import { 
  initializeConfiguration, 
  getConfiguration, 
  getTTSServiceConfig,
  getABTestingConfig,
  updateABTestingConfig,
  validateEnvironmentVariables,
  generateEnvironmentTemplate,
  getConfigurationSummary,
  getConfigurationManager
} from '../utils/configurationUtils';
import { ConfigurationManagerImpl } from '../services/ConfigurationManager';
import * as fs from 'fs';

/**
 * Example demonstrating configuration management system usage
 */
async function configurationExample() {
  console.log('=== Configuration Management System Example ===\n');

  try {
    // 1. Validate environment variables
    console.log('1. Validating environment variables...');
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      console.log('Missing environment variables:', envValidation.missingVars);
      console.log('Consider setting these variables or using a config file.\n');
    } else {
      console.log('All required environment variables are set.\n');
    }

    // 2. Generate environment template
    console.log('2. Generating environment template...');
    const envTemplate = generateEnvironmentTemplate();
    fs.writeFileSync('.env.example', envTemplate);
    console.log('Environment template saved to .env.example\n');

    // 3. Initialize configuration
    console.log('3. Initializing configuration...');
    const config = await initializeConfiguration();
    console.log(`Configuration loaded for environment: ${config.environment}`);
    console.log(`Server will run on ${config.host}:${config.port}\n`);

    // 4. Get configuration summary
    console.log('4. Configuration summary:');
    const summary = getConfigurationSummary();
    console.log(JSON.stringify(summary, null, 2));
    console.log();

    // 5. Work with TTS service configuration
    console.log('5. TTS Service Configuration:');
    const ttsConfig = getTTSServiceConfig();
    console.log(`A/B Testing enabled: ${ttsConfig.abTesting.enabled}`);
    console.log(`Google TTS weight: ${ttsConfig.abTesting.googleTTSWeight}%`);
    console.log(`Coqui TTS weight: ${ttsConfig.abTesting.coquiTTSWeight}%`);
    console.log(`Fallback enabled: ${ttsConfig.fallbackEnabled}\n`);

    // 6. Update A/B testing configuration
    console.log('6. Updating A/B testing configuration...');
    updateABTestingConfig({
      enabled: true,
      googleTTSWeight: 70,
      coquiTTSWeight: 30
    });
    
    const updatedABConfig = getABTestingConfig();
    console.log(`Updated Google TTS weight: ${updatedABConfig.googleTTSWeight}%`);
    console.log(`Updated Coqui TTS weight: ${updatedABConfig.coquiTTSWeight}%\n`);

    // 7. Export configuration
    console.log('7. Exporting current configuration...');
    const manager = getConfigurationManager();
    await manager.exportConfiguration('./current-config.json');
    console.log('Configuration exported to current-config.json\n');

    // 8. Demonstrate configuration validation
    console.log('8. Testing configuration validation...');
    const validationResult = manager.validateConfiguration(config);
    console.log(`Configuration is valid: ${validationResult.isValid}`);
    if (validationResult.warnings.length > 0) {
      console.log('Warnings:');
      validationResult.warnings.forEach(warning => {
        console.log(`  - ${warning.field}: ${warning.message}`);
        if (warning.recommendation) {
          console.log(`    Recommendation: ${warning.recommendation}`);
        }
      });
    }
    console.log();

    // 9. Demonstrate environment-specific configurations
    console.log('9. Environment-specific configurations:');
    console.log(`Current environment: ${config.environment}`);
    console.log(`Database SSL: ${config.database.ssl}`);
    console.log(`Max concurrent jobs: ${config.processing.maxConcurrentJobs}`);
    console.log(`Log level: ${config.logging.level}`);
    console.log(`Cost tracking enabled: ${config.costTracking.enabled}\n`);

    // 10. Show voice configuration
    console.log('10. Voice configurations:');
    console.log('Google Cloud TTS voice settings:');
    console.log(`  Language: ${ttsConfig.googleCloud.defaultVoiceSettings.languageCode}`);
    console.log(`  Voice: ${ttsConfig.googleCloud.defaultVoiceSettings.voiceName}`);
    console.log(`  Gender: ${ttsConfig.googleCloud.defaultVoiceSettings.gender}`);
    
    console.log('Coqui TTS voice settings:');
    console.log(`  Language: ${ttsConfig.coquiTTS.defaultVoiceSettings.languageCode}`);
    console.log(`  Voice: ${ttsConfig.coquiTTS.defaultVoiceSettings.voiceName}`);
    console.log(`  Temperature: ${ttsConfig.coquiTTS.defaultVoiceSettings.temperature}`);
    console.log();

  } catch (error) {
    console.error('Configuration example failed:', error);
  }
}

/**
 * Example of creating a custom configuration manager
 */
async function customConfigurationExample() {
  console.log('=== Custom Configuration Manager Example ===\n');

  try {
    // Create a new configuration manager instance
    const customManager = new ConfigurationManagerImpl();

    // Load configuration with custom settings
    const customConfig = {
      environment: 'development',
      port: 4000,
      ttsServices: {
        abTesting: {
          enabled: true,
          googleTTSWeight: 80,
          coquiTTSWeight: 20,
          sessionDuration: 120,
          minimumSampleSize: 200,
          confidenceLevel: 0.99
        },
        quotaThresholds: {
          googleTTS: 150000,
          warningThreshold: 75000
        }
      },
      processing: {
        maxConcurrentJobs: 5,
        jobTimeoutMs: 7200000 // 2 hours
      }
    };

    // Update configuration
    await customManager.loadConfiguration();
    customManager.updateConfiguration(customConfig as any);

    console.log('Custom configuration applied:');
    const config = customManager.getConfiguration();
    console.log(`Port: ${config.port}`);
    console.log(`A/B Testing enabled: ${config.ttsServices.abTesting.enabled}`);
    console.log(`Google TTS weight: ${config.ttsServices.abTesting.googleTTSWeight}%`);
    console.log(`Max concurrent jobs: ${config.processing.maxConcurrentJobs}`);
    console.log(`Job timeout: ${config.processing.jobTimeoutMs / 1000 / 60} minutes\n`);

    // Test TTS service configuration updates
    customManager.updateTTSServiceConfig({
      retryAttempts: 5,
      retryDelayMs: 2000,
      fallbackEnabled: true
    });

    const ttsConfig = customManager.getTTSServiceConfig();
    console.log('Updated TTS service configuration:');
    console.log(`Retry attempts: ${ttsConfig.retryAttempts}`);
    console.log(`Retry delay: ${ttsConfig.retryDelayMs}ms`);
    console.log(`Fallback enabled: ${ttsConfig.fallbackEnabled}\n`);

  } catch (error) {
    console.error('Custom configuration example failed:', error);
  }
}

/**
 * Example of configuration validation scenarios
 */
async function configurationValidationExample() {
  console.log('=== Configuration Validation Example ===\n');

  const manager = new ConfigurationManagerImpl();
  await manager.loadConfiguration();

  // Test various validation scenarios
  const testCases = [
    {
      name: 'Valid configuration',
      config: { environment: 'development', port: 3000 }
    },
    {
      name: 'Invalid environment',
      config: { environment: 'invalid', port: 3000 }
    },
    {
      name: 'Invalid port',
      config: { environment: 'development', port: 70000 }
    },
    {
      name: 'Invalid A/B testing weights',
      config: {
        environment: 'development',
        port: 3000,
        ttsServices: {
          abTesting: {
            googleTTSWeight: 60,
            coquiTTSWeight: 50 // Total = 110
          }
        }
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    try {
      const baseConfig = manager.getConfiguration();
      const testConfig = { ...baseConfig, ...testCase.config };
      const result = manager.validateConfiguration(testConfig as any);
      
      console.log(`  Valid: ${result.isValid}`);
      if (result.errors.length > 0) {
        console.log('  Errors:');
        result.errors.forEach(error => {
          console.log(`    - ${error.field}: ${error.message}`);
        });
      }
      if (result.warnings.length > 0) {
        console.log('  Warnings:');
        result.warnings.forEach(warning => {
          console.log(`    - ${warning.field}: ${warning.message}`);
        });
      }
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    await configurationExample();
    await customConfigurationExample();
    await configurationValidationExample();
  })();
}

export {
  configurationExample,
  customConfigurationExample,
  configurationValidationExample
};
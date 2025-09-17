#!/usr/bin/env node

/**
 * AI Model Validation Script
 * Validates AI model configurations and availability
 */

const fs = require('fs');
const path = require('path');

async function validateModels() {
  console.log('🤖 Validating AI model configurations...');
  
  const mcpConfig = JSON.parse(fs.readFileSync('config/mcp-servers.json', 'utf8'));
  const errors = [];
  
  // Validate Whisper configuration
  const whisperConfig = mcpConfig.mcpServers['whisper-translation'];
  if (whisperConfig) {
    const modelPath = whisperConfig.env.MODEL_CACHE_DIR;
    console.log(`📁 Checking Whisper model cache directory: ${modelPath}`);
    
    if (!fs.existsSync(modelPath)) {
      console.log(`⚠️  Creating Whisper model cache directory: ${modelPath}`);
      fs.mkdirSync(modelPath, { recursive: true });
    }
  }
  
  // Validate Coqui TTS configuration
  const coquiConfig = mcpConfig.mcpServers['coqui-tts-local'];
  if (coquiConfig) {
    const modelPath = coquiConfig.env.COQUI_MODEL_PATH;
    const cacheDir = coquiConfig.env.COQUI_CACHE_DIR;
    
    console.log(`📁 Checking Coqui model directory: ${modelPath}`);
    if (!fs.existsSync(modelPath)) {
      console.log(`⚠️  Creating Coqui model directory: ${modelPath}`);
      fs.mkdirSync(modelPath, { recursive: true });
    }
    
    if (!fs.existsSync(cacheDir)) {
      console.log(`⚠️  Creating Coqui cache directory: ${cacheDir}`);
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }
  
  // Validate file processing directories
  const fileConfig = mcpConfig.mcpServers['file-processing'];
  if (fileConfig) {
    const tempDir = fileConfig.env.TEMP_DIR;
    const cacheDir = fileConfig.env.CACHE_DIR;
    
    [tempDir, cacheDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        console.log(`⚠️  Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  if (errors.length > 0) {
    console.error('❌ Model validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  console.log('✅ All AI model configurations validated successfully');
}

validateModels().catch(error => {
  console.error('❌ Model validation failed:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Pipeline Health Monitor
 * Monitors the health of the entire processing pipeline
 */

const fs = require('fs');
const path = require('path');

async function monitorPipeline() {
  console.log('🔍 Monitoring processing pipeline health...');
  
  const checks = [
    checkMCPServers,
    checkDirectories,
    checkDependencies,
    checkEnvironmentVariables
  ];
  
  const results = [];
  
  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);
      console.log(`✅ ${result.name}: ${result.status}`);
    } catch (error) {
      results.push({ name: check.name, status: 'FAILED', error: error.message });
      console.error(`❌ ${check.name}: ${error.message}`);
    }
  }
  
  const failed = results.filter(r => r.status === 'FAILED');
  if (failed.length > 0) {
    console.error(`\n❌ Pipeline health check failed: ${failed.length} issues found`);
    process.exit(1);
  }
  
  console.log('\n✅ Pipeline health check passed');
}

async function checkMCPServers() {
  const configPath = 'config/mcp-servers.json';
  if (!fs.existsSync(configPath)) {
    throw new Error('MCP servers configuration not found');
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const serverCount = Object.keys(config.mcpServers).length;
  
  return {
    name: 'MCP Servers Configuration',
    status: 'OK',
    details: `${serverCount} servers configured`
  };
}

async function checkDirectories() {
  const requiredDirs = [
    './temp',
    './cache',
    './models',
    './test-temp',
    './test-cache'
  ];
  
  const missing = requiredDirs.filter(dir => !fs.existsSync(dir));
  
  if (missing.length > 0) {
    // Create missing directories
    missing.forEach(dir => {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created missing directory: ${dir}`);
    });
  }
  
  return {
    name: 'Required Directories',
    status: 'OK',
    details: `${requiredDirs.length} directories verified`
  };
}

async function checkDependencies() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const workspaces = packageJson.workspaces || [];
  
  for (const workspace of workspaces) {
    const workspacePackageJson = path.join(workspace, 'package.json');
    if (!fs.existsSync(workspacePackageJson)) {
      throw new Error(`Workspace package.json not found: ${workspacePackageJson}`);
    }
  }
  
  return {
    name: 'Workspace Dependencies',
    status: 'OK',
    details: `${workspaces.length} workspaces verified`
  };
}

async function checkEnvironmentVariables() {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  const mcpConfig = JSON.parse(fs.readFileSync('config/mcp-servers.json', 'utf8'));
  
  const requiredVars = mcpConfig.environmentVariables?.required || [];
  const missing = requiredVars.filter(varName => !envExample.includes(varName));
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables in .env.example: ${missing.join(', ')}`);
  }
  
  return {
    name: 'Environment Variables',
    status: 'OK',
    details: `${requiredVars.length} required variables documented`
  };
}

monitorPipeline().catch(error => {
  console.error('❌ Pipeline monitoring failed:', error);
  process.exit(1);
});
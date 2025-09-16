#!/usr/bin/env node

/**
 * Comprehensive Test Runner for DubAI Frontend
 * 
 * This script orchestrates all testing phases:
 * 1. Unit Tests (React Testing Library + Vitest)
 * 2. Integration Tests
 * 3. End-to-End Tests (Playwright)
 * 4. Accessibility Tests
 * 5. Visual Regression Tests
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  command: string;
  description: string;
  required: boolean;
}

const testSuites: TestSuite[] = [
  {
    name: 'unit',
    command: 'npm run test:run',
    description: 'Unit tests with React Testing Library',
    required: true,
  },
  {
    name: 'integration',
    command: 'npm run test:integration',
    description: 'Integration tests for file upload and job management',
    required: true,
  },
  {
    name: 'accessibility',
    command: 'npm run test:accessibility',
    description: 'Accessibility compliance tests',
    required: true,
  },
  {
    name: 'e2e',
    command: 'npm run test:e2e',
    description: 'End-to-end tests with Playwright',
    required: false, // Optional as it requires running server
  },
  {
    name: 'visual',
    command: 'npm run test:visual',
    description: 'Visual regression tests',
    required: false, // Optional as it requires baseline images
  },
];

class TestRunner {
  private results: Map<string, { success: boolean; error?: string }> = new Map();
  private startTime: number = Date.now();

  async runAllTests(suites: string[] = []): Promise<void> {
    console.log('🚀 Starting DubAI Frontend Test Suite\n');

    const suitesToRun = suites.length > 0 
      ? testSuites.filter(suite => suites.includes(suite.name))
      : testSuites;

    for (const suite of suitesToRun) {
      await this.runTestSuite(suite);
    }

    this.printSummary();
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`📋 Running ${suite.name} tests: ${suite.description}`);
    console.log(`   Command: ${suite.command}\n`);

    try {
      const startTime = Date.now();
      
      execSync(suite.command, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      const duration = Date.now() - startTime;
      console.log(`✅ ${suite.name} tests passed (${duration}ms)\n`);
      
      this.results.set(suite.name, { success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ ${suite.name} tests failed: ${errorMessage}\n`);
      
      this.results.set(suite.name, { success: false, error: errorMessage });

      if (suite.required) {
        console.log(`🛑 Required test suite failed. Stopping execution.\n`);
        process.exit(1);
      }
    }
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.size;
    const passedTests = Array.from(this.results.values()).filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log('📊 Test Summary');
    console.log('================');
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Total Suites: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}\n`);

    // Detailed results
    for (const [suiteName, result] of this.results.entries()) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${suiteName}: ${result.success ? 'PASSED' : 'FAILED'}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

    console.log('\n🎯 Coverage Report');
    console.log('==================');
    console.log('Run `npm run test:coverage` for detailed coverage report');

    if (failedTests > 0) {
      console.log('\n⚠️  Some tests failed. Please review the output above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed successfully!');
    }
  }

  async setupEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...\n');

    // Check if Playwright browsers are installed
    try {
      execSync('npx playwright --version', { stdio: 'pipe' });
    } catch {
      console.log('📦 Installing Playwright browsers...');
      execSync('npm run playwright:install', { stdio: 'inherit' });
    }

    // Ensure test directories exist
    const testDirs = [
      'src/test/integration',
      'src/test/e2e',
      'src/test/accessibility',
      'src/test/visual',
    ];

    for (const dir of testDirs) {
      if (!existsSync(path.join(process.cwd(), dir))) {
        console.log(`⚠️  Test directory ${dir} does not exist`);
      }
    }

    console.log('✅ Environment setup complete\n');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  if (args.includes('--help') || args.includes('-h')) {
    console.log('DubAI Frontend Test Runner');
    console.log('==========================');
    console.log('Usage: npm run test:all [options] [suites...]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h     Show this help message');
    console.log('  --setup        Setup test environment only');
    console.log('');
    console.log('Available test suites:');
    testSuites.forEach(suite => {
      console.log(`  ${suite.name.padEnd(12)} ${suite.description}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  npm run test:all                    # Run all tests');
    console.log('  npm run test:all unit integration   # Run specific suites');
    console.log('  npm run test:all --setup            # Setup environment only');
    return;
  }

  if (args.includes('--setup')) {
    await runner.setupEnvironment();
    return;
  }

  await runner.setupEnvironment();

  const suites = args.filter(arg => !arg.startsWith('--'));
  await runner.runAllTests(suites);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunner };
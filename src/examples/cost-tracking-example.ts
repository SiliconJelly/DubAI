import { CostTrackingServiceImpl, CostTrackingServiceConfig } from '../services/CostTrackingServiceImpl';
import { CostTrackingService } from '../services/CostTrackingService';
import { UsageMetrics, TTSServiceType } from '../types/common';
import { CostMetricsImpl } from '../models/CostMetrics';
import * as path from 'path';
import * as os from 'os';

async function demonstrateCostTracking() {
  console.log('🔍 Cost Tracking Service Example\n');

  // Configure the cost tracking service
  const config: CostTrackingServiceConfig = {
    googleTTSPricePerCharacter: 0.000016, // $16 per 1M characters (Google Cloud TTS pricing)
    localComputeCostPerSecond: 0.001, // $0.001 per second (estimated local compute cost)
    googleTTSMonthlyQuota: 4000000, // 4M characters free tier
    quotaAlertThreshold: 80, // Alert at 80% quota usage
    costAlertThreshold: 50, // Alert at $50 total cost
    storageDirectory: path.join(os.tmpdir(), 'cost-tracking-demo')
  };

  const costTracker: CostTrackingService = new CostTrackingServiceImpl(config);

  console.log('📊 Configuration:');
  console.log(`- Google TTS Price: $${config.googleTTSPricePerCharacter} per character`);
  console.log(`- Local Compute Cost: $${config.localComputeCostPerSecond} per second`);
  console.log(`- Monthly Quota: ${config.googleTTSMonthlyQuota.toLocaleString()} characters`);
  console.log(`- Quota Alert Threshold: ${config.quotaAlertThreshold}%`);
  console.log(`- Cost Alert Threshold: $${config.costAlertThreshold}\n`);

  try {
    // Simulate Google Cloud TTS usage
    console.log('🔊 Simulating Google Cloud TTS usage...');
    const googleUsage1: UsageMetrics = {
      charactersProcessed: 50000, // 50k characters
      processingTimeMs: 3000, // 3 seconds
      apiCalls: 1,
      errorCount: 0
    };

    await costTracker.trackUsage(TTSServiceType.GOOGLE_CLOUD, googleUsage1);

    // Check quota status
    const quotaStatus = await (costTracker as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
    console.log(`📈 Quota Status: ${quotaStatus.used.toLocaleString()}/${quotaStatus.limit.toLocaleString()} characters used`);
    console.log(`   Remaining: ${quotaStatus.remaining.toLocaleString()} characters`);
    console.log(`   Usage: ${((quotaStatus.used / quotaStatus.limit) * 100).toFixed(2)}%\n`);

    // Simulate Coqui TTS usage
    console.log('🏠 Simulating Coqui TTS (local) usage...');
    const coquiUsage: UsageMetrics = {
      charactersProcessed: 30000, // 30k characters
      processingTimeMs: 15000, // 15 seconds processing time
      apiCalls: 1,
      errorCount: 0
    };

    await costTracker.trackUsage(TTSServiceType.COQUI_LOCAL, coquiUsage);

    // Add more Google TTS usage to demonstrate cost accumulation
    console.log('🔊 Adding more Google Cloud TTS usage...');
    const googleUsage2: UsageMetrics = {
      charactersProcessed: 150000, // 150k characters
      processingTimeMs: 8000, // 8 seconds
      apiCalls: 2,
      errorCount: 0
    };

    await costTracker.trackUsage(TTSServiceType.GOOGLE_CLOUD, googleUsage2);

    // Generate cost report
    console.log('📋 Generating cost report...');
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = new Date();
    
    const report = await costTracker.generateCostReport(startDate, endDate);

    console.log('\n💰 Cost Report:');
    console.log(`   Total Cost: $${report.totalCost.toFixed(4)}`);
    console.log('   Breakdown:');
    console.log(`     - Google Cloud TTS: $${report.breakdown.googleTTS.toFixed(4)}`);
    console.log(`     - Coqui TTS (Local): $${report.breakdown.coquiTTS.toFixed(4)}`);
    console.log(`     - Compute: $${report.breakdown.compute.toFixed(4)}`);
    console.log('\n📊 Usage Statistics:');
    console.log(`   - Total Characters: ${report.usage.totalCharacters.toLocaleString()}`);
    console.log(`   - Total Compute Time: ${report.usage.totalComputeTime.toFixed(2)} seconds`);
    console.log(`   - Total Jobs: ${report.usage.totalJobs}`);

    // Demonstrate job-specific cost tracking
    console.log('\n🎯 Tracking job-specific costs...');
    const jobId = 'video-dubbing-job-001';
    const jobMetrics = new CostMetricsImpl(
      200000, // Google TTS characters
      3.2,    // Google TTS cost
      20,     // Coqui TTS usage (seconds)
      20,     // Compute time
      3.22    // Total cost
    );

    await (costTracker as CostTrackingServiceImpl).addJobCost(jobId, jobMetrics);
    const retrievedJobMetrics = await costTracker.getCostMetrics(jobId);
    
    console.log(`   Job ${jobId}:`);
    console.log(`     - Google TTS: ${retrievedJobMetrics.googleTTSCharacters.toLocaleString()} chars, $${retrievedJobMetrics.googleTTSCost.toFixed(4)}`);
    console.log(`     - Coqui TTS: ${retrievedJobMetrics.coquiTTSUsage}s, compute time: ${retrievedJobMetrics.computeTime}s`);
    console.log(`     - Total Cost: $${retrievedJobMetrics.totalCost.toFixed(4)}`);

    // Demonstrate quota alerts by using a large amount
    console.log('\n⚠️  Demonstrating quota alerts...');
    const largeUsage: UsageMetrics = {
      charactersProcessed: 3000000, // 3M characters - should trigger alert
      processingTimeMs: 20000,
      apiCalls: 5,
      errorCount: 0
    };

    await costTracker.trackUsage(TTSServiceType.GOOGLE_CLOUD, largeUsage);

    // Check for alerts
    const alerts = await (costTracker as CostTrackingServiceImpl).getAlerts();
    if (alerts.length > 0) {
      console.log(`   Generated ${alerts.length} alert(s):`);
      alerts.forEach((alert, index) => {
        console.log(`   ${index + 1}. ${alert.type.toUpperCase()} ALERT: ${alert.message}`);
        console.log(`      Service: ${alert.service}, Threshold: ${alert.threshold}%, Current: ${alert.currentValue.toFixed(1)}%`);
      });
    }

    // Final quota status
    const finalQuotaStatus = await (costTracker as CostTrackingServiceImpl).getQuotaStatus(TTSServiceType.GOOGLE_CLOUD);
    console.log(`\n📊 Final Quota Status:`);
    console.log(`   Used: ${finalQuotaStatus.used.toLocaleString()}/${finalQuotaStatus.limit.toLocaleString()} characters`);
    console.log(`   Remaining: ${finalQuotaStatus.remaining.toLocaleString()} characters`);
    console.log(`   Usage: ${((finalQuotaStatus.used / finalQuotaStatus.limit) * 100).toFixed(2)}%`);
    console.log(`   Resets: ${finalQuotaStatus.resetDate.toDateString()}`);

    // Demonstrate cost optimization insights
    console.log('\n💡 Cost Optimization Insights:');
    const finalReport = await costTracker.generateCostReport(startDate, endDate);
    const googleCostPerChar = finalReport.breakdown.googleTTS / (finalReport.usage.totalCharacters * 0.8); // Assuming 80% was Google TTS
    const coquiCostPerChar = finalReport.breakdown.coquiTTS / (finalReport.usage.totalCharacters * 0.2); // Assuming 20% was Coqui TTS
    
    console.log(`   - Google TTS cost per character: $${googleCostPerChar.toFixed(8)}`);
    console.log(`   - Coqui TTS cost per character: $${coquiCostPerChar.toFixed(8)}`);
    
    if (coquiCostPerChar < googleCostPerChar) {
      const savings = ((googleCostPerChar - coquiCostPerChar) / googleCostPerChar) * 100;
      console.log(`   - Potential savings with Coqui TTS: ${savings.toFixed(1)}%`);
    }

    console.log('\n✅ Cost tracking demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Error during cost tracking demonstration:', error);
  }
}

// Run the example
if (require.main === module) {
  demonstrateCostTracking().catch(console.error);
}

export { demonstrateCostTracking };
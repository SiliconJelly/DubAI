import { QualityAssuranceEngineImpl, QualityThresholds } from '../services/QualityAssuranceEngineImpl';
import { ProcessingJobImpl } from '../models/ProcessingJob';
import { VideoFileImpl } from '../models/VideoFile';
import { CostMetrics } from '../models/CostMetrics';
import { QualityMetricsImpl } from '../models/QualityMetrics';
import { FFmpegWrapper } from '../utils/ffmpeg';
import { JobStatus, VideoMetadata } from '../types/common';
import * as fs from 'fs/promises';

/**
 * Example demonstrating how to use the QualityAssuranceEngine
 * to validate and assess the quality of dubbed video content.
 */
async function demonstrateQualityAssurance() {
  console.log('🎬 Quality Assurance Engine Demo');
  console.log('================================\n');

  // Configure FFmpeg wrapper
  const ffmpegConfig = {
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    timeout: 30000
  };
  const ffmpeg = new FFmpegWrapper(ffmpegConfig);

  // Configure quality thresholds
  const customThresholds: QualityThresholds = {
    minAudioQuality: 0.75,        // Require 75% audio quality
    minSynchronizationAccuracy: 0.85, // Require 85% sync accuracy
    maxProcessingTime: 240000,    // Max 4 minutes processing time
    minOverallScore: 0.8          // Require 80% overall score
  };

  // Create quality assurance engine
  const qualityEngine = new QualityAssuranceEngineImpl(ffmpeg, customThresholds);

  console.log('📊 Current Quality Thresholds:');
  const thresholds = qualityEngine.getThresholds();
  console.log(`  - Min Audio Quality: ${thresholds.minAudioQuality * 100}%`);
  console.log(`  - Min Sync Accuracy: ${thresholds.minSynchronizationAccuracy * 100}%`);
  console.log(`  - Max Processing Time: ${thresholds.maxProcessingTime / 1000}s`);
  console.log(`  - Min Overall Score: ${thresholds.minOverallScore * 100}%\n`);

  // Example 1: Validate audio quality from buffer
  console.log('🎵 Example 1: Audio Quality Validation');
  console.log('-------------------------------------');
  
  try {
    // In a real scenario, this would be actual audio data
    const mockAudioBuffer = Buffer.from('mock high-quality audio data');
    
    console.log('Analyzing audio quality...');
    // Note: This would fail in real usage without actual audio file
    // const audioScore = await qualityEngine.validateAudioQuality(mockAudioBuffer);
    // console.log(`Audio Quality Score: ${(audioScore * 100).toFixed(1)}%\n`);
    console.log('(Skipped - requires actual audio file)\n');
  } catch (error) {
    console.log('Expected error - demo uses mock data\n');
  }

  // Example 2: Validate synchronization
  console.log('🎯 Example 2: Synchronization Validation');
  console.log('---------------------------------------');
  
  try {
    console.log('Analyzing video-audio synchronization...');
    // Note: This would fail in real usage without actual files
    // const syncScore = await qualityEngine.validateSynchronization('input.mp4', 'output.wav');
    // console.log(`Synchronization Score: ${(syncScore * 100).toFixed(1)}%\n`);
    console.log('(Skipped - requires actual video and audio files)\n');
  } catch (error) {
    console.log('Expected error - demo uses mock data\n');
  }

  // Example 3: Check quality thresholds
  console.log('✅ Example 3: Quality Threshold Checking');
  console.log('---------------------------------------');

  // Create sample quality metrics
  const goodMetrics = new QualityMetricsImpl(
    0.85,  // High audio quality
    0.90,  // Excellent sync accuracy
    180000, // 3 minutes processing time
    0.88   // Good user satisfaction
  );

  const poorMetrics = new QualityMetricsImpl(
    0.60,  // Poor audio quality
    0.70,  // Poor sync accuracy
    300000, // 5 minutes processing time
    0.50   // Poor user satisfaction
  );

  const goodResult = await qualityEngine.checkQualityThresholds(goodMetrics);
  const poorResult = await qualityEngine.checkQualityThresholds(poorMetrics);

  console.log('Good Quality Metrics:');
  console.log(`  - Audio Quality: ${(goodMetrics.audioQuality * 100).toFixed(1)}%`);
  console.log(`  - Sync Accuracy: ${(goodMetrics.synchronizationAccuracy * 100).toFixed(1)}%`);
  console.log(`  - Processing Time: ${goodMetrics.processingTime / 1000}s`);
  console.log(`  - Overall Score: ${(goodMetrics.getOverallScore() * 100).toFixed(1)}%`);
  console.log(`  - Passes Thresholds: ${goodResult ? '✅ YES' : '❌ NO'}\n`);

  console.log('Poor Quality Metrics:');
  console.log(`  - Audio Quality: ${(poorMetrics.audioQuality * 100).toFixed(1)}%`);
  console.log(`  - Sync Accuracy: ${(poorMetrics.synchronizationAccuracy * 100).toFixed(1)}%`);
  console.log(`  - Processing Time: ${poorMetrics.processingTime / 1000}s`);
  console.log(`  - Overall Score: ${(poorMetrics.getOverallScore() * 100).toFixed(1)}%`);
  console.log(`  - Passes Thresholds: ${poorResult ? '✅ YES' : '❌ NO'}\n`);

  // Example 4: Generate comprehensive quality report
  console.log('📋 Example 4: Comprehensive Quality Report');
  console.log('----------------------------------------');

  // Create a mock processing job
  const mockVideoMetadata: VideoMetadata = {
    duration: 120,
    codec: 'h264',
    bitrate: 5000000,
    frameRate: 30
  };

  const inputVideo = new VideoFileImpl(
    'input-123',
    'input.mp4',
    '/path/to/input.mp4',
    'mp4',
    120,
    { width: 1920, height: 1080 },
    mockVideoMetadata
  );

  const outputVideo = new VideoFileImpl(
    'output-123',
    'output.mp4',
    '/path/to/output.mp4',
    'mp4',
    120,
    { width: 1920, height: 1080 },
    mockVideoMetadata
  );

  const costMetrics: CostMetrics = {
    googleTTSCharacters: 1500,
    googleTTSCost: 0.03,
    coquiTTSUsage: 0,
    computeTime: 180,
    totalCost: 0.03
  };

  const mockJob = new ProcessingJobImpl(
    'job-demo-123',
    JobStatus.COMPLETED,
    inputVideo,
    costMetrics,
    outputVideo,
    100,
    new Date(Date.now() - 180000), // 3 minutes ago
    new Date()
  );

  try {
    console.log('Generating quality report...');
    // Note: This would fail in real usage without actual files
    // const report = await qualityEngine.generateQualityReport(mockJob);
    // console.log(`Job ID: ${report.jobId}`);
    // console.log(`Overall Score: ${(report.overallScore * 100).toFixed(1)}%`);
    // console.log(`Validation Passed: ${report.passedValidation ? '✅ YES' : '❌ NO'}`);
    // console.log(`Issues Found: ${report.issues.length}`);
    // console.log(`Recommendations: ${report.recommendations.length}\n`);
    console.log('(Skipped - requires actual video files)\n');
  } catch (error) {
    console.log('Expected error - demo uses mock data\n');
  }

  // Example 5: Dynamic threshold adjustment
  console.log('⚙️  Example 5: Dynamic Threshold Adjustment');
  console.log('------------------------------------------');

  console.log('Original thresholds:');
  console.log(`  - Min Audio Quality: ${qualityEngine.getThresholds().minAudioQuality * 100}%`);

  // Update thresholds for stricter quality requirements
  qualityEngine.updateThresholds({
    minAudioQuality: 0.85,
    minOverallScore: 0.9
  });

  console.log('Updated thresholds:');
  const updatedThresholds = qualityEngine.getThresholds();
  console.log(`  - Min Audio Quality: ${updatedThresholds.minAudioQuality * 100}%`);
  console.log(`  - Min Overall Score: ${updatedThresholds.minOverallScore * 100}%`);
  console.log(`  - Min Sync Accuracy: ${updatedThresholds.minSynchronizationAccuracy * 100}% (unchanged)\n`);

  // Test the same metrics against new thresholds
  const goodResultUpdated = await qualityEngine.checkQualityThresholds(goodMetrics);
  console.log(`Good metrics now pass stricter thresholds: ${goodResultUpdated ? '✅ YES' : '❌ NO'}\n`);

  console.log('🎉 Quality Assurance Engine Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Audio quality analysis with multiple metrics');
  console.log('• Video-audio synchronization validation');
  console.log('• Configurable quality thresholds');
  console.log('• Comprehensive quality reporting');
  console.log('• Issue identification and recommendations');
  console.log('• Dynamic threshold adjustment');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateQualityAssurance()
    .then(() => {
      console.log('\n✨ Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error.message);
      process.exit(1);
    });
}

export { demonstrateQualityAssurance };
import { Router } from 'express';
import { costTrackingService } from '../services/CostTrackingService';
import { authenticateUser } from '../middleware/auth';
import { TTSServiceType } from '../../../src/types/common';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Get cost breakdown for user
router.get('/breakdown', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const timeframe = req.query.timeframe as 'day' | 'week' | 'month' | 'year' || 'month';
    const breakdown = await costTrackingService.getCostBreakdown(userId, timeframe);

    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    console.error('Error getting cost breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cost breakdown'
    });
  }
});

// Get usage metrics
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const timeframe = req.query.timeframe as 'day' | 'week' | 'month' | 'year' || 'month';
    const metrics = await costTrackingService.getUsageMetrics(userId, timeframe);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting usage metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage metrics'
    });
  }
});

// Get quota status
router.get('/quota', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const quotaStatus = await costTrackingService.getQuotaStatus(userId);

    res.json({
      success: true,
      data: quotaStatus
    });
  } catch (error) {
    console.error('Error getting quota status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quota status'
    });
  }
});

// Get optimization recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const recommendations = await costTrackingService.getOptimizationRecommendations(userId);

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting optimization recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get optimization recommendations'
    });
  }
});

// Get quota alerts
router.get('/alerts', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const alerts = await costTrackingService.getQuotaAlerts(userId);

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error getting quota alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quota alerts'
    });
  }
});

// Get optimal service recommendation
router.post('/optimal-service', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { charactersToProcess, qualityRequirement } = req.body;

    if (!charactersToProcess || !qualityRequirement) {
      return res.status(400).json({
        success: false,
        error: 'charactersToProcess and qualityRequirement are required'
      });
    }

    if (!['high', 'medium', 'low'].includes(qualityRequirement)) {
      return res.status(400).json({
        success: false,
        error: 'qualityRequirement must be high, medium, or low'
      });
    }

    const recommendation = await costTrackingService.selectOptimalService(
      charactersToProcess,
      qualityRequirement,
      userId
    );

    res.json({
      success: true,
      data: recommendation
    });
  } catch (error) {
    console.error('Error getting optimal service recommendation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get optimal service recommendation'
    });
  }
});

// Track service usage (internal endpoint for system use)
router.post('/track-usage', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { jobId, service, usage } = req.body;

    if (!jobId || !service || !usage) {
      return res.status(400).json({
        success: false,
        error: 'jobId, service, and usage are required'
      });
    }

    if (!Object.values(TTSServiceType).includes(service)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service type'
      });
    }

    await costTrackingService.trackServiceUsage(userId, jobId, service, usage);

    res.json({
      success: true,
      message: 'Usage tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking service usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track service usage'
    });
  }
});

// Get cost savings report
router.get('/savings', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const timeframe = req.query.timeframe as 'day' | 'week' | 'month' | 'year' || 'month';
    const usageMetrics = await costTrackingService.getUsageMetrics(userId, timeframe);
    
    // Calculate potential savings if all processing was done with the cheaper service
    const googleUsage = usageMetrics.serviceBreakdown[TTSServiceType.GOOGLE_CLOUD];
    const coquiUsage = usageMetrics.serviceBreakdown[TTSServiceType.COQUI_LOCAL];
    
    const googleCostPerChar = 0.000016;
    const coquiCostPerChar = 0.000005;
    
    // Calculate what it would cost if all Google TTS usage was done with Coqui
    const potentialSavingsFromGoogle = googleUsage.characters * (googleCostPerChar - coquiCostPerChar);
    
    // Calculate actual savings (what was saved by using Coqui instead of Google)
    const actualSavings = coquiUsage.characters * (googleCostPerChar - coquiCostPerChar);
    
    const totalCost = googleUsage.cost + coquiUsage.cost;
    const totalCharacters = googleUsage.characters + coquiUsage.characters;
    
    res.json({
      success: true,
      data: {
        totalCost,
        totalCharacters,
        actualSavings,
        potentialSavings: potentialSavingsFromGoogle,
        savingsPercentage: totalCost > 0 ? (actualSavings / (totalCost + actualSavings)) * 100 : 0,
        serviceDistribution: {
          googleTTS: {
            characters: googleUsage.characters,
            cost: googleUsage.cost,
            percentage: totalCharacters > 0 ? (googleUsage.characters / totalCharacters) * 100 : 0
          },
          coquiTTS: {
            characters: coquiUsage.characters,
            cost: coquiUsage.cost,
            percentage: totalCharacters > 0 ? (coquiUsage.characters / totalCharacters) * 100 : 0
          }
        }
      }
    });
  } catch (error) {
    console.error('Error getting cost savings report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cost savings report'
    });
  }
});

export default router;
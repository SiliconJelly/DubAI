import { Router, Request, Response } from 'express';
import { ApiResponse } from '@dubai/shared';
import { asyncHandler } from '../middleware/errorHandler';
import { optionalAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Apply optional auth to all metrics routes
router.use(optionalAuthMiddleware);

// System metrics endpoint
router.get('/system', asyncHandler(async (req: Request, res: Response) => {
  const metrics = {
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    loadAverage: require('os').loadavg(),
    freeMemory: require('os').freemem(),
    totalMemory: require('os').totalmem(),
    timestamp: new Date().toISOString()
  };

  const response: ApiResponse<any> = {
    success: true,
    data: metrics
  };

  res.json(response);
}));

// Application metrics endpoint
router.get('/application', asyncHandler(async (req: Request, res: Response) => {
  // In a real application, you would collect these metrics over time
  const metrics = {
    requests: {
      total: 0, // Would be tracked in middleware
      successful: 0,
      failed: 0,
      averageResponseTime: 0
    },
    jobs: {
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: 0
    },
    users: {
      total: 0,
      active: 0
    },
    storage: {
      filesUploaded: 0,
      totalSize: 0
    },
    processing: {
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      costSavings: 0
    },
    timestamp: new Date().toISOString()
  };

  // If user is authenticated, get their specific metrics
  if (req.user) {
    try {
      const userMetrics = await getUserMetrics(req);
      metrics.users = userMetrics;
    } catch (error) {
      console.error('Error fetching user metrics:', error);
    }
  }

  const response: ApiResponse<any> = {
    success: true,
    data: metrics
  };

  res.json(response);
}));

// Database metrics endpoint
router.get('/database', asyncHandler(async (req: Request, res: Response) => {
  if (!req.supabase) {
    const response: ApiResponse<any> = {
      success: false,
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database connection not available'
    };
    res.status(503).json(response);
    return;
  }

  try {
    const metrics = await getDatabaseMetrics(req);
    
    const response: ApiResponse<any> = {
      success: true,
      data: metrics
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<any> = {
      success: false,
      error: 'METRICS_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch database metrics'
    };
    res.status(500).json(response);
  }
}));

// Performance metrics endpoint
router.get('/performance', asyncHandler(async (req: Request, res: Response) => {
  const startTime = process.hrtime.bigint();
  
  // Simulate some work to measure performance
  await new Promise(resolve => setTimeout(resolve, 1));
  
  const endTime = process.hrtime.bigint();
  const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

  const metrics = {
    responseTime,
    memory: process.memoryUsage(),
    eventLoopDelay: await measureEventLoopDelay(),
    gc: getGCMetrics(),
    timestamp: new Date().toISOString()
  };

  const response: ApiResponse<any> = {
    success: true,
    data: metrics
  };

  res.json(response);
}));

// Cost metrics endpoint (requires authentication)
router.get('/costs', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    const response: ApiResponse<any> = {
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication required for cost metrics'
    };
    res.status(401).json(response);
    return;
  }

  try {
    const costMetrics = await getCostMetrics(req);
    
    const response: ApiResponse<any> = {
      success: true,
      data: costMetrics
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<any> = {
      success: false,
      error: 'METRICS_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch cost metrics'
    };
    res.status(500).json(response);
  }
}));

// Helper functions
async function getUserMetrics(req: Request): Promise<any> {
  if (!req.supabase || !req.user) {
    return {};
  }

  try {
    // Get user's job statistics
    const { data: jobs, error: jobsError } = await req.supabase
      .from('dubbing_jobs')
      .select('status, processing_metrics')
      .eq('user_id', req.user.id);

    if (jobsError) {
      throw jobsError;
    }

    const jobStats = {
      total: jobs?.length || 0,
      completed: jobs?.filter((job: any) => job.status === 'completed').length || 0,
      failed: jobs?.filter((job: any) => job.status === 'failed').length || 0,
      inProgress: jobs?.filter((job: any) => !['completed', 'failed'].includes(job.status)).length || 0
    };

    return jobStats;
  } catch (error) {
    console.error('Error fetching user metrics:', error);
    return {};
  }
}

async function getDatabaseMetrics(req: Request): Promise<any> {
  if (!req.supabase) {
    throw new Error('Database connection not available');
  }

  try {
    // Get table counts (these queries might need adjustment based on your RLS policies)
    const [usersResult, jobsResult, filesResult] = await Promise.allSettled([
      req.supabase.from('user_profiles').select('count', { count: 'exact', head: true }),
      req.supabase.from('dubbing_jobs').select('count', { count: 'exact', head: true }),
      req.supabase.from('storage_files').select('count', { count: 'exact', head: true })
    ]);

    const metrics = {
      tables: {
        users: usersResult.status === 'fulfilled' ? usersResult.value.count || 0 : 0,
        jobs: jobsResult.status === 'fulfilled' ? jobsResult.value.count || 0 : 0,
        files: filesResult.status === 'fulfilled' ? filesResult.value.count || 0 : 0
      },
      connectionStatus: 'healthy',
      timestamp: new Date().toISOString()
    };

    return metrics;
  } catch (error) {
    throw new Error(`Database metrics error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function measureEventLoopDelay(): Promise<number> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      resolve(delay);
    });
  });
}

function getGCMetrics(): any {
  // Basic GC metrics - in production you might want to use a more sophisticated approach
  try {
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      global.gc();
      const afterGC = process.memoryUsage();
      
      return {
        available: true,
        memoryFreed: beforeGC.heapUsed - afterGC.heapUsed,
        beforeGC,
        afterGC
      };
    } else {
      return {
        available: false,
        message: 'GC not exposed. Run with --expose-gc flag to enable.'
      };
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'GC metrics error'
    };
  }
}

async function getCostMetrics(req: Request): Promise<any> {
  if (!req.supabase || !req.user) {
    throw new Error('Authentication required');
  }

  try {
    // Get user's processing metrics to calculate costs
    const { data: jobs, error } = await req.supabase
      .from('dubbing_jobs')
      .select('processing_metrics')
      .eq('user_id', req.user.id)
      .eq('status', 'completed');

    if (error) {
      throw error;
    }

    let totalCost = 0;
    let totalSavings = 0;
    let serviceBreakdown = {
      google: 0,
      coqui: 0
    };

    jobs?.forEach((job: any) => {
      if (job.processing_metrics?.costBreakdown) {
        totalCost += job.processing_metrics.costBreakdown.totalCost || 0;
        
        // Calculate savings (assuming Google TTS would have been more expensive)
        if (job.processing_metrics.ttsService === 'coqui') {
          totalSavings += job.processing_metrics.costBreakdown.ttsCost || 0;
        }
        
        // Service breakdown
        if (job.processing_metrics.ttsService === 'google') {
          serviceBreakdown.google += job.processing_metrics.costBreakdown.ttsCost || 0;
        } else {
          serviceBreakdown.coqui += job.processing_metrics.costBreakdown.ttsCost || 0;
        }
      }
    });

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalSavings: Math.round(totalSavings * 100) / 100,
      serviceBreakdown,
      jobsAnalyzed: jobs?.length || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Cost metrics error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export { router as metricsRoutes };
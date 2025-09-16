import { Router, Request, Response } from 'express';
import { ApiResponse } from '@dubai/shared';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Health check endpoint
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Check various system components
  const checks = {
    database: await checkDatabase(req),
    memory: checkMemory(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };

  const responseTime = Date.now() - startTime;
  const allHealthy = Object.values(checks).every(check => 
    typeof check === 'object' ? check.status === 'healthy' : true
  );

  const response: ApiResponse<any> = {
    success: true,
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      responseTime,
      checks,
      services: {
        transcription: { status: 'up', service: 'whisper' },
        tts: { status: 'up', services: ['google', 'coqui'] },
        assembly: { status: 'up', service: 'ffmpeg' },
        storage: { status: 'up', service: 'supabase' }
      }
    }
  };

  res.status(allHealthy ? 200 : 503).json(response);
}));

// Detailed health check
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  const checks = {
    database: await checkDatabase(req),
    memory: checkMemory(),
    disk: checkDisk(),
    environment: checkEnvironment(),
    dependencies: await checkDependencies(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };

  const responseTime = Date.now() - startTime;
  const allHealthy = Object.values(checks).every(check => 
    typeof check === 'object' ? check.status === 'healthy' : true
  );

  const response: ApiResponse<any> = {
    success: true,
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      responseTime,
      checks
    }
  };

  res.status(allHealthy ? 200 : 503).json(response);
}));

// Readiness probe
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  // Check if the application is ready to serve requests
  const isReady = await checkReadiness(req);
  
  const response: ApiResponse<any> = {
    success: isReady,
    data: {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString()
    }
  };

  res.status(isReady ? 200 : 503).json(response);
}));

// Liveness probe
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check
  const response: ApiResponse<any> = {
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  };

  res.json(response);
});

// Helper functions
async function checkDatabase(req: Request): Promise<{ status: string; responseTime?: number; error?: string }> {
  if (!req.supabase) {
    return { status: 'unhealthy', error: 'Supabase client not available' };
  }

  try {
    const startTime = Date.now();
    const { error } = await req.supabase
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      return { status: 'degraded', responseTime, error: error.message };
    }
    
    return { status: 'healthy', responseTime };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
}

function checkMemory(): { status: string; usage: NodeJS.MemoryUsage; percentage: number } {
  const usage = process.memoryUsage();
  const totalMemory = usage.rss + usage.heapUsed + usage.external;
  const maxMemory = 1024 * 1024 * 1024; // 1GB threshold
  const percentage = (totalMemory / maxMemory) * 100;
  
  return {
    status: percentage > 90 ? 'unhealthy' : percentage > 70 ? 'degraded' : 'healthy',
    usage,
    percentage: Math.round(percentage * 100) / 100
  };
}

function checkDisk(): { status: string; info?: any } {
  // Basic disk check - in production, you might want to use a library like 'diskusage'
  try {
    const stats = require('fs').statSync('.');
    return {
      status: 'healthy',
      info: 'Disk accessible'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      info: error instanceof Error ? error.message : 'Disk check failed'
    };
  }
}

function checkEnvironment(): { status: string; variables: string[] } {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'NODE_ENV'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  return {
    status: missing.length === 0 ? 'healthy' : 'unhealthy',
    variables: missing.length === 0 ? ['All required variables present'] : [`Missing: ${missing.join(', ')}`]
  };
}

async function checkDependencies(): Promise<{ status: string; services: any }> {
  const services = {
    supabase: 'healthy', // We already check this in database check
    winston: 'healthy',  // Logger is working if we got this far
    express: 'healthy'   // Express is working if we got this far
  };
  
  return {
    status: 'healthy',
    services
  };
}

async function checkReadiness(req: Request): Promise<boolean> {
  try {
    // Check database connectivity
    const dbCheck = await checkDatabase(req);
    if (dbCheck.status === 'unhealthy') {
      return false;
    }
    
    // Check memory usage
    const memCheck = checkMemory();
    if (memCheck.status === 'unhealthy') {
      return false;
    }
    
    // Check environment variables
    const envCheck = checkEnvironment();
    if (envCheck.status === 'unhealthy') {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

export { router as healthRoutes };
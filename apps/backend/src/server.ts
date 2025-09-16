import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// Import middleware and utilities
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/authMiddleware';
import { validationMiddleware } from './middleware/validationMiddleware';
import { loggingMiddleware } from './middleware/loggingMiddleware';
import { rateLimitMiddleware } from './middleware/rateLimitMiddleware';

// Import route handlers
import { jobRoutes } from './routes/jobRoutes';
import { fileRoutes } from './routes/fileRoutes';
import { userRoutes } from './routes/userRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { metricsRoutes } from './routes/metricsRoutes';
import costTrackingRoutes from './routes/costTracking';

// Import services
import { WebSocketService } from './services/WebSocketService';

// Import types
import { ApiResponse } from '@dubai/shared';
import './types/api'; // Import extended Express types

// Configuration interface
interface ServerConfig {
  port: number;
  corsOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  nodeEnv: string;
  logLevel: string;
}



class DubAIServer {
  private app!: Express;
  private server: any;
  private webSocketService!: WebSocketService;
  private supabase!: SupabaseClient;
  private logger!: winston.Logger;
  private config!: ServerConfig;

  constructor() {
    this.loadConfiguration();
    this.setupLogger();
    this.initializeSupabase();
    this.createExpressApp();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  private loadConfiguration(): void {
    this.config = {
      port: parseInt(process.env['PORT'] || '3000', 10),
      corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:8080',
      supabaseUrl: process.env['SUPABASE_URL'] || '',
      supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] || '',
      supabaseServiceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',
      nodeEnv: process.env['NODE_ENV'] || 'development',
      logLevel: process.env['LOG_LEVEL'] || 'info'
    };

    // Validate required configuration
    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      throw new Error('Missing required Supabase configuration. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
  }

  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'dubai-backend' },
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
      ]
    });

    // Add console transport for development
    if (this.config.nodeEnv !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  private initializeSupabase(): void {
    try {
      this.supabase = createClient(
        this.config.supabaseUrl,
        this.config.supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      this.logger.info('Supabase client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  private createExpressApp(): void {
    this.app = express();
    this.server = createServer(this.app);
  }

  private setupMiddleware(): void {
    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.requestId = uuidv4();
      req.startTime = Date.now();
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });

    // Logging middleware
    this.app.use(loggingMiddleware(this.logger));

    // CORS middleware
    this.app.use(cors({
      origin: this.config.corsOrigin.split(',').map(origin => origin.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '50mb',
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '50mb' 
    }));

    // Rate limiting middleware
    this.app.use(rateLimitMiddleware());

    // Supabase client middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.supabase = this.supabase;
      next();
    });

    // Request validation middleware
    this.app.use(validationMiddleware());
  }

  private setupRoutes(): void {
    // Health check routes (no auth required)
    this.app.use('/api/health', healthRoutes);
    this.app.use('/api/metrics', metricsRoutes);

    // Make logger available to routes
    this.app.set('logger', this.logger);

    // API routes with authentication
    this.app.use('/api/jobs', authMiddleware, jobRoutes);
    this.app.use('/api/files', authMiddleware, fileRoutes);
    this.app.use('/api/users', authMiddleware, userRoutes);
    this.app.use('/api/cost-tracking', costTrackingRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      const response: ApiResponse<any> = {
        success: true,
        message: 'DubAI Backend API Server',
        data: {
          version: '1.0.0',
          environment: this.config.nodeEnv,
          timestamp: new Date().toISOString()
        }
      };
      res.json(response);
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      const response: ApiResponse<any> = {
        success: false,
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      };
      res.status(404).json(response);
    });
  }

  private setupWebSocket(): void {
    this.webSocketService = new WebSocketService(this.server, {
      corsOrigin: this.config.corsOrigin.split(',').map(origin => origin.trim()),
      logger: this.logger,
      supabase: this.supabase
    });

    // Make WebSocket service available to routes
    this.app.set('webSocketService', this.webSocketService);
    this.app.set('io', this.webSocketService.getIO());
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(errorHandler(this.logger));

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    try {
      // Test Supabase connection
      await this.testSupabaseConnection();

      // Start server
      this.server.listen(this.config.port, () => {
        this.logger.info(`DubAI Backend Server started successfully`);
        this.logger.info(`Port: ${this.config.port}`);
        this.logger.info(`Environment: ${this.config.nodeEnv}`);
        this.logger.info(`Health check: http://localhost:${this.config.port}/api/health`);
        this.logger.info(`WebSocket server ready for real-time updates`);
      });

      // Graceful shutdown handlers
      process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }

  private async testSupabaseConnection(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('count')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      this.logger.info('Supabase connection test successful');
    } catch (error) {
      this.logger.warn('Supabase connection test failed (this is expected if tables don\'t exist yet):', error);
    }
  }

  private gracefulShutdown(signal: string): void {
    this.logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    this.server.close(() => {
      this.logger.info('HTTP server closed');
      
      if (this.webSocketService) {
        this.webSocketService.shutdown().then(() => {
          this.logger.info('WebSocket service closed');
          this.logger.info('Graceful shutdown completed');
          process.exit(0);
        });
      } else {
        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      this.logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  public async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (this.webSocketService) {
            this.webSocketService.shutdown().then(() => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  public getApp(): Express {
    return this.app;
  }

  public getWebSocketService(): WebSocketService {
    return this.webSocketService;
  }

  public getSupabase(): SupabaseClient {
    return this.supabase;
  }

  public getLogger(): winston.Logger {
    return this.logger;
  }
}

// Export server instance
export { DubAIServer };

// Start server if this file is run directly
if (require.main === module) {
  const server = new DubAIServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
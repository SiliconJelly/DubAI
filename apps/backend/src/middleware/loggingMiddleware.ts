import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

export function loggingMiddleware(logger: winston.Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Log incoming request
    logger.info('Incoming request', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: req.get('Content-Length'),
      contentType: req.get('Content-Type'),
      userId: req.user?.id
    });

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(body: any) {
      const duration = Date.now() - startTime;
      
      // Log response
      logger.info('Outgoing response', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id,
        responseSize: JSON.stringify(body).length
      });

      return originalJson.call(this, body);
    };

    // Override res.send to log response
    const originalSend = res.send;
    res.send = function(body: any) {
      const duration = Date.now() - startTime;
      
      // Log response
      logger.info('Outgoing response', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id,
        responseSize: typeof body === 'string' ? body.length : JSON.stringify(body).length
      });

      return originalSend.call(this, body);
    };

    next();
  };
}

// Performance monitoring middleware
export function performanceMiddleware(logger: winston.Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      };

      // Log performance metrics
      logger.debug('Request performance', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        memoryDelta,
        userId: req.user?.id
      });

      // Log slow requests
      if (duration > 5000) { // 5 seconds
        logger.warn('Slow request detected', {
          requestId: req.requestId,
          method: req.method,
          url: req.originalUrl,
          duration,
          userId: req.user?.id
        });
      }
    });

    next();
  };
}

// Request correlation middleware
export function correlationMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get correlation ID from header or generate new one
    const correlationId = req.get('X-Correlation-ID') || req.requestId || 'unknown';
    
    // Set correlation ID in response header
    res.setHeader('X-Correlation-ID', correlationId);
    
    // Add to request for use in logging
    req.correlationId = correlationId;
    
    next();
  };
}


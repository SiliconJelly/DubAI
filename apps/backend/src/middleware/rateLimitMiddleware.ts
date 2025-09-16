import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@dubai/shared';

// Simple in-memory rate limiter
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class InMemoryRateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;
  private cleanupInterval: NodeJS.Timeout | undefined;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up expired entries every minute (only in non-test environments)
    if (process.env['NODE_ENV'] !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.store = {};
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  public isAllowed(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store[key];

    if (!entry || entry.resetTime < now) {
      // First request or window expired
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs
      };
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: this.store[key].resetTime
      };
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }
}

// Rate limiter instances
let globalLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes
let authLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes for auth endpoints
let uploadLimiter = new InMemoryRateLimiter(60 * 60 * 1000, 10); // 10 uploads per hour

// Cleanup function for tests
export function cleanupRateLimiters(): void {
  globalLimiter.destroy();
  authLimiter.destroy();
  uploadLimiter.destroy();
  
  // Recreate instances
  globalLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 1000);
  authLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 100);
  uploadLimiter = new InMemoryRateLimiter(60 * 60 * 1000, 10);
}

export function rateLimitMiddleware(type: 'global' | 'auth' | 'upload' = 'global') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const limiter = type === 'auth' ? authLimiter : type === 'upload' ? uploadLimiter : globalLimiter;
    
    // Use IP address as the key, or user ID if authenticated
    const key = req.user?.id || req.ip || 'unknown';
    
    const result = limiter.isAllowed(key);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limiter['maxRequests']);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
    
    if (!result.allowed) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        data: {
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        }
      };
      
      res.status(429).json(response);
      return;
    }
    
    next();
  };
}

// Specific rate limiters for different endpoints
export const globalRateLimit = rateLimitMiddleware('global');
export const authRateLimit = rateLimitMiddleware('auth');
export const uploadRateLimit = rateLimitMiddleware('upload');

// Custom rate limiter for specific use cases
export function customRateLimit(windowMs: number, maxRequests: number, keyGenerator?: (req: Request) => string) {
  const limiter = new InMemoryRateLimiter(windowMs, maxRequests);
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator ? keyGenerator(req) : (req.user?.id || req.ip || 'unknown');
    const result = limiter.isAllowed(key);
    
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
    
    if (!result.allowed) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        data: {
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        }
      };
      
      res.status(429).json(response);
      return;
    }
    
    next();
  };
}
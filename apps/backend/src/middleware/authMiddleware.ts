import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ApiResponse } from '@dubai/shared';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authorization header missing or invalid'
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Access token missing'
      };
      res.status(401).json(response);
      return;
    }

    // Verify token with Supabase
    const supabase = req.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired access token'
      };
      res.status(401).json(response);
      return;
    }

    // Add user information to request
    req.user = {
      id: user.id,
      email: user.email || ''
    };

    // Create user-specific Supabase client for RLS
    const userSupabase = createClient(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_ANON_KEY']!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    req.supabase = userSupabase;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    const response: ApiResponse<any> = {
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication verification failed'
    };
    res.status(500).json(response);
  }
}

// Optional auth middleware (doesn't fail if no token)
export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      next();
      return;
    }

    const supabase = req.supabase;
    if (!supabase) {
      next();
      return;
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email || ''
      };

      // Create user-specific Supabase client
      const userSupabase = createClient(
        process.env['SUPABASE_URL']!,
        process.env['SUPABASE_ANON_KEY']!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );

      req.supabase = userSupabase;
    }

    next();
  } catch (error) {
    // Log error but don't fail the request
    console.error('Optional auth middleware error:', error);
    next();
  }
}
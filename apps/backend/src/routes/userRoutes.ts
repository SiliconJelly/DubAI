import { Router, Request, Response } from 'express';
import { ApiResponse, UserProfile } from '@dubai/shared';
import { z } from 'zod';

const router = Router();

// Get current user profile
router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'User not authenticated'
      };
      res.status(401).json(response);
      return;
    }

    const { data: profile, error } = await req.supabase!
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      // If profile doesn't exist, create it
      if (error.code === 'PGRST116') {
        const newProfile = {
          id: req.user.id,
          username: req.user.email.split('@')[0],
          full_name: req.user.email.split('@')[0],
          subscription_tier: 'free',
          total_processing_time: 0,
          total_jobs_completed: 0
        };

        const { data: createdProfile, error: createError } = await req.supabase!
          .from('user_profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        const response: ApiResponse<UserProfile> = {
          success: true,
          data: {
            id: createdProfile.id,
            username: createdProfile.username,
            fullName: createdProfile.full_name,
            avatarUrl: createdProfile.avatar_url,
            subscriptionTier: createdProfile.subscription_tier,
            totalProcessingTime: createdProfile.total_processing_time,
            totalJobsCompleted: createdProfile.total_jobs_completed,
            createdAt: createdProfile.created_at,
            updatedAt: createdProfile.updated_at
          }
        };
        res.json(response);
        return;
      }
      throw error;
    }

    const response: ApiResponse<UserProfile> = {
      success: true,
      data: {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        subscriptionTier: profile.subscription_tier,
        totalProcessingTime: profile.total_processing_time,
        totalJobsCompleted: profile.total_jobs_completed,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Get profile error:', error);
    const response: ApiResponse<any> = {
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve user profile'
    };
    res.status(500).json(response);
  }
});

// Update user profile
router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'User not authenticated'
      };
      res.status(401).json(response);
      return;
    }

    const updateSchema = z.object({
      username: z.string().min(1).optional(),
      fullName: z.string().min(1).optional(),
      avatarUrl: z.string().url().optional()
    });

    const validatedData = updateSchema.parse(req.body);

    const updateData: any = {};
    if (validatedData.username) updateData.username = validatedData.username;
    if (validatedData.fullName) updateData.full_name = validatedData.fullName;
    if (validatedData.avatarUrl) updateData.avatar_url = validatedData.avatarUrl;
    updateData.updated_at = new Date().toISOString();

    const { data: updatedProfile, error } = await req.supabase!
      .from('user_profiles')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const response: ApiResponse<UserProfile> = {
      success: true,
      data: {
        id: updatedProfile.id,
        username: updatedProfile.username,
        fullName: updatedProfile.full_name,
        avatarUrl: updatedProfile.avatar_url,
        subscriptionTier: updatedProfile.subscription_tier,
        totalProcessingTime: updatedProfile.total_processing_time,
        totalJobsCompleted: updatedProfile.total_jobs_completed,
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error instanceof z.ZodError) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid profile data',
        data: error.errors
      };
      res.status(400).json(response);
      return;
    }

    const response: ApiResponse<any> = {
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update user profile'
    };
    res.status(500).json(response);
  }
});

// Get user statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'User not authenticated'
      };
      res.status(401).json(response);
      return;
    }

    // Get job statistics
    const { data: jobStats, error: jobError } = await req.supabase!
      .from('dubbing_jobs')
      .select('status, processing_metrics')
      .eq('user_id', req.user.id);

    if (jobError) {
      throw jobError;
    }

    const stats = {
      totalJobs: jobStats.length,
      completedJobs: jobStats.filter(job => job.status === 'completed').length,
      failedJobs: jobStats.filter(job => job.status === 'failed').length,
      processingJobs: jobStats.filter(job => 
        ['uploaded', 'extracting_audio', 'transcribing', 'translating', 'generating_speech', 'assembling_audio'].includes(job.status)
      ).length,
      totalProcessingTime: jobStats.reduce((total, job) => {
        return total + (job.processing_metrics?.totalProcessingTime || 0);
      }, 0)
    };

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats
    };

    res.json(response);
  } catch (error) {
    console.error('Get stats error:', error);
    const response: ApiResponse<any> = {
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve user statistics'
    };
    res.status(500).json(response);
  }
});

export { router as userRoutes };
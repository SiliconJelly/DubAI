import { z } from 'zod';

// User Profile Schema
export const UserProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().optional(),
  subscriptionTier: z.enum(['free', 'basic', 'pro', 'enterprise']).default('free'),
  totalProcessingTime: z.number().default(0),
  totalJobsCompleted: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// Auth User Schema (from Supabase)
export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailConfirmed: z.boolean().default(false),
  createdAt: z.string(),
  lastSignInAt: z.string().optional()
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/contexts/AuthContext';
import { UserProfile, ApiResponse } from '@dubai/shared';
import { toast } from 'sonner';

interface UserStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  processingJobs: number;
  totalProcessingTime: number;
}

interface UpdateProfileData {
  username?: string;
  fullName?: string;
  avatarUrl?: string;
}

export function useUserProfile() {
  const { user, session } = useAuthContext();
  const queryClient = useQueryClient();

  // Get user profile
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile
  } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async (): Promise<UserProfile> => {
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch profile');
      }

      const data: ApiResponse<UserProfile> = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.message || 'Failed to fetch profile');
      }

      return data.data;
    },
    enabled: !!user && !!session?.access_token,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  // Get user statistics
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['userStats', user?.id],
    queryFn: async (): Promise<UserStats> => {
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/users/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch stats');
      }

      const data: ApiResponse<UserStats> = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.message || 'Failed to fetch stats');
      }

      return data.data;
    },
    enabled: !!user && !!session?.access_token,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updateData: UpdateProfileData): Promise<UserProfile> => {
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const data: ApiResponse<UserProfile> = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.message || 'Failed to update profile');
      }

      return data.data;
    },
    onSuccess: (updatedProfile) => {
      // Update the cache
      queryClient.setQueryData(['userProfile', user?.id], updatedProfile);
      toast.success('Profile updated successfully!');
    },
    onError: (error: Error) => {
      console.error('Profile update error:', error);
      toast.error(error.message || 'Failed to update profile');
    }
  });

  const updateProfile = useCallback((data: UpdateProfileData) => {
    return updateProfileMutation.mutateAsync(data);
  }, [updateProfileMutation]);

  const refreshData = useCallback(() => {
    refetchProfile();
    refetchStats();
  }, [refetchProfile, refetchStats]);

  return {
    // Profile data
    profile,
    profileLoading,
    profileError,
    
    // Stats data
    stats,
    statsLoading,
    statsError,
    
    // Actions
    updateProfile,
    refreshData,
    
    // Loading states
    isUpdating: updateProfileMutation.isPending,
    isLoading: profileLoading || statsLoading
  };
}
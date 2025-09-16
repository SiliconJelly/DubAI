import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cacheService } from '@/services/cacheService';
import { DubbingJob, UserProfile } from '@dubai/shared';

export interface UseCacheOptions {
  enablePersistence?: boolean;
  ttl?: number;
}

export function useCache(options: UseCacheOptions = {}) {
  const queryClient = useQueryClient();
  const { enablePersistence = true, ttl } = options;

  // Cache jobs data
  const cacheJobs = useCallback((jobs: DubbingJob[]) => {
    if (enablePersistence) {
      cacheService.setJobs(jobs, ttl);
    }
  }, [enablePersistence, ttl]);

  const getCachedJobs = useCallback((): DubbingJob[] | null => {
    if (!enablePersistence) return null;
    return cacheService.getJobs();
  }, [enablePersistence]);

  // Cache individual job
  const cacheJob = useCallback((job: DubbingJob) => {
    if (enablePersistence) {
      cacheService.setJob(job, ttl);
    }
  }, [enablePersistence, ttl]);

  const getCachedJob = useCallback((jobId: string): DubbingJob | null => {
    if (!enablePersistence) return null;
    return cacheService.getJob(jobId);
  }, [enablePersistence]);

  // Cache user profile
  const cacheUserProfile = useCallback((profile: UserProfile) => {
    if (enablePersistence) {
      cacheService.setUserProfile(profile, ttl);
    }
  }, [enablePersistence, ttl]);

  const getCachedUserProfile = useCallback((): UserProfile | null => {
    if (!enablePersistence) return null;
    return cacheService.getUserProfile();
  }, [enablePersistence]);

  // Cache user preferences
  const cacheUserPreferences = useCallback((preferences: Record<string, any>) => {
    if (enablePersistence) {
      cacheService.setUserPreferences(preferences, ttl);
    }
  }, [enablePersistence, ttl]);

  const getCachedUserPreferences = useCallback((): Record<string, any> | null => {
    if (!enablePersistence) return null;
    return cacheService.getUserPreferences();
  }, [enablePersistence]);

  const updateUserPreference = useCallback((key: string, value: any) => {
    if (enablePersistence) {
      cacheService.updateUserPreference(key, value);
    }
  }, [enablePersistence]);

  // Invalidate cache entries
  const invalidateJob = useCallback((jobId: string) => {
    cacheService.invalidateJob(jobId);
    // Also invalidate React Query cache
    queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }, [queryClient]);

  const invalidateAllJobs = useCallback(() => {
    cacheService.delete('jobs:list');
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }, [queryClient]);

  const clearCache = useCallback(() => {
    cacheService.clear();
    queryClient.clear();
  }, [queryClient]);

  // Preload cache from localStorage on mount
  useEffect(() => {
    if (!enablePersistence) return;

    // Try to populate React Query cache with cached data
    const cachedJobs = getCachedJobs();
    if (cachedJobs) {
      queryClient.setQueryData(['jobs'], cachedJobs);
    }

    const cachedProfile = getCachedUserProfile();
    if (cachedProfile) {
      queryClient.setQueryData(['user', 'profile'], cachedProfile);
    }
  }, [enablePersistence, getCachedJobs, getCachedUserProfile, queryClient]);

  return {
    // Job caching
    cacheJobs,
    getCachedJobs,
    cacheJob,
    getCachedJob,
    
    // User data caching
    cacheUserProfile,
    getCachedUserProfile,
    cacheUserPreferences,
    getCachedUserPreferences,
    updateUserPreference,
    
    // Cache management
    invalidateJob,
    invalidateAllJobs,
    clearCache,
    
    // Cache stats
    getCacheStats: () => cacheService.getStats()
  };
}

// Hook for managing user preferences specifically
export function useUserPreferences() {
  const { 
    getCachedUserPreferences, 
    updateUserPreference, 
    cacheUserPreferences 
  } = useCache();

  const getPreference = useCallback((key: string, defaultValue?: any) => {
    const preferences = getCachedUserPreferences() || {};
    return preferences[key] ?? defaultValue;
  }, [getCachedUserPreferences]);

  const setPreference = useCallback((key: string, value: any) => {
    updateUserPreference(key, value);
  }, [updateUserPreference]);

  const getPreferences = useCallback(() => {
    return getCachedUserPreferences() || {};
  }, [getCachedUserPreferences]);

  const setPreferences = useCallback((preferences: Record<string, any>) => {
    cacheUserPreferences(preferences);
  }, [cacheUserPreferences]);

  return {
    getPreference,
    setPreference,
    getPreferences,
    setPreferences
  };
}

export default useCache;
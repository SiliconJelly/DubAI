import React, { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { DubbingJob, CreateJobRequest, JobStatus, UserProfile } from '@dubai/shared';
import apiClient from '@/services/api';
import { cacheService } from '@/services/cacheService';
import { useCache } from '@/hooks/useCache';


// Enhanced query keys with cache invalidation
export const OPTIMIZED_QUERY_KEYS = {
  JOBS: 'optimized_jobs',
  JOB: 'optimized_job',
  USER_PROFILE: 'optimized_user_profile',
  USER_STATS: 'optimized_user_stats',
  HEALTH: 'optimized_health',
} as const;

interface UseOptimizedJobsOptions {
  limit?: number;
  status?: JobStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'progress';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  enableCache?: boolean;
  staleTime?: number;
}

// Optimized jobs query with caching and pagination
export const useOptimizedJobs = (options: UseOptimizedJobsOptions = {}) => {
  const { enableCache = true, staleTime = 30000, ...apiOptions } = options;
  const { cacheJobs, getCachedJobs } = useCache({ enablePersistence: enableCache });

  return useQuery({
    queryKey: [OPTIMIZED_QUERY_KEYS.JOBS, apiOptions],
    queryFn: async () => {
      // Try cache first if enabled
      if (enableCache) {
        const cached = getCachedJobs();
        if (cached && cached.length > 0) {
          // Return cached data immediately, but still fetch fresh data in background
          setTimeout(() => {
            apiClient.getJobs({ page: 1, limit: 20, ...apiOptions })
              .then(result => cacheJobs(result.jobs))
              .catch(console.error);
          }, 0);
          return { jobs: cached, pagination: { page: 1, limit: cached.length, total: cached.length, totalPages: 1, hasMore: false } };
        }
      }

      const result = await apiClient.getJobs({ page: 1, limit: 20, ...apiOptions });
      
      // Cache the results
      if (enableCache) {
        cacheJobs(result.jobs);
      }
      
      return result;
    },
    staleTime,
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Infinite query for lazy loading with caching
export const useOptimizedInfiniteJobs = (options: UseOptimizedJobsOptions = {}) => {
  const { enableCache = true, staleTime = 30000, ...apiOptions } = options;
  const { cacheJob } = useCache({ enablePersistence: enableCache });

  return useInfiniteQuery({
    queryKey: [OPTIMIZED_QUERY_KEYS.JOBS, 'infinite', apiOptions],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await apiClient.getJobs({ 
        ...apiOptions, 
        page: pageParam,
        limit: options.limit || 20 
      });
      
      // Cache individual jobs
      if (enableCache) {
        result.jobs.forEach(job => cacheJob(job));
      }
      
      return result;
    },
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime,
    gcTime: 5 * 60 * 1000,
  });
};

// Optimized single job query
export const useOptimizedJob = (jobId: string, options: { enableCache?: boolean; staleTime?: number } = {}) => {
  const { enableCache = true, staleTime = 10000 } = options;
  const { cacheJob, getCachedJob } = useCache({ enablePersistence: enableCache });

  return useQuery({
    queryKey: [OPTIMIZED_QUERY_KEYS.JOB, jobId],
    queryFn: async () => {
      // Try cache first
      if (enableCache) {
        const cached = getCachedJob(jobId);
        if (cached) {
          // Return cached data immediately, fetch fresh in background
          setTimeout(() => {
            apiClient.getJob(jobId)
              .then(job => cacheJob(job))
              .catch(console.error);
          }, 0);
          return cached;
        }
      }

      const job = await apiClient.getJob(jobId);
      
      if (enableCache) {
        cacheJob(job);
      }
      
      return job;
    },
    enabled: !!jobId,
    staleTime,
    gcTime: 5 * 60 * 1000,
  });
};

// Optimized user profile query
export const useOptimizedUserProfile = (options: { enableCache?: boolean; staleTime?: number } = {}) => {
  const { enableCache = true, staleTime = 60000 } = options; // 1 minute for profile
  const { cacheUserProfile, getCachedUserProfile } = useCache({ enablePersistence: enableCache });

  return useQuery({
    queryKey: [OPTIMIZED_QUERY_KEYS.USER_PROFILE],
    queryFn: async () => {
      // Try cache first
      if (enableCache) {
        const cached = getCachedUserProfile();
        if (cached) {
          // Return cached data immediately, fetch fresh in background
          setTimeout(() => {
            apiClient.getUserProfile()
              .then(profile => cacheUserProfile(profile))
              .catch(console.error);
          }, 0);
          return cached;
        }
      }

      const profile = await apiClient.getUserProfile();
      
      if (enableCache) {
        cacheUserProfile(profile);
      }
      
      return profile;
    },
    staleTime,
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Optimized mutations with cache invalidation
export const useOptimizedCreateJob = () => {
  const queryClient = useQueryClient();
  const { invalidateAllJobs } = useCache();
  
  return useMutation({
    mutationFn: (jobData: CreateJobRequest) => apiClient.createJob(jobData),
    onSuccess: (newJob) => {
      // Invalidate and refetch jobs list
      queryClient.invalidateQueries({ queryKey: [OPTIMIZED_QUERY_KEYS.JOBS] });
      
      // Add to cache
      cacheService.setJob(newJob);
      
      // Invalidate cache
      invalidateAllJobs();
    },
  });
};

export const useOptimizedDeleteJob = () => {
  const queryClient = useQueryClient();
  const { invalidateJob } = useCache();
  
  return useMutation({
    mutationFn: (jobId: string) => apiClient.deleteJob(jobId),
    onSuccess: (_, jobId) => {
      // Remove from React Query cache
      queryClient.removeQueries({ queryKey: [OPTIMIZED_QUERY_KEYS.JOB, jobId] });
      queryClient.invalidateQueries({ queryKey: [OPTIMIZED_QUERY_KEYS.JOBS] });
      
      // Remove from persistent cache
      invalidateJob(jobId);
    },
  });
};

// Hook for batch operations
export const useBatchOperations = () => {
  const queryClient = useQueryClient();
  const { clearCache } = useCache();

  const prefetchJob = useCallback(async (jobId: string) => {
    await queryClient.prefetchQuery({
      queryKey: [OPTIMIZED_QUERY_KEYS.JOB, jobId],
      queryFn: () => apiClient.getJob(jobId),
      staleTime: 10000,
    });
  }, [queryClient]);

  const prefetchJobs = useCallback(async (options: UseOptimizedJobsOptions = {}) => {
    await queryClient.prefetchQuery({
      queryKey: [OPTIMIZED_QUERY_KEYS.JOBS, options],
      queryFn: () => apiClient.getJobs({ page: 1, limit: 20, ...options }),
      staleTime: 30000,
    });
  }, [queryClient]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
    clearCache();
  }, [queryClient, clearCache]);

  const preloadNextPage = useCallback(async (currentPage: number, options: UseOptimizedJobsOptions = {}) => {
    await queryClient.prefetchQuery({
      queryKey: [OPTIMIZED_QUERY_KEYS.JOBS, { ...options, page: currentPage + 1 }],
      queryFn: () => apiClient.getJobs({ page: currentPage + 1, limit: 20, ...options }),
      staleTime: 30000,
    });
  }, [queryClient]);

  return {
    prefetchJob,
    prefetchJobs,
    invalidateAll,
    preloadNextPage,
  };
};

// Hook for search with debouncing and caching
export const useOptimizedJobSearch = (searchTerm: string, options: UseOptimizedJobsOptions = {}) => {
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  return useOptimizedJobs({
    ...options,
    search: debouncedSearch,
    staleTime: 60000, // Cache search results longer
  });
};

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default {
  useOptimizedJobs,
  useOptimizedInfiniteJobs,
  useOptimizedJob,
  useOptimizedUserProfile,
  useOptimizedCreateJob,
  useOptimizedDeleteJob,
  useBatchOperations,
  useOptimizedJobSearch,
};
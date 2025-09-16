import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { DubbingJob, CreateJobRequest, JobStatus } from '@dubai/shared';
import apiClient from '../services/api';

// Query Keys
export const QUERY_KEYS = {
  JOBS: 'jobs',
  JOB: 'job',
  HEALTH: 'health',
} as const;

// Jobs Queries
export const useJobs = (options: {
  page?: number;
  limit?: number;
  status?: JobStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'progress';
  sortOrder?: 'asc' | 'desc';
  search?: string;
} = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.JOBS, options],
    queryFn: () => apiClient.getJobs(options),
    staleTime: 30000, // 30 seconds
  });
};

// Infinite query for paginated jobs
export const useInfiniteJobs = (options: {
  limit?: number;
  status?: JobStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'progress';
  sortOrder?: 'asc' | 'desc';
  search?: string;
} = {}) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.JOBS, 'infinite', options],
    queryFn: ({ pageParam = 1 }) => 
      apiClient.getJobs({ ...options, page: pageParam }),
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 30000,
  });
};

export const useJob = (jobId: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.JOB, jobId],
    queryFn: () => apiClient.getJob(jobId),
    enabled: !!jobId,
    staleTime: 10000, // 10 seconds
  });
};

// Jobs Mutations
export const useCreateJob = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (jobData: CreateJobRequest) => apiClient.createJob(jobData),
    onSuccess: () => {
      // Invalidate and refetch jobs list
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS] });
    },
  });
};

export const useDeleteJob = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (jobId: string) => apiClient.deleteJob(jobId),
    onSuccess: () => {
      // Invalidate and refetch jobs list
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOBS] });
    },
  });
};

// Health Check
export const useHealthCheck = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.HEALTH],
    queryFn: () => apiClient.healthCheck(),
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 25000, // 25 seconds
  });
};
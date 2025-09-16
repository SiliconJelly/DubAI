import { renderHook, act } from '@testing-library/react';
import { useCache } from '../useCache';
import { cacheService } from '@/services/cacheService';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the cache service
vi.mock('@/services/cacheService', () => ({
  cacheService: {
    setJobs: vi.fn(),
    getJobs: vi.fn(),
    setJob: vi.fn(),
    getJob: vi.fn(),
    setUserProfile: vi.fn(),
    getUserProfile: vi.fn(),
    setUserPreferences: vi.fn(),
    getUserPreferences: vi.fn(),
    updateUserPreference: vi.fn(),
    invalidateJob: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn(() => ({ size: 0, maxSize: 100, hitRate: 0, memoryUsage: 0 }))
  }
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    clear: vi.fn()
  })
}));

describe('useCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cache and retrieve jobs', () => {
    const { result } = renderHook(() => useCache());
    
    const mockJobs: DubbingJob[] = [
      {
        id: '1',
        userId: 'user1',
        title: 'Test Job',
        status: JobStatus.COMPLETED,
        progress: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processingMetrics: {
          steps: [],
          totalDuration: 1000,
          totalCost: 0.1,
          ttsService: 'google'
        }
      }
    ];

    act(() => {
      result.current.cacheJobs(mockJobs);
    });

    expect(cacheService.setJobs).toHaveBeenCalledWith(mockJobs, undefined);
  });

  it('should cache and retrieve individual job', () => {
    const { result } = renderHook(() => useCache());
    
    const mockJob: DubbingJob = {
      id: '1',
      userId: 'user1',
      title: 'Test Job',
      status: JobStatus.COMPLETED,
      progress: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingMetrics: {
        steps: [],
        totalDuration: 1000,
        totalCost: 0.1,
        ttsService: 'google'
      }
    };

    act(() => {
      result.current.cacheJob(mockJob);
    });

    expect(cacheService.setJob).toHaveBeenCalledWith(mockJob, undefined);
  });

  it('should invalidate job cache', () => {
    const { result } = renderHook(() => useCache());
    
    act(() => {
      result.current.invalidateJob('job1');
    });

    expect(cacheService.invalidateJob).toHaveBeenCalledWith('job1');
  });

  it('should clear all cache', () => {
    const { result } = renderHook(() => useCache());
    
    act(() => {
      result.current.clearCache();
    });

    expect(cacheService.clear).toHaveBeenCalled();
  });

  it('should get cache stats', () => {
    const { result } = renderHook(() => useCache());
    
    const stats = result.current.getCacheStats();
    
    expect(stats).toEqual({ size: 0, maxSize: 100, hitRate: 0, memoryUsage: 0 });
    expect(cacheService.getStats).toHaveBeenCalled();
  });
});
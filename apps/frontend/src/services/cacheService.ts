import { DubbingJob, UserProfile } from '@dubai/shared';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

export interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
  version: string; // Cache version for invalidation
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private readonly STORAGE_KEY = 'dubai_cache';

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      version: '1.0.0',
      ...config
    };

    this.loadFromStorage();
    this.startCleanupInterval();
  }

  // Generic cache methods
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.config.defaultTTL);

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt,
      version: this.config.version
    };

    this.cache.set(key, entry);
    this.saveToStorage();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired or version mismatch
    if (Date.now() > entry.expiresAt || entry.version !== this.config.version) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.expiresAt || entry.version !== this.config.version) {
      this.cache.delete(key);
      this.saveToStorage();
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.saveToStorage();
  }

  // Specialized methods for different data types
  
  // Job caching
  setJob(job: DubbingJob, ttl?: number): void {
    this.set(`job:${job.id}`, job, ttl);
  }

  getJob(jobId: string): DubbingJob | null {
    return this.get<DubbingJob>(`job:${jobId}`);
  }

  setJobs(jobs: DubbingJob[], ttl?: number): void {
    this.set('jobs:list', jobs, ttl);
    // Also cache individual jobs
    jobs.forEach(job => this.setJob(job, ttl));
  }

  getJobs(): DubbingJob[] | null {
    return this.get<DubbingJob[]>('jobs:list');
  }

  invalidateJob(jobId: string): void {
    this.delete(`job:${jobId}`);
    // Also invalidate jobs list to ensure consistency
    this.delete('jobs:list');
  }

  // User profile caching
  setUserProfile(profile: UserProfile, ttl?: number): void {
    this.set('user:profile', profile, ttl || 10 * 60 * 1000); // 10 minutes for profile
  }

  getUserProfile(): UserProfile | null {
    return this.get<UserProfile>('user:profile');
  }

  // User preferences caching
  setUserPreferences(preferences: Record<string, any>, ttl?: number): void {
    this.set('user:preferences', preferences, ttl || 24 * 60 * 60 * 1000); // 24 hours for preferences
  }

  getUserPreferences(): Record<string, any> | null {
    return this.get<Record<string, any>>('user:preferences');
  }

  updateUserPreference(key: string, value: any): void {
    const preferences = this.getUserPreferences() || {};
    preferences[key] = value;
    this.setUserPreferences(preferences);
  }

  // File metadata caching
  setFileMetadata(fileId: string, metadata: any, ttl?: number): void {
    this.set(`file:${fileId}`, metadata, ttl);
  }

  getFileMetadata(fileId: string): any | null {
    return this.get(`file:${fileId}`);
  }

  // API response caching
  setCachedResponse(endpoint: string, params: Record<string, any>, response: any, ttl?: number): void {
    const key = this.generateCacheKey(endpoint, params);
    this.set(`api:${key}`, response, ttl);
  }

  getCachedResponse(endpoint: string, params: Record<string, any>): any | null {
    const key = this.generateCacheKey(endpoint, params);
    return this.get(`api:${key}`);
  }

  // Utility methods
  private generateCacheKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${endpoint}?${sortedParams}`;
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt || entry.version !== this.config.version) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.saveToStorage();
    }
  }

  private saveToStorage(): void {
    try {
      const cacheData = Array.from(this.cache.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const cacheData = JSON.parse(stored);
        this.cache = new Map(cacheData);
        // Clean up any expired entries
        this.cleanup();
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
      this.cache.clear();
    }
  }

  // Cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: 0, // Would need to track hits/misses for this
      memoryUsage: JSON.stringify(Array.from(this.cache.entries())).length
    };
  }
}

// Create singleton instance
export const cacheService = new CacheService({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 200,
  version: '1.0.0'
});

export default cacheService;
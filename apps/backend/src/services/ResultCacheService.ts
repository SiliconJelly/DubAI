import { TranslationEngineResult } from './TranslationEngine';

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export interface ResultCacheService {
  store(key: string, result: TranslationEngineResult, ttl?: number): Promise<void>;
  retrieve(key: string): Promise<TranslationEngineResult | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
  cleanup(): Promise<number>; // Returns number of entries cleaned up
}

export interface CacheConfig {
  maxEntries: number;
  defaultTTL: number; // seconds
  cleanupInterval: number; // seconds
  enableCompression: boolean;
  enablePersistence: boolean;
  persistenceDirectory?: string;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 1000,
  defaultTTL: 86400, // 24 hours
  cleanupInterval: 3600, // 1 hour
  enableCompression: true,
  enablePersistence: true,
  persistenceDirectory: './cache/results'
};
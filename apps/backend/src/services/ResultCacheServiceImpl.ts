import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { TranslationEngineResult } from './TranslationEngine';
import { 
  ResultCacheService, 
  CacheEntry, 
  CacheStats, 
  CacheConfig, 
  DEFAULT_CACHE_CONFIG 
} from './ResultCacheService';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class ResultCacheServiceImpl implements ResultCacheService {
  private cache: Map<string, CacheEntry<TranslationEngineResult>> = new Map();
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private stats = {
    hits: 0,
    misses: 0,
    stores: 0,
    deletes: 0
  };

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config;
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    // Create persistence directory if needed
    if (this.config.enablePersistence && this.config.persistenceDirectory) {
      try {
        await fs.mkdir(this.config.persistenceDirectory, { recursive: true });
      } catch (error) {
        console.warn('Failed to create cache persistence directory:', error);
      }
    }

    // Load persisted cache entries
    if (this.config.enablePersistence) {
      await this.loadPersistedEntries();
    }

    // Start cleanup timer
    this.startCleanupTimer();
  }

  async store(key: string, result: TranslationEngineResult, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.config.defaultTTL;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + effectiveTTL * 1000);

    const entry: CacheEntry<TranslationEngineResult> = {
      key,
      value: result,
      createdAt: now,
      expiresAt,
      accessCount: 0,
      lastAccessed: now
    };

    // Check if we need to evict entries to make room
    if (this.cache.size >= this.config.maxEntries) {
      await this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, entry);
    this.stats.stores++;

    // Persist to disk if enabled
    if (this.config.enablePersistence) {
      await this.persistEntry(key, entry);
    }
  }

  async retrieve(key: string): Promise<TranslationEngineResult | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      
      // Try to load from persistence
      if (this.config.enablePersistence) {
        const persistedEntry = await this.loadPersistedEntry(key);
        if (persistedEntry && !this.isExpired(persistedEntry)) {
          this.cache.set(key, persistedEntry);
          this.updateAccessStats(persistedEntry);
          this.stats.hits++;
          return persistedEntry.value;
        }
      }
      
      return null;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      await this.delete(key);
      this.stats.misses++;
      return null;
    }

    this.updateAccessStats(entry);
    this.stats.hits++;
    return entry.value;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      // Check persistence
      if (this.config.enablePersistence) {
        const persistedEntry = await this.loadPersistedEntry(key);
        return persistedEntry !== null && !this.isExpired(persistedEntry);
      }
      return false;
    }

    return !this.isExpired(entry);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.stats.deletes++;
    }

    // Delete from persistence
    if (this.config.enablePersistence && this.config.persistenceDirectory) {
      try {
        const filePath = this.getPersistedFilePath(key);
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, which is fine
      }
    }

    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, stores: 0, deletes: 0 };

    // Clear persistence directory
    if (this.config.enablePersistence && this.config.persistenceDirectory) {
      try {
        const files = await fs.readdir(this.config.persistenceDirectory);
        for (const file of files) {
          if (file.endsWith('.cache')) {
            await fs.unlink(path.join(this.config.persistenceDirectory, file));
          }
        }
      } catch (error) {
        console.warn('Failed to clear cache persistence directory:', error);
      }
    }
  }

  async getStats(): Promise<CacheStats> {
    const entries = Array.from(this.cache.values());
    const totalRequests = this.stats.hits + this.stats.misses;
    
    let totalSize = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of entries) {
      // Estimate size (rough calculation)
      totalSize += JSON.stringify(entry.value).length;
      
      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      oldestEntry,
      newestEntry
    };
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    // Clean up expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        await this.delete(key);
        cleanedCount++;
      }
    }

    // Clean up persisted files if enabled
    if (this.config.enablePersistence && this.config.persistenceDirectory) {
      try {
        const files = await fs.readdir(this.config.persistenceDirectory);
        for (const file of files) {
          if (file.endsWith('.cache')) {
            const filePath = path.join(this.config.persistenceDirectory, file);
            const stats = await fs.stat(filePath);
            const fileAge = now.getTime() - stats.mtime.getTime();
            
            // Delete files older than 2x the default TTL
            if (fileAge > this.config.defaultTTL * 2 * 1000) {
              await fs.unlink(filePath);
              cleanedCount++;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to cleanup persisted cache files:', error);
      }
    }

    return cleanedCount;
  }

  private isExpired(entry: CacheEntry<TranslationEngineResult>): boolean {
    return new Date() > entry.expiresAt;
  }

  private updateAccessStats(entry: CacheEntry<TranslationEngineResult>): void {
    entry.accessCount++;
    entry.lastAccessed = new Date();
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.cache.size === 0) return;

    let lruKey: string | null = null;
    let lruTime = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      await this.delete(lruKey);
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Only start cleanup timer in non-test environments
    if (process.env['NODE_ENV'] !== 'test') {
      this.cleanupTimer = setInterval(async () => {
        try {
          await this.cleanup();
        } catch (error) {
          console.error('Cache cleanup failed:', error);
        }
      }, this.config.cleanupInterval * 1000);
    }
  }

  private getPersistedFilePath(key: string): string {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.config.persistenceDirectory!, `${hash}.cache`);
  }

  private async persistEntry(key: string, entry: CacheEntry<TranslationEngineResult>): Promise<void> {
    if (!this.config.persistenceDirectory) return;

    try {
      const filePath = this.getPersistedFilePath(key);
      let data = JSON.stringify(entry);

      if (this.config.enableCompression) {
        const compressed = await gzip(Buffer.from(data));
        await fs.writeFile(filePath, compressed);
      } else {
        await fs.writeFile(filePath, data);
      }
    } catch (error) {
      console.warn('Failed to persist cache entry:', error);
    }
  }

  private async loadPersistedEntry(key: string): Promise<CacheEntry<TranslationEngineResult> | null> {
    if (!this.config.persistenceDirectory) return null;

    try {
      const filePath = this.getPersistedFilePath(key);
      const fileData = await fs.readFile(filePath);

      let data: string;
      if (this.config.enableCompression) {
        const decompressed = await gunzip(fileData);
        data = decompressed.toString();
      } else {
        data = fileData.toString();
      }

      const entry = JSON.parse(data) as CacheEntry<TranslationEngineResult>;
      
      // Convert date strings back to Date objects
      entry.createdAt = new Date(entry.createdAt);
      entry.expiresAt = new Date(entry.expiresAt);
      entry.lastAccessed = new Date(entry.lastAccessed);

      return entry;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  private async loadPersistedEntries(): Promise<void> {
    if (!this.config.persistenceDirectory) return;

    try {
      const files = await fs.readdir(this.config.persistenceDirectory);
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          const hash = file.replace('.cache', '');
          
          // We can't reverse the hash to get the original key,
          // so we'll load entries on-demand in the retrieve method
          // This is a limitation of the current implementation
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted cache entries:', error);
    }
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
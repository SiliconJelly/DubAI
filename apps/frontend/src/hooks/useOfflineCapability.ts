import { useState, useEffect } from 'react';

export interface OfflineCapability {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
  offlineData: any[];
  saveOfflineData: (key: string, data: any) => void;
  getOfflineData: (key: string) => any;
  clearOfflineData: (key: string) => void;
  syncOfflineData: () => Promise<void>;
}

const OFFLINE_STORAGE_PREFIX = 'dubai_offline_';

export function useOfflineCapability(): OfflineCapability {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [offlineData, setOfflineData] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Trigger sync when coming back online
        syncOfflineData();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load offline data on mount
    loadOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const saveOfflineData = (key: string, data: any) => {
    try {
      const storageKey = `${OFFLINE_STORAGE_PREFIX}${key}`;
      localStorage.setItem(storageKey, JSON.stringify({
        data,
        timestamp: Date.now(),
        synced: false
      }));
      loadOfflineData();
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  };

  const getOfflineData = (key: string) => {
    try {
      const storageKey = `${OFFLINE_STORAGE_PREFIX}${key}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.data;
      }
    } catch (error) {
      console.error('Failed to get offline data:', error);
    }
    return null;
  };

  const clearOfflineData = (key: string) => {
    try {
      const storageKey = `${OFFLINE_STORAGE_PREFIX}${key}`;
      localStorage.removeItem(storageKey);
      loadOfflineData();
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  };

  const loadOfflineData = () => {
    try {
      const data: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(OFFLINE_STORAGE_PREFIX)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            data.push({
              key: key.replace(OFFLINE_STORAGE_PREFIX, ''),
              ...parsed
            });
          }
        }
      }
      setOfflineData(data);
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  const syncOfflineData = async () => {
    if (!isOnline) return;

    try {
      // Get all unsynced offline data
      const unsyncedData = offlineData.filter(item => !item.synced);
      
      for (const item of unsyncedData) {
        try {
          // Here you would implement the actual sync logic
          // For now, we'll just mark as synced
          const storageKey = `${OFFLINE_STORAGE_PREFIX}${item.key}`;
          const updated = { ...item, synced: true };
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (error) {
          console.error(`Failed to sync item ${item.key}:`, error);
        }
      }
      
      loadOfflineData();
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  };

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    offlineData,
    saveOfflineData,
    getOfflineData,
    clearOfflineData,
    syncOfflineData
  };
}
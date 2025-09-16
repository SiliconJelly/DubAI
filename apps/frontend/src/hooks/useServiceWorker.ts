import { useState, useEffect, useCallback } from 'react';

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isInstalling: boolean;
  isWaiting: boolean;
  isControlling: boolean;
  registration: ServiceWorkerRegistration | null;
  error: Error | null;
}

export interface ServiceWorkerActions {
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  update: () => Promise<void>;
  skipWaiting: () => void;
  clearCache: () => Promise<void>;
  getCacheStatus: () => Promise<Record<string, number>>;
  cacheJobData: (jobData: any) => void;
}

export function useServiceWorker(): ServiceWorkerState & ServiceWorkerActions {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isInstalling: false,
    isWaiting: false,
    isControlling: false,
    registration: null,
    error: null,
  });

  // Register service worker
  const register = useCallback(async () => {
    if (!state.isSupported) {
      throw new Error('Service Worker is not supported in this browser');
    }

    try {
      setState(prev => ({ ...prev, isInstalling: true, error: null }));

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully:', registration);

      setState(prev => ({
        ...prev,
        isRegistered: true,
        isInstalling: false,
        registration,
        isControlling: !!navigator.serviceWorker.controller,
      }));

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          setState(prev => ({ ...prev, isInstalling: true }));

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              setState(prev => ({
                ...prev,
                isInstalling: false,
                isWaiting: navigator.serviceWorker.controller !== null,
              }));
            }
          });
        }
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
      setState(prev => ({
        ...prev,
        isInstalling: false,
        error: error instanceof Error ? error : new Error('Registration failed'),
      }));
      throw error;
    }
  }, [state.isSupported]);

  // Unregister service worker
  const unregister = useCallback(async () => {
    if (!state.registration) {
      return;
    }

    try {
      const result = await state.registration.unregister();
      if (result) {
        setState(prev => ({
          ...prev,
          isRegistered: false,
          registration: null,
          isControlling: false,
        }));
        console.log('Service Worker unregistered successfully');
      }
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Unregistration failed'),
      }));
      throw error;
    }
  }, [state.registration]);

  // Update service worker
  const update = useCallback(async () => {
    if (!state.registration) {
      return;
    }

    try {
      await state.registration.update();
      console.log('Service Worker update check completed');
    } catch (error) {
      console.error('Service Worker update failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Update failed'),
      }));
      throw error;
    }
  }, [state.registration]);

  // Skip waiting and activate new service worker
  const skipWaiting = useCallback(() => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [state.registration]);

  // Clear all caches
  const clearCache = useCallback(async () => {
    if (!state.registration) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve();
        }
      };

      if (state.registration.active) {
        state.registration.active.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );
      }
    });
  }, [state.registration]);

  // Get cache status
  const getCacheStatus = useCallback(async (): Promise<Record<string, number>> => {
    if (!state.registration) {
      return {};
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      if (state.registration.active) {
        state.registration.active.postMessage(
          { type: 'GET_CACHE_STATUS' },
          [messageChannel.port2]
        );
      }
    });
  }, [state.registration]);

  // Cache job data for offline access
  const cacheJobData = useCallback((jobData: any) => {
    if (state.registration?.active) {
      state.registration.active.postMessage({
        type: 'CACHE_JOB_DATA',
        payload: jobData,
      });
    }
  }, [state.registration]);

  // Set up event listeners
  useEffect(() => {
    if (!state.isSupported) return;

    const handleControllerChange = () => {
      setState(prev => ({
        ...prev,
        isControlling: !!navigator.serviceWorker.controller,
      }));
    };

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'SYNC_COMPLETE':
          console.log('Service Worker: Background sync completed');
          // Trigger data refresh
          window.dispatchEvent(new CustomEvent('sw-sync-complete', { detail: payload }));
          break;
          
        default:
          console.log('Service Worker: Received message', type, payload);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Check if already registered
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration) {
        setState(prev => ({
          ...prev,
          isRegistered: true,
          registration,
          isControlling: !!navigator.serviceWorker.controller,
        }));
      }
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [state.isSupported]);

  // Auto-register on mount
  useEffect(() => {
    if (state.isSupported && !state.isRegistered && !state.isInstalling) {
      register().catch(console.error);
    }
  }, [state.isSupported, state.isRegistered, state.isInstalling, register]);

  return {
    ...state,
    register,
    unregister,
    update,
    skipWaiting,
    clearCache,
    getCacheStatus,
    cacheJobData,
  };
}

// Hook for offline detection with service worker integration
export function useOfflineDetection() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const serviceWorker = useServiceWorker();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Trigger background sync when coming back online
        if (serviceWorker.registration?.sync) {
          serviceWorker.registration.sync.register('background-sync-jobs');
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    const handleSyncComplete = () => {
      // Refresh data after sync
      window.location.reload();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sw-sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sw-sync-complete', handleSyncComplete);
    };
  }, [wasOffline, serviceWorker.registration]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    serviceWorker,
  };
}

export default useServiceWorker;
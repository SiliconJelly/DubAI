import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { performanceService, PerformanceMetrics, AnalyticsEvent } from '@/services/performanceService';
import { useAuth } from '@/hooks/useAuth';

export interface UsePerformanceMonitoringOptions {
  trackPageViews?: boolean;
  trackUserInteractions?: boolean;
  trackApiCalls?: boolean;
  trackErrors?: boolean;
  enableRealTimeMetrics?: boolean;
}

export function usePerformanceMonitoring(options: UsePerformanceMonitoringOptions = {}) {
  const {
    trackPageViews = true,
    trackUserInteractions = true,
    trackApiCalls = true,
    trackErrors = true,
    enableRealTimeMetrics = false
  } = options;

  const location = useLocation();
  const { user } = useAuth();
  const previousPath = useRef<string>('');

  // Set user ID when available
  useEffect(() => {
    if (user?.id) {
      performanceService.setUserId(user.id);
    }
  }, [user?.id]);

  // Track page views
  useEffect(() => {
    if (trackPageViews && location.pathname !== previousPath.current) {
      performanceService.trackPageView(location.pathname);
      previousPath.current = location.pathname;
    }
  }, [location.pathname, trackPageViews]);

  // Track user interactions
  const trackInteraction = useCallback((action: string, element?: string, properties?: Record<string, any>) => {
    if (trackUserInteractions) {
      performanceService.trackUserInteraction(action, element, properties);
    }
  }, [trackUserInteractions]);

  // Track API calls
  const trackApiCall = useCallback((endpoint: string, method: string, duration: number, status: number) => {
    if (trackApiCalls) {
      performanceService.trackApiCall(endpoint, method, duration, status);
    }
  }, [trackApiCalls]);

  // Track feature usage
  const trackFeature = useCallback((feature: string, properties?: Record<string, any>) => {
    performanceService.trackFeatureUsage(feature, properties);
  }, []);

  // Track custom events
  const trackEvent = useCallback((event: Omit<AnalyticsEvent, 'timestamp' | 'sessionId'>) => {
    performanceService.trackEvent(event);
  }, []);

  // Track errors
  const trackError = useCallback((error: Error, context?: Record<string, any>) => {
    if (trackErrors) {
      performanceService.trackError({
        message: error.message,
        stack: error.stack,
        ...context
      });
    }
  }, [trackErrors]);

  // Get current metrics
  const getMetrics = useCallback((): PerformanceMetrics => {
    return performanceService.getMetrics();
  }, []);

  // Get session ID
  const getSessionId = useCallback((): string => {
    return performanceService.getSessionId();
  }, []);

  return {
    trackInteraction,
    trackApiCall,
    trackFeature,
    trackEvent,
    trackError,
    getMetrics,
    getSessionId
  };
}

// Hook for measuring component render performance
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    performanceService.measureRenderTime(componentName, renderTime);
  });

  const measureOperation = useCallback((operationName: string, operation: () => void | Promise<void>) => {
    const startTime = performance.now();
    
    const result = operation();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - startTime;
        performanceService.trackEvent({
          name: 'async_operation_duration',
          category: 'performance',
          properties: {
            componentName,
            operationName,
            duration
          }
        });
      });
    } else {
      const duration = performance.now() - startTime;
      performanceService.trackEvent({
        name: 'sync_operation_duration',
        category: 'performance',
        properties: {
          componentName,
          operationName,
          duration
        }
      });
      return result;
    }
  }, [componentName]);

  return { measureOperation };
}

// Hook for tracking API performance
export function useApiPerformanceTracking() {
  const { trackApiCall } = usePerformanceMonitoring();

  const wrapApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> => {
    const startTime = performance.now();
    let status = 0;

    try {
      const result = await apiCall();
      status = 200; // Assume success if no error
      return result;
    } catch (error) {
      status = error instanceof Error && 'status' in error ? (error as any).status : 500;
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      trackApiCall(endpoint, method, duration, status);
    }
  }, [trackApiCall]);

  return { wrapApiCall };
}

// Hook for tracking user engagement
export function useEngagementTracking() {
  const { trackInteraction, trackEvent } = usePerformanceMonitoring();
  const engagementStartTime = useRef<number>(Date.now());
  const lastActivityTime = useRef<number>(Date.now());
  const isActive = useRef<boolean>(true);

  useEffect(() => {
    const handleActivity = () => {
      lastActivityTime.current = Date.now();
      if (!isActive.current) {
        isActive.current = true;
        trackEvent({
          name: 'user_became_active',
          category: 'user_interaction',
          properties: {
            inactiveTime: Date.now() - lastActivityTime.current
          }
        });
      }
    };

    const handleInactivity = () => {
      if (isActive.current) {
        isActive.current = false;
        trackEvent({
          name: 'user_became_inactive',
          category: 'user_interaction',
          properties: {
            activeTime: Date.now() - lastActivityTime.current
          }
        });
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Check for inactivity every 30 seconds
    const inactivityTimer = setInterval(() => {
      if (Date.now() - lastActivityTime.current > 30000) { // 30 seconds
        handleInactivity();
      }
    }, 30000);

    // Track session duration on unmount
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(inactivityTimer);

      const sessionDuration = Date.now() - engagementStartTime.current;
      trackEvent({
        name: 'session_duration',
        category: 'user_interaction',
        properties: {
          duration: sessionDuration,
          wasActive: isActive.current
        }
      });
    };
  }, [trackEvent, trackInteraction]);

  const trackEngagement = useCallback((action: string, properties?: Record<string, any>) => {
    trackInteraction(action, undefined, {
      ...properties,
      sessionTime: Date.now() - engagementStartTime.current
    });
  }, [trackInteraction]);

  return { trackEngagement };
}

export default usePerformanceMonitoring;
// Performance monitoring and analytics service

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  pageLoadTime?: number;
  apiResponseTime?: number;
  renderTime?: number;
  interactionTime?: number;
  
  // Resource metrics
  jsHeapSize?: number;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  
  // Network metrics
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  
  // User context
  userAgent?: string;
  viewport?: { width: number; height: number };
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  timestamp?: number;
  url?: string;
  userId?: string;
}

export interface AnalyticsEvent {
  name: string;
  category: 'user_interaction' | 'performance' | 'error' | 'business';
  properties?: Record<string, any>;
  timestamp?: number;
  userId?: string;
  sessionId?: string;
}

class PerformanceService {
  private metrics: PerformanceMetrics = {};
  private observer: PerformanceObserver | null = null;
  private sessionId: string;
  private startTime: number;
  private isEnabled: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = performance.now();
    this.isEnabled = !import.meta.env.DEV; // Disable in development
    
    if (this.isEnabled) {
      this.initializePerformanceObserver();
      this.collectInitialMetrics();
      this.setupEventListeners();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializePerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      // Observe Core Web Vitals
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry);
        }
      });

      // Observe different types of performance entries
      const entryTypes = ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift', 'navigation', 'resource'];
      
      entryTypes.forEach(type => {
        try {
          this.observer!.observe({ type, buffered: true });
        } catch (error) {
          console.warn(`Failed to observe ${type}:`, error);
        }
      });
    } catch (error) {
      console.error('Failed to initialize PerformanceObserver:', error);
    }
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          this.metrics.fcp = entry.startTime;
        }
        break;
        
      case 'largest-contentful-paint':
        this.metrics.lcp = (entry as any).startTime;
        break;
        
      case 'first-input':
        this.metrics.fid = (entry as any).processingStart - entry.startTime;
        break;
        
      case 'layout-shift':
        if (!(entry as any).hadRecentInput) {
          this.metrics.cls = (this.metrics.cls || 0) + (entry as any).value;
        }
        break;
        
      case 'navigation':
        const navEntry = entry as PerformanceNavigationTiming;
        this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        this.metrics.pageLoadTime = navEntry.loadEventEnd - navEntry.navigationStart;
        break;
        
      case 'resource':
        // Track API response times
        const resourceEntry = entry as PerformanceResourceTiming;
        if (resourceEntry.name.includes('/api/')) {
          this.trackApiResponseTime(resourceEntry);
        }
        break;
    }
  }

  private trackApiResponseTime(entry: PerformanceResourceTiming): void {
    const responseTime = entry.responseEnd - entry.requestStart;
    const endpoint = new URL(entry.name).pathname;
    
    this.trackEvent({
      name: 'api_response_time',
      category: 'performance',
      properties: {
        endpoint,
        responseTime,
        method: 'GET', // Would need to track this separately for other methods
        status: 'success', // Would need response status
      }
    });
  }

  private collectInitialMetrics(): void {
    // Collect memory information
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.jsHeapSize = memory.jsHeapSizeLimit;
      this.metrics.usedJSHeapSize = memory.usedJSHeapSize;
      this.metrics.totalJSHeapSize = memory.totalJSHeapSize;
    }

    // Collect network information
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.metrics.connectionType = connection.type;
      this.metrics.effectiveType = connection.effectiveType;
      this.metrics.downlink = connection.downlink;
      this.metrics.rtt = connection.rtt;
    }

    // Collect viewport information
    this.metrics.viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Detect device type
    this.metrics.deviceType = this.getDeviceType();
    
    // Other context
    this.metrics.userAgent = navigator.userAgent;
    this.metrics.url = window.location.href;
    this.metrics.timestamp = Date.now();
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private setupEventListeners(): void {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.trackEvent({
        name: 'page_visibility_change',
        category: 'user_interaction',
        properties: {
          hidden: document.hidden,
          visibilityState: document.visibilityState
        }
      });
    });

    // Track unload events
    window.addEventListener('beforeunload', () => {
      this.sendMetrics();
    });

    // Track errors
    window.addEventListener('error', (event) => {
      this.trackError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        message: 'Unhandled Promise Rejection',
        reason: event.reason,
        stack: event.reason?.stack
      });
    });
  }

  // Public methods

  public trackEvent(event: Omit<AnalyticsEvent, 'timestamp' | 'sessionId'>): void {
    if (!this.isEnabled) return;

    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    // Store event locally
    this.storeEvent(fullEvent);

    // Send immediately for critical events
    if (event.category === 'error') {
      this.sendEvent(fullEvent);
    }
  }

  public trackError(error: {
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
    reason?: any;
  }): void {
    this.trackEvent({
      name: 'javascript_error',
      category: 'error',
      properties: error
    });
  }

  public trackUserInteraction(action: string, element?: string, properties?: Record<string, any>): void {
    this.trackEvent({
      name: 'user_interaction',
      category: 'user_interaction',
      properties: {
        action,
        element,
        ...properties
      }
    });
  }

  public trackPageView(path: string, title?: string): void {
    this.trackEvent({
      name: 'page_view',
      category: 'user_interaction',
      properties: {
        path,
        title: title || document.title,
        referrer: document.referrer
      }
    });
  }

  public trackApiCall(endpoint: string, method: string, duration: number, status: number): void {
    this.trackEvent({
      name: 'api_call',
      category: 'performance',
      properties: {
        endpoint,
        method,
        duration,
        status,
        success: status >= 200 && status < 300
      }
    });
  }

  public trackFeatureUsage(feature: string, properties?: Record<string, any>): void {
    this.trackEvent({
      name: 'feature_usage',
      category: 'business',
      properties: {
        feature,
        ...properties
      }
    });
  }

  public measureRenderTime(componentName: string, renderTime: number): void {
    this.trackEvent({
      name: 'component_render_time',
      category: 'performance',
      properties: {
        componentName,
        renderTime
      }
    });
  }

  public setUserId(userId: string): void {
    this.metrics.userId = userId;
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  private storeEvent(event: AnalyticsEvent): void {
    try {
      const events = this.getStoredEvents();
      events.push(event);
      
      // Keep only last 100 events to prevent storage bloat
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }
      
      localStorage.setItem('dubai_analytics_events', JSON.stringify(events));
    } catch (error) {
      console.warn('Failed to store analytics event:', error);
    }
  }

  private getStoredEvents(): AnalyticsEvent[] {
    try {
      const stored = localStorage.getItem('dubai_analytics_events');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to retrieve stored events:', error);
      return [];
    }
  }

  private sendEvent(event: AnalyticsEvent): void {
    // In a real implementation, you would send to your analytics service
    // For now, we'll just log it
    console.log('Analytics Event:', event);
    
    // Example: Send to analytics service
    // fetch('/api/analytics/events', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event)
    // }).catch(console.error);
  }

  public sendMetrics(): void {
    if (!this.isEnabled) return;

    // Update final metrics
    this.metrics.timestamp = Date.now();
    
    // Send metrics
    console.log('Performance Metrics:', this.metrics);
    
    // Send stored events
    const events = this.getStoredEvents();
    if (events.length > 0) {
      console.log('Analytics Events:', events);
      // Clear sent events
      localStorage.removeItem('dubai_analytics_events');
    }
    
    // In a real implementation:
    // fetch('/api/analytics/metrics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ metrics: this.metrics, events })
    // }).catch(console.error);
  }

  public enable(): void {
    this.isEnabled = true;
    if (!this.observer) {
      this.initializePerformanceObserver();
    }
  }

  public disable(): void {
    this.isEnabled = false;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  public destroy(): void {
    this.disable();
    this.sendMetrics();
  }
}

// Create singleton instance
export const performanceService = new PerformanceService();

export default performanceService;
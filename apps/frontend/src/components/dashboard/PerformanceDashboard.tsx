import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { cacheService } from '@/services/cacheService';
import { cn } from '@/lib/utils';
import { 
  Activity, 
  Zap, 
  Database, 
  Wifi, 
  WifiOff,
  RefreshCw,
  Trash2,
  TrendingUp,
  Clock,
  HardDrive
} from 'lucide-react';

interface PerformanceDashboardProps {
  className?: string;
}

export function PerformanceDashboard({ className }: PerformanceDashboardProps) {
  const { getMetrics, getSessionId } = usePerformanceMonitoring();
  const serviceWorker = useServiceWorker();
  const [metrics, setMetrics] = useState(getMetrics());
  const [cacheStats, setCacheStats] = useState(cacheService.getStats());
  const [swCacheStatus, setSwCacheStatus] = useState<Record<string, number>>({});

  // Update metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getMetrics());
      setCacheStats(cacheService.getStats());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [getMetrics]);

  // Get service worker cache status
  useEffect(() => {
    if (serviceWorker.isRegistered) {
      serviceWorker.getCacheStatus().then(setSwCacheStatus).catch(console.error);
    }
  }, [serviceWorker.isRegistered, serviceWorker.getCacheStatus]);

  const handleClearCache = async () => {
    try {
      cacheService.clear();
      await serviceWorker.clearCache();
      setCacheStats(cacheService.getStats());
      setSwCacheStatus({});
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const handleRefreshMetrics = () => {
    setMetrics(getMetrics());
    setCacheStats(cacheService.getStats());
    if (serviceWorker.isRegistered) {
      serviceWorker.getCacheStatus().then(setSwCacheStatus).catch(console.error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceScore = () => {
    let score = 100;
    
    // Deduct points for slow metrics
    if (metrics.fcp && metrics.fcp > 2000) score -= 20;
    if (metrics.lcp && metrics.lcp > 4000) score -= 20;
    if (metrics.fid && metrics.fid > 300) score -= 20;
    if (metrics.cls && metrics.cls > 0.25) score -= 20;
    if (metrics.ttfb && metrics.ttfb > 800) score -= 20;
    
    return Math.max(0, score);
  };

  const performanceScore = getPerformanceScore();
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Performance Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Session: {getSessionId().slice(-8)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearCache}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
        </div>
      </div>

      {/* Performance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Score</span>
                <span className={cn('text-2xl font-bold', getScoreColor(performanceScore))}>
                  {performanceScore}
                </span>
              </div>
              <Progress value={performanceScore} className="h-2" />
            </div>
            <Badge variant={performanceScore >= 90 ? 'default' : performanceScore >= 70 ? 'secondary' : 'destructive'}>
              {performanceScore >= 90 ? 'Excellent' : performanceScore >= 70 ? 'Good' : 'Needs Improvement'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">First Contentful Paint</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.fcp ? formatTime(metrics.fcp) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Good: &lt; 1.8s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Largest Contentful Paint</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.lcp ? formatTime(metrics.lcp) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Good: &lt; 2.5s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">First Input Delay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.fid ? formatTime(metrics.fid) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Good: &lt; 100ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cumulative Layout Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.cls ? metrics.cls.toFixed(3) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Good: &lt; 0.1
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Time to First Byte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.ttfb ? formatTime(metrics.ttfb) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Good: &lt; 800ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Page Load Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.pageLoadTime ? formatTime(metrics.pageLoadTime) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Total load time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Memory Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Memory Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Used JS Heap</p>
              <p className="text-2xl font-bold">
                {metrics.usedJSHeapSize ? formatBytes(metrics.usedJSHeapSize) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Total JS Heap</p>
              <p className="text-2xl font-bold">
                {metrics.totalJSHeapSize ? formatBytes(metrics.totalJSHeapSize) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">JS Heap Limit</p>
              <p className="text-2xl font-bold">
                {metrics.jsHeapSize ? formatBytes(metrics.jsHeapSize) : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Application Cache
            </CardTitle>
            <CardDescription>In-memory and localStorage cache</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Cache Entries</span>
                <span className="font-medium">{cacheStats.size} / {cacheStats.maxSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Memory Usage</span>
                <span className="font-medium">{formatBytes(cacheStats.memoryUsage)}</span>
              </div>
              <Progress value={(cacheStats.size / cacheStats.maxSize) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {serviceWorker.isRegistered ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              Service Worker Cache
            </CardTitle>
            <CardDescription>
              {serviceWorker.isRegistered ? 'Active and caching resources' : 'Not registered'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {serviceWorker.isRegistered ? (
              <div className="space-y-2">
                {Object.entries(swCacheStatus).map(([cacheName, count]) => (
                  <div key={cacheName} className="flex justify-between">
                    <span className="text-sm truncate">{cacheName}</span>
                    <span className="font-medium">{count} items</span>
                  </div>
                ))}
                {Object.keys(swCacheStatus).length === 0 && (
                  <p className="text-sm text-muted-foreground">No cached items</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Service Worker not available</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Network Information */}
      {metrics.connectionType && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Network Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium">Connection Type</p>
                <p className="text-lg font-bold">{metrics.connectionType}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Effective Type</p>
                <p className="text-lg font-bold">{metrics.effectiveType}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Downlink</p>
                <p className="text-lg font-bold">{metrics.downlink} Mbps</p>
              </div>
              <div>
                <p className="text-sm font-medium">RTT</p>
                <p className="text-lg font-bold">{metrics.rtt}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PerformanceDashboard;
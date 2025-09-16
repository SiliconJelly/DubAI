import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api';

interface CostBreakdown {
  googleTTSCost: number;
  coquiTTSCost: number;
  processingCost: number;
  storageCost: number;
  totalCost: number;
  currency: string;
}

interface UsageMetrics {
  totalCharacters: number;
  totalApiCalls: number;
  totalProcessingTime: number;
  serviceBreakdown: Record<string, {
    characters: number;
    apiCalls: number;
    processingTime: number;
    cost: number;
  }>;
  dailyUsage: Array<{
    date: string;
    characters: number;
    cost: number;
    service: string;
  }>;
}

interface QuotaStatus {
  googleTTS: {
    used: number;
    limit: number;
    remaining: number;
    resetDate: string;
    percentageUsed: number;
  };
  monthlyBudget?: {
    used: number;
    limit: number;
    remaining: number;
    percentageUsed: number;
  };
}

interface OptimizationRecommendation {
  type: 'service_switch' | 'quota_management' | 'batch_processing' | 'quality_adjustment';
  title: string;
  description: string;
  potentialSavings: number;
  impact: 'low' | 'medium' | 'high';
  actionRequired: string;
}

interface QuotaAlert {
  service: string;
  currentUsage: number;
  limit: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
  recommendedAction: string;
}

interface CostSavings {
  totalCost: number;
  totalCharacters: number;
  actualSavings: number;
  potentialSavings: number;
  savingsPercentage: number;
  serviceDistribution: {
    googleTTS: {
      characters: number;
      cost: number;
      percentage: number;
    };
    coquiTTS: {
      characters: number;
      cost: number;
      percentage: number;
    };
  };
}

interface ServiceRecommendation {
  recommendedService: string;
  reasoning: string;
  costEstimate: number;
  qualityScore: number;
}

interface UseCostTrackingOptions {
  timeframe?: 'day' | 'week' | 'month' | 'year';
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseCostTrackingReturn {
  // Data
  costBreakdown: CostBreakdown | null;
  usageMetrics: UsageMetrics | null;
  quotaStatus: QuotaStatus | null;
  recommendations: OptimizationRecommendation[];
  alerts: QuotaAlert[];
  costSavings: CostSavings | null;
  
  // State
  loading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  setTimeframe: (timeframe: 'day' | 'week' | 'month' | 'year') => void;
  getOptimalService: (charactersToProcess: number, qualityRequirement: 'high' | 'medium' | 'low') => Promise<ServiceRecommendation | null>;
  
  // Computed values
  hasAlerts: boolean;
  hasCriticalAlerts: boolean;
  totalSavings: number;
  quotaWarningLevel: 'safe' | 'warning' | 'critical';
}

export const useCostTracking = (options: UseCostTrackingOptions = {}): UseCostTrackingReturn => {
  const {
    timeframe: initialTimeframe = 'month',
    autoRefresh = false,
    refreshInterval = 60000 // 1 minute
  } = options;

  // State
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'year'>(initialTimeframe);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [costSavings, setCostSavings] = useState<CostSavings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all cost tracking data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        breakdownData,
        metricsData,
        quotaData,
        recommendationsData,
        alertsData,
        savingsData
      ] = await Promise.all([
        apiClient.getCostBreakdown(timeframe),
        apiClient.getUsageMetrics(timeframe),
        apiClient.getQuotaStatus(),
        apiClient.getOptimizationRecommendations(),
        apiClient.getQuotaAlerts(),
        apiClient.getCostSavings(timeframe)
      ]);

      setCostBreakdown(breakdownData);
      setUsageMetrics(metricsData);
      setQuotaStatus(quotaData);
      setRecommendations(recommendationsData);
      setAlerts(alertsData);
      setCostSavings(savingsData);
    } catch (err) {
      console.error('Error loading cost tracking data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cost tracking data');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  // Get optimal service recommendation
  const getOptimalService = useCallback(async (
    charactersToProcess: number,
    qualityRequirement: 'high' | 'medium' | 'low'
  ): Promise<ServiceRecommendation | null> => {
    try {
      return await apiClient.getOptimalService(charactersToProcess, qualityRequirement);
    } catch (err) {
      console.error('Error getting optimal service:', err);
      setError(err instanceof Error ? err.message : 'Failed to get service recommendation');
      return null;
    }
  }, []);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Load data on mount and timeframe change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadData]);

  // Computed values
  const hasAlerts = alerts.length > 0;
  const hasCriticalAlerts = alerts.some(alert => alert.severity === 'critical');
  const totalSavings = costSavings?.actualSavings || 0;
  
  const quotaWarningLevel: 'safe' | 'warning' | 'critical' = (() => {
    if (!quotaStatus) return 'safe';
    
    const googleQuotaPercentage = quotaStatus.googleTTS.percentageUsed;
    const budgetPercentage = quotaStatus.monthlyBudget?.percentageUsed || 0;
    
    const maxPercentage = Math.max(googleQuotaPercentage, budgetPercentage);
    
    if (maxPercentage >= 90) return 'critical';
    if (maxPercentage >= 75) return 'warning';
    return 'safe';
  })();

  return {
    // Data
    costBreakdown,
    usageMetrics,
    quotaStatus,
    recommendations,
    alerts,
    costSavings,
    
    // State
    loading,
    error,
    
    // Actions
    refresh,
    setTimeframe,
    getOptimalService,
    
    // Computed values
    hasAlerts,
    hasCriticalAlerts,
    totalSavings,
    quotaWarningLevel
  };
};

// Hook for real-time quota monitoring
export const useQuotaMonitoring = () => {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const checkQuota = useCallback(async () => {
    try {
      const [quotaData, alertsData] = await Promise.all([
        apiClient.getQuotaStatus(),
        apiClient.getQuotaAlerts()
      ]);
      
      setQuotaStatus(quotaData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Error checking quota:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkQuota();
    
    // Check quota every 5 minutes
    const interval = setInterval(checkQuota, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkQuota]);

  const isQuotaLow = quotaStatus?.googleTTS.percentageUsed >= 75;
  const isQuotaCritical = quotaStatus?.googleTTS.percentageUsed >= 90;
  const isBudgetExceeded = quotaStatus?.monthlyBudget?.percentageUsed >= 100;

  return {
    quotaStatus,
    alerts,
    loading,
    isQuotaLow,
    isQuotaCritical,
    isBudgetExceeded,
    refresh: checkQuota
  };
};

// Hook for cost optimization suggestions
export const useCostOptimization = () => {
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getOptimizationRecommendations();
      setRecommendations(data);
    } catch (err) {
      console.error('Error loading optimization recommendations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const highImpactRecommendations = recommendations.filter(rec => rec.impact === 'high');
  const totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);

  return {
    recommendations,
    loading,
    highImpactRecommendations,
    totalPotentialSavings,
    refresh: loadRecommendations
  };
};
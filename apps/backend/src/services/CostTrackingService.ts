import { TTSServiceType, UsageMetrics } from '../../../src/types/common';
import { supabase } from '../config/supabase';

export interface CostBreakdown {
  googleTTSCost: number;
  coquiTTSCost: number;
  processingCost: number;
  storageCost: number;
  totalCost: number;
  currency: string;
}

export interface ServiceUsage {
  service: TTSServiceType;
  charactersProcessed: number;
  apiCalls: number;
  processingTimeMs: number;
  cost: number;
  timestamp: string;
}

export interface CostOptimizationRecommendation {
  type: 'service_switch' | 'quota_management' | 'batch_processing' | 'quality_adjustment';
  title: string;
  description: string;
  potentialSavings: number;
  impact: 'low' | 'medium' | 'high';
  actionRequired: string;
}

export interface QuotaAlert {
  service: TTSServiceType;
  currentUsage: number;
  limit: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
  recommendedAction: string;
}

export class CostTrackingService {
  private readonly GOOGLE_TTS_COST_PER_CHAR = 0.000016; // $16 per 1M characters
  private readonly COQUI_TTS_COST_PER_CHAR = 0.000005; // Estimated local processing cost
  private readonly STORAGE_COST_PER_GB_MONTH = 0.021; // Supabase storage cost
  private readonly PROCESSING_COST_PER_MINUTE = 0.01; // Estimated compute cost

  async trackServiceUsage(
    userId: string,
    jobId: string,
    service: TTSServiceType,
    usage: UsageMetrics
  ): Promise<void> {
    const cost = this.calculateServiceCost(service, usage);
    
    const serviceUsage: ServiceUsage = {
      service,
      charactersProcessed: usage.charactersProcessed,
      apiCalls: usage.apiCalls,
      processingTimeMs: usage.processingTimeMs,
      cost,
      timestamp: new Date().toISOString()
    };

    // Store in database
    await supabase
      .from('service_usage')
      .insert({
        user_id: userId,
        job_id: jobId,
        service_type: service,
        characters_processed: usage.charactersProcessed,
        api_calls: usage.apiCalls,
        processing_time_ms: usage.processingTimeMs,
        cost,
        created_at: new Date().toISOString()
      });

    // Update user's total usage
    await this.updateUserTotalUsage(userId, serviceUsage);
  }

  async getCostBreakdown(userId: string, timeframe: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<CostBreakdown> {
    const startDate = this.getStartDate(timeframe);
    
    const { data: usageData } = await supabase
      .from('service_usage')
      .select('service_type, cost')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    let googleTTSCost = 0;
    let coquiTTSCost = 0;
    
    usageData?.forEach(usage => {
      if (usage.service_type === TTSServiceType.GOOGLE_CLOUD) {
        googleTTSCost += usage.cost;
      } else if (usage.service_type === TTSServiceType.COQUI_LOCAL) {
        coquiTTSCost += usage.cost;
      }
    });

    // Get storage costs (simplified calculation)
    const storageCost = await this.calculateStorageCost(userId, timeframe);
    const processingCost = googleTTSCost + coquiTTSCost; // Simplified

    return {
      googleTTSCost,
      coquiTTSCost,
      processingCost,
      storageCost,
      totalCost: googleTTSCost + coquiTTSCost + storageCost,
      currency: 'USD'
    };
  }

  async getUsageMetrics(userId: string, timeframe: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<{
    totalCharacters: number;
    totalApiCalls: number;
    totalProcessingTime: number;
    serviceBreakdown: Record<TTSServiceType, {
      characters: number;
      apiCalls: number;
      processingTime: number;
      cost: number;
    }>;
    dailyUsage: Array<{
      date: string;
      characters: number;
      cost: number;
      service: TTSServiceType;
    }>;
  }> {
    const startDate = this.getStartDate(timeframe);
    
    const { data: usageData } = await supabase
      .from('service_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    let totalCharacters = 0;
    let totalApiCalls = 0;
    let totalProcessingTime = 0;

    const serviceBreakdown: Record<TTSServiceType, {
      characters: number;
      apiCalls: number;
      processingTime: number;
      cost: number;
    }> = {
      [TTSServiceType.GOOGLE_CLOUD]: { characters: 0, apiCalls: 0, processingTime: 0, cost: 0 },
      [TTSServiceType.COQUI_LOCAL]: { characters: 0, apiCalls: 0, processingTime: 0, cost: 0 }
    };

    const dailyUsageMap = new Map<string, { characters: number; cost: number; services: Set<TTSServiceType> }>();

    usageData?.forEach(usage => {
      totalCharacters += usage.characters_processed;
      totalApiCalls += usage.api_calls;
      totalProcessingTime += usage.processing_time_ms;

      const service = usage.service_type as TTSServiceType;
      serviceBreakdown[service].characters += usage.characters_processed;
      serviceBreakdown[service].apiCalls += usage.api_calls;
      serviceBreakdown[service].processingTime += usage.processing_time_ms;
      serviceBreakdown[service].cost += usage.cost;

      // Daily breakdown
      const date = new Date(usage.created_at).toISOString().split('T')[0];
      const existing = dailyUsageMap.get(date) || { characters: 0, cost: 0, services: new Set() };
      existing.characters += usage.characters_processed;
      existing.cost += usage.cost;
      existing.services.add(service);
      dailyUsageMap.set(date, existing);
    });

    const dailyUsage = Array.from(dailyUsageMap.entries()).map(([date, data]) => ({
      date,
      characters: data.characters,
      cost: data.cost,
      service: data.services.size === 1 ? Array.from(data.services)[0] : TTSServiceType.GOOGLE_CLOUD // Default for mixed
    }));

    return {
      totalCharacters,
      totalApiCalls,
      totalProcessingTime,
      serviceBreakdown,
      dailyUsage
    };
  }

  async getQuotaStatus(userId: string): Promise<{
    googleTTS: {
      used: number;
      limit: number;
      remaining: number;
      resetDate: Date;
      percentageUsed: number;
    };
    monthlyBudget?: {
      used: number;
      limit: number;
      remaining: number;
      percentageUsed: number;
    };
  }> {
    // Get current month's Google TTS usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: googleUsage } = await supabase
      .from('service_usage')
      .select('characters_processed')
      .eq('user_id', userId)
      .eq('service_type', TTSServiceType.GOOGLE_CLOUD)
      .gte('created_at', startOfMonth.toISOString());

    const usedCharacters = googleUsage?.reduce((sum, usage) => sum + usage.characters_processed, 0) || 0;
    const limit = 4000000; // 4M characters free tier
    const remaining = Math.max(0, limit - usedCharacters);
    
    const resetDate = new Date(startOfMonth);
    resetDate.setMonth(resetDate.getMonth() + 1);

    // Get user's monthly budget if set
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('monthly_budget')
      .eq('id', userId)
      .single();

    let monthlyBudget;
    if (userProfile?.monthly_budget) {
      const monthlySpend = await this.getMonthlySpend(userId);
      monthlyBudget = {
        used: monthlySpend,
        limit: userProfile.monthly_budget,
        remaining: Math.max(0, userProfile.monthly_budget - monthlySpend),
        percentageUsed: (monthlySpend / userProfile.monthly_budget) * 100
      };
    }

    return {
      googleTTS: {
        used: usedCharacters,
        limit,
        remaining,
        resetDate,
        percentageUsed: (usedCharacters / limit) * 100
      },
      monthlyBudget
    };
  }

  async getOptimizationRecommendations(userId: string): Promise<CostOptimizationRecommendation[]> {
    const recommendations: CostOptimizationRecommendation[] = [];
    const quotaStatus = await this.getQuotaStatus(userId);
    const usageMetrics = await this.getUsageMetrics(userId, 'month');

    // Recommendation 1: Service switching based on usage patterns
    const googleUsage = usageMetrics.serviceBreakdown[TTSServiceType.GOOGLE_CLOUD];
    const coquiUsage = usageMetrics.serviceBreakdown[TTSServiceType.COQUI_LOCAL];
    
    if (googleUsage.cost > coquiUsage.cost * 2 && googleUsage.characters > 100000) {
      const potentialSavings = googleUsage.cost - (googleUsage.characters * this.COQUI_TTS_COST_PER_CHAR);
      recommendations.push({
        type: 'service_switch',
        title: 'Switch to Local TTS for Cost Savings',
        description: `You're spending significantly more on Google TTS. Consider using Coqui TTS for non-critical content.`,
        potentialSavings,
        impact: 'high',
        actionRequired: 'Enable automatic service selection based on content type'
      });
    }

    // Recommendation 2: Quota management
    if (quotaStatus.googleTTS.percentageUsed > 80) {
      recommendations.push({
        type: 'quota_management',
        title: 'Google TTS Quota Alert',
        description: `You've used ${quotaStatus.googleTTS.percentageUsed.toFixed(1)}% of your Google TTS quota.`,
        potentialSavings: 0,
        impact: 'high',
        actionRequired: 'Enable automatic fallback to Coqui TTS when quota is low'
      });
    }

    // Recommendation 3: Batch processing
    if (usageMetrics.totalApiCalls > usageMetrics.totalCharacters / 1000) {
      const potentialSavings = (usageMetrics.totalApiCalls - usageMetrics.totalCharacters / 1000) * 0.001;
      recommendations.push({
        type: 'batch_processing',
        title: 'Optimize API Call Efficiency',
        description: 'You have many small API calls. Batching text segments could reduce costs.',
        potentialSavings,
        impact: 'medium',
        actionRequired: 'Enable text batching for TTS requests'
      });
    }

    return recommendations;
  }

  async getQuotaAlerts(userId: string): Promise<QuotaAlert[]> {
    const alerts: QuotaAlert[] = [];
    const quotaStatus = await this.getQuotaStatus(userId);

    // Google TTS quota alerts
    if (quotaStatus.googleTTS.percentageUsed >= 90) {
      alerts.push({
        service: TTSServiceType.GOOGLE_CLOUD,
        currentUsage: quotaStatus.googleTTS.used,
        limit: quotaStatus.googleTTS.limit,
        threshold: 90,
        severity: 'critical',
        message: 'Google TTS quota is 90% exhausted',
        recommendedAction: 'Switch to Coqui TTS or wait for quota reset'
      });
    } else if (quotaStatus.googleTTS.percentageUsed >= 75) {
      alerts.push({
        service: TTSServiceType.GOOGLE_CLOUD,
        currentUsage: quotaStatus.googleTTS.used,
        limit: quotaStatus.googleTTS.limit,
        threshold: 75,
        severity: 'warning',
        message: 'Google TTS quota is 75% used',
        recommendedAction: 'Consider enabling automatic fallback to Coqui TTS'
      });
    }

    // Monthly budget alerts
    if (quotaStatus.monthlyBudget && quotaStatus.monthlyBudget.percentageUsed >= 90) {
      alerts.push({
        service: TTSServiceType.GOOGLE_CLOUD, // Generic service for budget
        currentUsage: quotaStatus.monthlyBudget.used,
        limit: quotaStatus.monthlyBudget.limit,
        threshold: 90,
        severity: 'critical',
        message: 'Monthly budget is 90% exhausted',
        recommendedAction: 'Review usage patterns and consider cost optimization'
      });
    }

    return alerts;
  }

  async selectOptimalService(
    charactersToProcess: number,
    qualityRequirement: 'high' | 'medium' | 'low',
    userId: string
  ): Promise<{
    recommendedService: TTSServiceType;
    reasoning: string;
    costEstimate: number;
    qualityScore: number;
  }> {
    const quotaStatus = await this.getQuotaStatus(userId);
    
    // Calculate costs for both services
    const googleCost = charactersToProcess * this.GOOGLE_TTS_COST_PER_CHAR;
    const coquiCost = charactersToProcess * this.COQUI_TTS_COST_PER_CHAR;

    // Quality scores (simplified)
    const qualityScores = {
      [TTSServiceType.GOOGLE_CLOUD]: { high: 9, medium: 9, low: 8 },
      [TTSServiceType.COQUI_LOCAL]: { high: 7, medium: 8, low: 8 }
    };

    // Decision logic
    let recommendedService: TTSServiceType;
    let reasoning: string;

    // Check quota availability
    if (quotaStatus.googleTTS.remaining < charactersToProcess) {
      recommendedService = TTSServiceType.COQUI_LOCAL;
      reasoning = 'Google TTS quota insufficient for this request';
    } else if (qualityRequirement === 'high' && googleCost < coquiCost * 3) {
      recommendedService = TTSServiceType.GOOGLE_CLOUD;
      reasoning = 'High quality required and Google TTS cost is reasonable';
    } else if (qualityRequirement === 'low' || coquiCost < googleCost * 0.5) {
      recommendedService = TTSServiceType.COQUI_LOCAL;
      reasoning = 'Cost optimization: Coqui TTS provides good value for this quality requirement';
    } else {
      recommendedService = TTSServiceType.GOOGLE_CLOUD;
      reasoning = 'Balanced choice for quality and cost';
    }

    return {
      recommendedService,
      reasoning,
      costEstimate: recommendedService === TTSServiceType.GOOGLE_CLOUD ? googleCost : coquiCost,
      qualityScore: qualityScores[recommendedService][qualityRequirement]
    };
  }

  private calculateServiceCost(service: TTSServiceType, usage: UsageMetrics): number {
    const characterCost = service === TTSServiceType.GOOGLE_CLOUD 
      ? usage.charactersProcessed * this.GOOGLE_TTS_COST_PER_CHAR
      : usage.charactersProcessed * this.COQUI_TTS_COST_PER_CHAR;
    
    const processingCost = (usage.processingTimeMs / 60000) * this.PROCESSING_COST_PER_MINUTE;
    
    return characterCost + processingCost;
  }

  private async updateUserTotalUsage(userId: string, usage: ServiceUsage): Promise<void> {
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('total_characters_processed, total_cost')
      .eq('id', userId)
      .single();

    const totalCharacters = (currentProfile?.total_characters_processed || 0) + usage.charactersProcessed;
    const totalCost = (currentProfile?.total_cost || 0) + usage.cost;

    await supabase
      .from('user_profiles')
      .update({
        total_characters_processed: totalCharacters,
        total_cost: totalCost,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
  }

  private async calculateStorageCost(userId: string, timeframe: 'day' | 'week' | 'month' | 'year'): Promise<number> {
    // Simplified storage cost calculation
    // In a real implementation, you'd track actual storage usage
    const { data: files } = await supabase
      .from('storage_files')
      .select('file_size')
      .eq('user_id', userId);

    const totalSizeGB = (files?.reduce((sum, file) => sum + file.file_size, 0) || 0) / (1024 * 1024 * 1024);
    
    // Calculate cost based on timeframe
    const monthlyFactor = timeframe === 'day' ? 1/30 : timeframe === 'week' ? 1/4 : timeframe === 'year' ? 12 : 1;
    
    return totalSizeGB * this.STORAGE_COST_PER_GB_MONTH * monthlyFactor;
  }

  private getStartDate(timeframe: 'day' | 'week' | 'month' | 'year'): Date {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return weekStart;
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  private async getMonthlySpend(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usage } = await supabase
      .from('service_usage')
      .select('cost')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    return usage?.reduce((sum, u) => sum + u.cost, 0) || 0;
  }
}

export const costTrackingService = new CostTrackingService();
import { 
  ApiResponse, 
  DubbingJob, 
  CreateJobRequest,
  JobResponse,
  JobListResponse,
  UserProfile,
  JobStatus
} from '@dubai/shared';
import { getAccessToken } from '@/utils/sessionManager';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    // Add authentication header if required
    if (requireAuth) {
      const token = await getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        throw new Error('No authentication token available');
      }
    }
    
    const config: RequestInit = {
      headers,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Ignore JSON parsing errors
        }
        
        throw new Error(errorMessage);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Job Management
  async getJobs(options: {
    page?: number;
    limit?: number;
    status?: JobStatus;
    sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'progress';
    sortOrder?: 'asc' | 'desc';
    search?: string;
  } = {}): Promise<{
    jobs: DubbingJob[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const params = new URLSearchParams();
    
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.status) params.append('status', options.status);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options.search) params.append('search', options.search);
    
    const queryString = params.toString();
    const endpoint = queryString ? `/jobs?${queryString}` : '/jobs';
    
    const response = await this.request<{
      jobs: DubbingJob[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
      };
    }>(endpoint);
    
    return response.data || { 
      jobs: [], 
      pagination: { 
        page: 1, 
        limit: 20, 
        total: 0, 
        totalPages: 0, 
        hasMore: false 
      } 
    };
  }

  async createJob(jobData: CreateJobRequest): Promise<DubbingJob> {
    const response = await this.request<DubbingJob>('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create job');
    }
    
    return response.data;
  }

  async getJob(jobId: string): Promise<DubbingJob> {
    const response = await this.request<DubbingJob>(`/jobs/${jobId}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get job');
    }
    
    return response.data;
  }

  async deleteJob(jobId: string): Promise<void> {
    const response = await this.request<void>(`/jobs/${jobId}`, {
      method: 'DELETE',
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete job');
    }
  }

  async retryJob(jobId: string): Promise<DubbingJob> {
    const response = await this.request<DubbingJob>(`/jobs/${jobId}/retry`, {
      method: 'POST',
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to retry job');
    }
    
    return response.data;
  }

  async retryJobStep(jobId: string, stepId: string): Promise<DubbingJob> {
    const response = await this.request<DubbingJob>(`/jobs/${jobId}/retry/${stepId}`, {
      method: 'POST',
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to retry job step');
    }
    
    return response.data;
  }

  async updateJobSettings(jobId: string, settings: { ttsService?: 'google' | 'coqui' | 'auto' }): Promise<DubbingJob> {
    const response = await this.request<DubbingJob>(`/jobs/${jobId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update job settings');
    }
    
    return response.data;
  }

  // User Profile Management
  async getUserProfile(): Promise<UserProfile> {
    const response = await this.request<UserProfile>('/users/profile');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get user profile');
    }
    
    return response.data;
  }

  async updateUserProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    const response = await this.request<UserProfile>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update user profile');
    }
    
    return response.data;
  }

  async getUserStats(): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    processingJobs: number;
    totalProcessingTime: number;
  }> {
    const response = await this.request<{
      totalJobs: number;
      completedJobs: number;
      failedJobs: number;
      processingJobs: number;
      totalProcessingTime: number;
    }>('/users/stats');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get user stats');
    }
    
    return response.data;
  }

  // File Download and Management
  async getFileDownloadUrl(fileId: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    const response = await this.request<{ downloadUrl: string; expiresAt: string }>(`/files/${fileId}/download`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get download URL');
    }
    
    return response.data;
  }

  async getJobResults(jobId: string): Promise<{
    outputFiles: {
      dubbedAudio?: { id: string; downloadUrl: string; filename: string; size: number };
      translatedSrt?: { id: string; downloadUrl: string; filename: string; size: number };
      finalVideo?: { id: string; downloadUrl: string; filename: string; size: number };
    };
    qualityMetrics?: {
      audioQuality: number;
      translationAccuracy: number;
      overallRating: number;
    };
  }> {
    const response = await this.request<{
      outputFiles: {
        dubbedAudio?: { id: string; downloadUrl: string; filename: string; size: number };
        translatedSrt?: { id: string; downloadUrl: string; filename: string; size: number };
        finalVideo?: { id: string; downloadUrl: string; filename: string; size: number };
      };
      qualityMetrics?: {
        audioQuality: number;
        translationAccuracy: number;
        overallRating: number;
      };
    }>(`/jobs/${jobId}/results`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get job results');
    }
    
    return response.data;
  }

  async createShareLink(jobId: string, options: {
    expiresIn?: number; // hours
    allowDownload?: boolean;
    password?: string;
  }): Promise<{ shareUrl: string; shareId: string; expiresAt: string }> {
    const response = await this.request<{ shareUrl: string; shareId: string; expiresAt: string }>(`/jobs/${jobId}/share`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create share link');
    }
    
    return response.data;
  }

  async submitQualityFeedback(jobId: string, feedback: {
    audioQuality: number; // 1-5
    translationAccuracy: number; // 1-5
    overallRating: number; // 1-5
    comments?: string;
    reportIssues?: string[];
  }): Promise<void> {
    const response = await this.request<void>(`/jobs/${jobId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to submit feedback');
    }
  }

  async getDownloadHistory(): Promise<{
    downloads: Array<{
      id: string;
      jobId: string;
      jobTitle: string;
      fileType: 'audio' | 'srt' | 'video';
      filename: string;
      downloadedAt: string;
      fileSize: number;
    }>;
    totalDownloads: number;
    totalSize: number;
  }> {
    const response = await this.request<{
      downloads: Array<{
        id: string;
        jobId: string;
        jobTitle: string;
        fileType: 'audio' | 'srt' | 'video';
        filename: string;
        downloadedAt: string;
        fileSize: number;
      }>;
      totalDownloads: number;
      totalSize: number;
    }>('/users/downloads');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get download history');
    }
    
    return response.data;
  }

  // File sharing and export
  async getShareLink(shareId: string): Promise<{
    job: DubbingJob;
    allowDownload: boolean;
    expiresAt: string;
    isPasswordProtected: boolean;
  }> {
    const response = await this.request<{
      job: DubbingJob;
      allowDownload: boolean;
      expiresAt: string;
      isPasswordProtected: boolean;
    }>(`/share/${shareId}`, {}, false);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get share link');
    }
    
    return response.data;
  }

  async validateSharePassword(shareId: string, password: string): Promise<boolean> {
    const response = await this.request<{ valid: boolean }>(`/share/${shareId}/validate`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }, false);
    
    return response.data?.valid || false;
  }

  async deleteShareLink(shareId: string): Promise<void> {
    const response = await this.request<void>(`/share/${shareId}`, {
      method: 'DELETE',
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete share link');
    }
  }

  async getSharedLinks(jobId?: string): Promise<Array<{
    id: string;
    jobId: string;
    jobTitle: string;
    shareUrl: string;
    allowDownload: boolean;
    isPasswordProtected: boolean;
    expiresAt: string;
    createdAt: string;
    accessCount: number;
  }>> {
    const endpoint = jobId ? `/jobs/${jobId}/shares` : '/users/shares';
    const response = await this.request<Array<{
      id: string;
      jobId: string;
      jobTitle: string;
      shareUrl: string;
      allowDownload: boolean;
      isPasswordProtected: boolean;
      expiresAt: string;
      createdAt: string;
      accessCount: number;
    }>>(endpoint);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get shared links');
    }
    
    return response.data;
  }

  // File organization
  async createFolder(name: string, description?: string): Promise<{
    id: string;
    name: string;
    description?: string;
    createdAt: string;
  }> {
    const response = await this.request<{
      id: string;
      name: string;
      description?: string;
      createdAt: string;
    }>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create folder');
    }
    
    return response.data;
  }

  async getFolders(): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    fileCount: number;
  }>> {
    const response = await this.request<Array<{
      id: string;
      name: string;
      description?: string;
      createdAt: string;
      fileCount: number;
    }>>('/folders');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get folders');
    }
    
    return response.data;
  }

  async moveFilesToFolder(fileIds: string[], folderId: string): Promise<void> {
    const response = await this.request<void>('/files/move', {
      method: 'POST',
      body: JSON.stringify({ fileIds, folderId }),
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to move files');
    }
  }

  async toggleFileFavorite(fileId: string): Promise<{ isFavorite: boolean }> {
    const response = await this.request<{ isFavorite: boolean }>(`/files/${fileId}/favorite`, {
      method: 'POST',
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to toggle favorite');
    }
    
    return response.data;
  }

  async deleteFile(fileId: string): Promise<void> {
    const response = await this.request<void>(`/files/${fileId}`, {
      method: 'DELETE',
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete file');
    }
  }

  // Quality assessment
  async getQualityReport(jobId: string): Promise<{
    metrics: {
      audioQuality: number;
      translationAccuracy: number;
      overallRating: number;
      processingTime: number;
      costEfficiency: number;
      userSatisfaction?: number;
    };
    benchmarks: {
      industryAverage: {
        audioQuality: number;
        translationAccuracy: number;
        overallRating: number;
        processingTime: number;
        costEfficiency: number;
        userSatisfaction?: number;
      };
      personalBest: {
        audioQuality: number;
        translationAccuracy: number;
        overallRating: number;
        processingTime: number;
        costEfficiency: number;
        userSatisfaction?: number;
      };
    };
    recommendations: string[];
    issues: Array<{
      type: 'audio' | 'translation' | 'timing' | 'technical';
      severity: 'low' | 'medium' | 'high';
      description: string;
      suggestion: string;
    }>;
  }> {
    const response = await this.request<{
      metrics: {
        audioQuality: number;
        translationAccuracy: number;
        overallRating: number;
        processingTime: number;
        costEfficiency: number;
        userSatisfaction?: number;
      };
      benchmarks: {
        industryAverage: {
          audioQuality: number;
          translationAccuracy: number;
          overallRating: number;
          processingTime: number;
          costEfficiency: number;
          userSatisfaction?: number;
        };
        personalBest: {
          audioQuality: number;
          translationAccuracy: number;
          overallRating: number;
          processingTime: number;
          costEfficiency: number;
          userSatisfaction?: number;
        };
      };
      recommendations: string[];
      issues: Array<{
        type: 'audio' | 'translation' | 'timing' | 'technical';
        severity: 'low' | 'medium' | 'high';
        description: string;
        suggestion: string;
      }>;
    }>(`/jobs/${jobId}/quality`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get quality report');
    }
    
    return response.data;
  }

  // Cost Tracking and Optimization
  async getCostBreakdown(timeframe: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<{
    googleTTSCost: number;
    coquiTTSCost: number;
    processingCost: number;
    storageCost: number;
    totalCost: number;
    currency: string;
  }> {
    const response = await this.request<{
      googleTTSCost: number;
      coquiTTSCost: number;
      processingCost: number;
      storageCost: number;
      totalCost: number;
      currency: string;
    }>(`/cost-tracking/breakdown?timeframe=${timeframe}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get cost breakdown');
    }
    
    return response.data;
  }

  async getUsageMetrics(timeframe: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<{
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
  }> {
    const response = await this.request<{
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
    }>(`/cost-tracking/usage?timeframe=${timeframe}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get usage metrics');
    }
    
    return response.data;
  }

  async getQuotaStatus(): Promise<{
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
  }> {
    const response = await this.request<{
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
    }>('/cost-tracking/quota');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get quota status');
    }
    
    return response.data;
  }

  async getOptimizationRecommendations(): Promise<Array<{
    type: 'service_switch' | 'quota_management' | 'batch_processing' | 'quality_adjustment';
    title: string;
    description: string;
    potentialSavings: number;
    impact: 'low' | 'medium' | 'high';
    actionRequired: string;
  }>> {
    const response = await this.request<Array<{
      type: 'service_switch' | 'quota_management' | 'batch_processing' | 'quality_adjustment';
      title: string;
      description: string;
      potentialSavings: number;
      impact: 'low' | 'medium' | 'high';
      actionRequired: string;
    }>>('/cost-tracking/recommendations');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get optimization recommendations');
    }
    
    return response.data;
  }

  async getQuotaAlerts(): Promise<Array<{
    service: string;
    currentUsage: number;
    limit: number;
    threshold: number;
    severity: 'warning' | 'critical';
    message: string;
    recommendedAction: string;
  }>> {
    const response = await this.request<Array<{
      service: string;
      currentUsage: number;
      limit: number;
      threshold: number;
      severity: 'warning' | 'critical';
      message: string;
      recommendedAction: string;
    }>>('/cost-tracking/alerts');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get quota alerts');
    }
    
    return response.data;
  }

  async getOptimalService(charactersToProcess: number, qualityRequirement: 'high' | 'medium' | 'low'): Promise<{
    recommendedService: string;
    reasoning: string;
    costEstimate: number;
    qualityScore: number;
  }> {
    const response = await this.request<{
      recommendedService: string;
      reasoning: string;
      costEstimate: number;
      qualityScore: number;
    }>('/cost-tracking/optimal-service', {
      method: 'POST',
      body: JSON.stringify({ charactersToProcess, qualityRequirement }),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get optimal service recommendation');
    }
    
    return response.data;
  }

  async getCostSavings(timeframe: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<{
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
  }> {
    const response = await this.request<{
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
    }>(`/cost-tracking/savings?timeframe=${timeframe}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get cost savings report');
    }
    
    return response.data;
  }

  // Health Check (no auth required)
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.request<{ status: string; timestamp: string }>('/health', {}, false);
    return response.data || { status: 'unknown', timestamp: new Date().toISOString() };
  }
}

export const apiClient = new ApiClient();
export default apiClient;
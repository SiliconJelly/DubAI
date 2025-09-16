import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3,
  PieChart,
  Settings,
  Lightbulb,
  Clock,
  Zap
} from 'lucide-react';
import { apiClient } from '@/services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar } from 'recharts';

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export const CostDashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [costSavings, setCostSavings] = useState<CostSavings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [timeframe]);

  const loadDashboardData = async () => {
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
      console.error('Error loading cost dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getSeverityColor = (severity: string) => {
    return severity === 'critical' ? 'destructive' : 'default';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const pieChartData = costBreakdown ? [
    { name: 'Google TTS', value: costBreakdown.googleTTSCost, color: COLORS[0] },
    { name: 'Coqui TTS', value: costBreakdown.coquiTTSCost, color: COLORS[1] },
    { name: 'Storage', value: costBreakdown.storageCost, color: COLORS[2] }
  ].filter(item => item.value > 0) : [];

  const dailyUsageChart = usageMetrics?.dailyUsage.map(item => ({
    date: new Date(item.date).toLocaleDateString(),
    cost: item.cost,
    characters: item.characters
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cost Dashboard</h2>
          <p className="text-muted-foreground">
            Track your usage, costs, and optimize your TTS service selection
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
          <Button onClick={loadDashboardData} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant={getSeverityColor(alert.severity) as any}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.message}</AlertTitle>
              <AlertDescription>{alert.recommendedAction}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {costBreakdown ? formatCurrency(costBreakdown.totalCost) : '$0.0000'}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeframe === 'day' ? 'Today' : `This ${timeframe}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Characters Processed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageMetrics ? formatNumber(usageMetrics.totalCharacters) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Total characters converted to speech
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {costSavings ? formatCurrency(costSavings.actualSavings) : '$0.0000'}
            </div>
            <p className="text-xs text-muted-foreground">
              {costSavings ? `${costSavings.savingsPercentage.toFixed(1)}% saved` : 'No savings yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Google TTS Quota</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quotaStatus ? `${quotaStatus.googleTTS.percentageUsed.toFixed(1)}%` : '0%'}
            </div>
            <Progress 
              value={quotaStatus?.googleTTS.percentageUsed || 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {quotaStatus ? formatNumber(quotaStatus.googleTTS.remaining) : '0'} characters remaining
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage Details</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="quota">Quota Management</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cost Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>Distribution of costs by service</CardDescription>
              </CardHeader>
              <CardContent>
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No cost data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Usage Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Trend</CardTitle>
                <CardDescription>Daily cost and character usage</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyUsageChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyUsageChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        formatter={(value, name) => [
                          name === 'cost' ? formatCurrency(value as number) : formatNumber(value as number),
                          name === 'cost' ? 'Cost' : 'Characters'
                        ]}
                      />
                      <Line 
                        yAxisId="left" 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                      />
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="characters" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No usage data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Service Distribution */}
          {costSavings && (
            <Card>
              <CardHeader>
                <CardTitle>Service Distribution</CardTitle>
                <CardDescription>How your usage is distributed between services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Google TTS</span>
                      <span className="text-sm text-muted-foreground">
                        {costSavings.serviceDistribution.googleTTS.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={costSavings.serviceDistribution.googleTTS.percentage} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatNumber(costSavings.serviceDistribution.googleTTS.characters)} chars</span>
                      <span>{formatCurrency(costSavings.serviceDistribution.googleTTS.cost)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Coqui TTS</span>
                      <span className="text-sm text-muted-foreground">
                        {costSavings.serviceDistribution.coquiTTS.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={costSavings.serviceDistribution.coquiTTS.percentage} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatNumber(costSavings.serviceDistribution.coquiTTS.characters)} chars</span>
                      <span>{formatCurrency(costSavings.serviceDistribution.coquiTTS.cost)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {/* Detailed Usage Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total Characters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {usageMetrics ? formatNumber(usageMetrics.totalCharacters) : '0'}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Across all TTS services
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {usageMetrics ? formatNumber(usageMetrics.totalApiCalls) : '0'}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Total requests made
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {usageMetrics ? `${(usageMetrics.totalProcessingTime / 1000 / 60).toFixed(1)}m` : '0m'}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Total processing time
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Service Breakdown */}
          {usageMetrics && (
            <Card>
              <CardHeader>
                <CardTitle>Service Breakdown</CardTitle>
                <CardDescription>Detailed usage by TTS service</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(usageMetrics.serviceBreakdown).map(([service, data]) => (
                    <div key={service} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">
                          {service === 'google_cloud' ? 'Google TTS' : 'Coqui TTS'}
                        </h4>
                        <Badge variant="outline">
                          {formatCurrency(data.cost)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Characters:</span>
                          <div className="font-medium">{formatNumber(data.characters)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">API Calls:</span>
                          <div className="font-medium">{formatNumber(data.apiCalls)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Processing:</span>
                          <div className="font-medium">{(data.processingTime / 1000 / 60).toFixed(1)}m</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          {/* Optimization Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Optimization Recommendations
              </CardTitle>
              <CardDescription>
                AI-powered suggestions to reduce costs and improve efficiency
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{rec.title}</h4>
                        <Badge variant={getImpactColor(rec.impact) as any}>
                          {rec.impact} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {rec.description}
                      </p>
                      <div className="flex justify-between items-center">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Potential savings: </span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(rec.potentialSavings)}
                          </span>
                        </div>
                        <Button size="sm" variant="outline">
                          {rec.actionRequired}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>Your usage is already optimized!</p>
                  <p className="text-sm">No recommendations at this time.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Savings Summary */}
          {costSavings && (
            <Card>
              <CardHeader>
                <CardTitle>Cost Savings Summary</CardTitle>
                <CardDescription>Your savings from intelligent service selection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Actual Savings:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(costSavings.actualSavings)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Potential Additional:</span>
                      <span className="font-medium">
                        {formatCurrency(costSavings.potentialSavings)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Savings Rate:</span>
                      <span className="font-medium">
                        {costSavings.savingsPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Spent:</span>
                      <span className="font-medium">
                        {formatCurrency(costSavings.totalCost)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Characters:</span>
                      <span className="font-medium">
                        {formatNumber(costSavings.totalCharacters)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Avg Cost/Char:</span>
                      <span className="font-medium">
                        {costSavings.totalCharacters > 0 
                          ? formatCurrency(costSavings.totalCost / costSavings.totalCharacters)
                          : '$0.0000'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="quota" className="space-y-4">
          {/* Quota Status */}
          {quotaStatus && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Google TTS Quota</CardTitle>
                  <CardDescription>
                    Free tier: 4M characters per month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Used</span>
                        <span>{formatNumber(quotaStatus.googleTTS.used)} / {formatNumber(quotaStatus.googleTTS.limit)}</span>
                      </div>
                      <Progress value={quotaStatus.googleTTS.percentageUsed} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Remaining:</span>
                        <div className="font-medium">{formatNumber(quotaStatus.googleTTS.remaining)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resets:</span>
                        <div className="font-medium">
                          {new Date(quotaStatus.googleTTS.resetDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {quotaStatus.monthlyBudget && (
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Budget</CardTitle>
                    <CardDescription>
                      Your personal spending limit
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Spent</span>
                          <span>
                            {formatCurrency(quotaStatus.monthlyBudget.used)} / {formatCurrency(quotaStatus.monthlyBudget.limit)}
                          </span>
                        </div>
                        <Progress value={quotaStatus.monthlyBudget.percentageUsed} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Remaining:</span>
                          <div className="font-medium">{formatCurrency(quotaStatus.monthlyBudget.remaining)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Usage:</span>
                          <div className="font-medium">{quotaStatus.monthlyBudget.percentageUsed.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Quota Management Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quota Management
              </CardTitle>
              <CardDescription>
                Configure automatic actions when quotas are reached
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Auto-fallback to Coqui TTS</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically switch to local TTS when Google quota is low
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Quota Alerts</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when approaching quota limits
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Monthly Budget</h4>
                    <p className="text-sm text-muted-foreground">
                      Set a monthly spending limit for cost control
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Set Budget
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/components/UserProfile';
import { useOptimizedJobs, useOptimizedCreateJob } from '@/hooks/useOptimizedApi';
import { useHealthCheck } from '@/hooks/useApi';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useResponsive } from '@/hooks/useResponsive';
import { useOfflineCapability } from '@/hooks/useOfflineCapability';
import { useCostTracking } from '@/hooks/useCostTracking';
import { JobStatus } from '@dubai/shared';
import { cn } from '@/lib/utils';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Plus, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

export const Dashboard = () => {
  const { data: jobsData, isLoading: jobsLoading, error: jobsError } = useOptimizedJobs({
    limit: 10,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    enableCache: true
  });
  const { data: health, isLoading: healthLoading } = useHealthCheck();
  const { mutate: createJob, isPending: isCreating } = useOptimizedCreateJob();
  const { isConnected, connectionError, onJobUpdate } = useWebSocket();
  const { isMobile, isTablet } = useResponsive();
  const { isOnline, isOffline, offlineData, getOfflineData } = useOfflineCapability();
  const { 
    costBreakdown, 
    quotaStatus, 
    alerts, 
    hasAlerts, 
    hasCriticalAlerts,
    totalSavings,
    quotaWarningLevel,
    loading: costLoading 
  } = useCostTracking({ timeframe: 'month', autoRefresh: true });

  useEffect(() => {
    onJobUpdate((update) => {
      console.log('Job update received:', update);
      // Handle real-time job updates here
    });
  }, [onJobUpdate]);

  const handleCreateTestJob = () => {
    createJob({
      title: `Test Job ${Date.now()}`,
    });
  };

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED:
        return 'bg-green-500';
      case JobStatus.FAILED:
        return 'bg-red-500';
      case JobStatus.UPLOADED:
        return 'bg-blue-500';
      default:
        return 'bg-yellow-500';
    }
  };

  // Get offline jobs if available
  const offlineJobs = getOfflineData('completed_jobs') || [];
  const jobs = jobsData?.jobs || [];
  const displayJobs = isOffline ? offlineJobs : jobs;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  return (
    <div className={cn(
      'container mx-auto space-y-6',
      isMobile ? 'p-4 pb-20' : 'p-6', // Add bottom padding for mobile nav
      isTablet && 'ml-16' // Add left margin for tablet sidebar
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between',
        isMobile && 'flex-col space-y-4 items-stretch'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg bg-primary/10',
            isMobile && 'p-3'
          )}>
            <Activity className={cn(
              'text-primary',
              isMobile ? 'h-6 w-6' : 'h-5 w-5'
            )} />
          </div>
          <div>
            <h1 className={cn(
              'font-bold text-foreground',
              isMobile ? 'text-xl' : 'text-3xl'
            )}>
              Dashboard
            </h1>
            {isMobile && (
              <p className="text-sm text-muted-foreground">
                Manage your dubbing projects
              </p>
            )}
          </div>
        </div>
        
        <Button 
          onClick={handleCreateTestJob} 
          disabled={isCreating}
          className={cn(
            'touch-manipulation',
            isMobile && 'w-full h-12 text-base'
          )}
        >
          <Plus className="h-4 w-4 mr-2" />
          {isCreating ? 'Creating...' : 'New Job'}
        </Button>
      </div>

      {/* Offline Indicator */}
      {isOffline && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">You're offline</p>
                <p className="text-sm text-amber-700">
                  Showing cached data. Connect to internet to sync latest updates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Alerts */}
      {hasAlerts && (
        <Card className={cn(
          'border-amber-200 bg-amber-50',
          hasCriticalAlerts && 'border-red-200 bg-red-50'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={cn(
                'h-5 w-5',
                hasCriticalAlerts ? 'text-red-600' : 'text-amber-600'
              )} />
              <div className="flex-1">
                <p className={cn(
                  'font-medium',
                  hasCriticalAlerts ? 'text-red-800' : 'text-amber-800'
                )}>
                  {hasCriticalAlerts ? 'Critical Cost Alert' : 'Cost Alert'}
                </p>
                <p className={cn(
                  'text-sm',
                  hasCriticalAlerts ? 'text-red-700' : 'text-amber-700'
                )}>
                  {alerts.length === 1 
                    ? alerts[0].message 
                    : `${alerts.length} cost alerts require your attention`
                  }
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className={cn(
                  hasCriticalAlerts ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'
                )}
              >
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Profile - Collapsed on mobile */}
      {!isMobile && <UserProfile />}

      {/* Stats Cards */}
      <div className={cn(
        'grid gap-4',
        isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-4'
      )}>
        {/* Connection Status */}
        <Card className="relative overflow-hidden">
          <CardContent className={cn(
            'p-4',
            isMobile && 'p-3'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  'text-muted-foreground',
                  isMobile ? 'text-xs' : 'text-sm'
                )}>
                  Status
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                  <span className={cn(
                    'font-medium',
                    isMobile ? 'text-sm' : 'text-base',
                    isOnline ? 'text-green-600' : 'text-red-600'
                  )}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Jobs */}
        <Card>
          <CardContent className={cn(
            'p-4',
            isMobile && 'p-3'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  'text-muted-foreground',
                  isMobile ? 'text-xs' : 'text-sm'
                )}>
                  Total Jobs
                </p>
                <p className={cn(
                  'font-bold text-foreground mt-1',
                  isMobile ? 'text-lg' : 'text-2xl'
                )}>
                  {displayJobs?.length || 0}
                </p>
              </div>
              <TrendingUp className={cn(
                'text-muted-foreground',
                isMobile ? 'h-4 w-4' : 'h-5 w-5'
              )} />
            </div>
          </CardContent>
        </Card>

        {/* Completed Jobs */}
        <Card>
          <CardContent className={cn(
            'p-4',
            isMobile && 'p-3'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  'text-muted-foreground',
                  isMobile ? 'text-xs' : 'text-sm'
                )}>
                  Completed
                </p>
                <p className={cn(
                  'font-bold text-green-600 mt-1',
                  isMobile ? 'text-lg' : 'text-2xl'
                )}>
                  {displayJobs?.filter(job => job.status === JobStatus.COMPLETED).length || 0}
                </p>
              </div>
              <CheckCircle className={cn(
                'text-green-600',
                isMobile ? 'h-4 w-4' : 'h-5 w-5'
              )} />
            </div>
          </CardContent>
        </Card>

        {/* Processing Jobs */}
        <Card>
          <CardContent className={cn(
            'p-4',
            isMobile && 'p-3'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  'text-muted-foreground',
                  isMobile ? 'text-xs' : 'text-sm'
                )}>
                  Processing
                </p>
                <p className={cn(
                  'font-bold text-blue-600 mt-1',
                  isMobile ? 'text-lg' : 'text-2xl'
                )}>
                  {displayJobs?.filter(job => 
                    job.status !== JobStatus.COMPLETED && 
                    job.status !== JobStatus.FAILED
                  ).length || 0}
                </p>
              </div>
              <Clock className={cn(
                'text-blue-600',
                isMobile ? 'h-4 w-4' : 'h-5 w-5'
              )} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Overview - Only show if not mobile or if there's cost data */}
      {(!isMobile || costBreakdown) && !costLoading && (
        <div className={cn(
          'grid gap-4',
          isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
        )}>
          {/* Monthly Cost */}
          <Card>
            <CardContent className={cn(
              'p-4',
              isMobile && 'p-3'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    'text-muted-foreground',
                    isMobile ? 'text-xs' : 'text-sm'
                  )}>
                    Monthly Cost
                  </p>
                  <p className={cn(
                    'font-bold text-foreground mt-1',
                    isMobile ? 'text-lg' : 'text-2xl'
                  )}>
                    {costBreakdown ? formatCurrency(costBreakdown.totalCost) : '$0.0000'}
                  </p>
                </div>
                <DollarSign className={cn(
                  'text-muted-foreground',
                  isMobile ? 'h-4 w-4' : 'h-5 w-5'
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Quota Status */}
          <Card>
            <CardContent className={cn(
              'p-4',
              isMobile && 'p-3'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    'text-muted-foreground',
                    isMobile ? 'text-xs' : 'text-sm'
                  )}>
                    Google TTS Quota
                  </p>
                  <p className={cn(
                    'font-bold mt-1',
                    isMobile ? 'text-lg' : 'text-2xl',
                    quotaWarningLevel === 'critical' ? 'text-red-600' :
                    quotaWarningLevel === 'warning' ? 'text-amber-600' : 'text-green-600'
                  )}>
                    {quotaStatus ? `${quotaStatus.googleTTS.percentageUsed.toFixed(1)}%` : '0%'}
                  </p>
                </div>
                <div className={cn(
                  'p-2 rounded-full',
                  quotaWarningLevel === 'critical' ? 'bg-red-100' :
                  quotaWarningLevel === 'warning' ? 'bg-amber-100' : 'bg-green-100'
                )}>
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    quotaWarningLevel === 'critical' ? 'bg-red-600' :
                    quotaWarningLevel === 'warning' ? 'bg-amber-600' : 'bg-green-600'
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Savings */}
          <Card>
            <CardContent className={cn(
              'p-4',
              isMobile && 'p-3'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    'text-muted-foreground',
                    isMobile ? 'text-xs' : 'text-sm'
                  )}>
                    Savings This Month
                  </p>
                  <p className={cn(
                    'font-bold text-green-600 mt-1',
                    isMobile ? 'text-lg' : 'text-2xl'
                  )}>
                    {formatCurrency(totalSavings)}
                  </p>
                </div>
                <TrendingUp className={cn(
                  'text-green-600',
                  isMobile ? 'h-4 w-4' : 'h-5 w-5'
                )} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>

      {/* Jobs List */}
      <Card>
        <CardHeader className={cn(
          isMobile && 'p-4 pb-2'
        )}>
          <CardTitle className={cn(
            isMobile ? 'text-lg' : 'text-xl'
          )}>
            Recent Jobs
          </CardTitle>
          <CardDescription className={cn(
            isMobile ? 'text-sm' : 'text-base'
          )}>
            Your dubbing jobs and their current status
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(
          isMobile && 'p-4 pt-2'
        )}>
          {jobsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : jobsError ? (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">Error loading jobs: {jobsError.message}</p>
            </div>
          ) : displayJobs && displayJobs.length > 0 ? (
            <div className={cn(
              'space-y-3',
              isMobile && 'space-y-4'
            )}>
              {displayJobs.map((job) => (
                <Card key={job.id} className={cn(
                  'transition-all duration-200 hover:shadow-md',
                  isMobile && 'touch-manipulation'
                )}>
                  <CardContent className={cn(
                    'p-4',
                    isMobile && 'p-3'
                  )}>
                    <div className={cn(
                      'flex items-center justify-between',
                      isMobile && 'flex-col space-y-3 items-stretch'
                    )}>
                      <div className={cn(
                        'flex-1 min-w-0',
                        isMobile && 'w-full'
                      )}>
                        <h3 className={cn(
                          'font-medium text-foreground truncate',
                          isMobile ? 'text-base' : 'text-sm'
                        )}>
                          {job.title}
                        </h3>
                        <p className={cn(
                          'text-muted-foreground',
                          isMobile ? 'text-sm' : 'text-xs'
                        )}>
                          Created: {new Date(job.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className={cn(
                        'flex items-center gap-3',
                        isMobile && 'w-full justify-between'
                      )}>
                        <Badge 
                          variant={job.status === JobStatus.COMPLETED ? 'default' : 
                                  job.status === JobStatus.FAILED ? 'destructive' : 'secondary'}
                          className={cn(
                            isMobile && 'text-sm px-3 py-1'
                          )}
                        >
                          {job.status}
                        </Badge>
                        <span className={cn(
                          'font-medium text-foreground',
                          isMobile ? 'text-base' : 'text-sm'
                        )}>
                          {job.progress}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 rounded-full bg-muted/50 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                No jobs found. Create your first job to get started!
              </p>
              <Button 
                onClick={handleCreateTestJob}
                disabled={isCreating}
                className="touch-manipulation"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Job
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
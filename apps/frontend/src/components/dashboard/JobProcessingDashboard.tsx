import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  RefreshCw,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  BarChart3,
  Calendar,
  Download,
  Trash2
} from 'lucide-react';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { useWebSocket } from '../../hooks/useWebSocket';
import { JobStatusCard } from './JobStatusCard';
import { ProcessingStepsVisualization } from './ProcessingStepsVisualization';
import { JobHistoryTable } from './JobHistoryTable';
import { JobStatistics } from './JobStatistics';
import { useToast } from '../../hooks/use-toast';
import { apiClient } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

interface JobProcessingDashboardProps {
  className?: string;
}

type SortField = 'createdAt' | 'updatedAt' | 'title' | 'status' | 'progress';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | JobStatus;

export const JobProcessingDashboard: React.FC<JobProcessingDashboardProps> = ({
  className = ''
}) => {
  const [jobs, setJobs] = useState<DubbingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { toast } = useToast();
  
  // WebSocket connection for real-time updates
  const {
    isConnected,
    onJobUpdate,
    onError: onWebSocketError
  } = useWebSocket({ autoConnect: true });

  // Load jobs on component mount
  useEffect(() => {
    loadJobs();
  }, []);

  // Handle real-time job updates
  useEffect(() => {
    const cleanup = onJobUpdate((update) => {
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === update.jobId 
            ? {
                ...job,
                status: update.status,
                progress: update.progress,
                errorMessage: update.error,
                updatedAt: new Date().toISOString()
              }
            : job
        )
      );

      // Show toast notification for significant status changes
      if (update.status === JobStatus.COMPLETED || update.status === JobStatus.FAILED) {
        const job = jobs.find(j => j.id === update.jobId);
        if (job) {
          toast({
            title: `Job "${job.title}" ${update.status === JobStatus.COMPLETED ? 'Completed' : 'Failed'}`,
            description: update.message || `Processing ${update.status}`,
            variant: update.status === JobStatus.COMPLETED ? 'default' : 'destructive',
            duration: 5000,
          });
        }
      }
    });

    return cleanup;
  }, [onJobUpdate, jobs, toast]);

  // Handle WebSocket errors
  useEffect(() => {
    const cleanup = onWebSocketError((error) => {
      console.error('WebSocket error:', error);
      toast({
        title: 'Connection Error',
        description: 'Real-time updates may be delayed',
        variant: 'destructive',
        duration: 3000,
      });
    });

    return cleanup;
  }, [onWebSocketError, toast]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const jobsData = await apiClient.getJobs();
      setJobs(jobsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load jobs';
      setError(errorMessage);
      toast({
        title: 'Error Loading Jobs',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
    toast({
      title: 'Jobs Refreshed',
      description: 'Job list has been updated',
    });
  };

  const handleJobDownload = async (jobId: string) => {
    try {
      // This would typically generate a download URL or trigger a download
      toast({
        title: 'Download Started',
        description: 'Your file download will begin shortly',
      });
    } catch (err) {
      toast({
        title: 'Download Failed',
        description: 'Unable to download the file',
        variant: 'destructive',
      });
    }
  };

  const handleJobCancel = async (jobId: string) => {
    try {
      // This would cancel the job processing
      toast({
        title: 'Job Cancelled',
        description: 'Processing has been stopped',
      });
    } catch (err) {
      toast({
        title: 'Cancel Failed',
        description: 'Unable to cancel the job',
        variant: 'destructive',
      });
    }
  };

  const handleJobRetry = async (jobId: string) => {
    try {
      // This would restart the job processing
      toast({
        title: 'Job Restarted',
        description: 'Processing has been restarted',
      });
    } catch (err) {
      toast({
        title: 'Retry Failed',
        description: 'Unable to restart the job',
        variant: 'destructive',
      });
    }
  };

  const handleJobDelete = async (jobId: string) => {
    try {
      await apiClient.deleteJob(jobId);
      setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      toast({
        title: 'Job Deleted',
        description: 'Job has been removed from your dashboard',
      });
    } catch (err) {
      toast({
        title: 'Delete Failed',
        description: 'Unable to delete the job',
        variant: 'destructive',
      });
    }
  };

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobs;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(query) ||
        job.id.toLowerCase().includes(query) ||
        job.status.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(job => job.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [jobs, searchQuery, filterStatus, sortField, sortDirection]);

  // Categorize jobs for tabs
  const activeJobs = filteredAndSortedJobs.filter(job => 
    [JobStatus.UPLOADED, JobStatus.EXTRACTING_AUDIO, JobStatus.TRANSCRIBING, 
     JobStatus.TRANSLATING, JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO].includes(job.status)
  );

  const completedJobs = filteredAndSortedJobs.filter(job => job.status === JobStatus.COMPLETED);
  const failedJobs = filteredAndSortedJobs.filter(job => job.status === JobStatus.FAILED);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-96 ${className}`}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-gray-600">Loading your jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with connection status and controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Job Processing Dashboard
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Live Updates' : 'Offline'}
                </span>
              </div>
            </div>
            
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search jobs by title, ID, or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value={JobStatus.UPLOADED}>Uploaded</SelectItem>
                  <SelectItem value={JobStatus.EXTRACTING_AUDIO}>Extracting Audio</SelectItem>
                  <SelectItem value={JobStatus.TRANSCRIBING}>Transcribing</SelectItem>
                  <SelectItem value={JobStatus.TRANSLATING}>Translating</SelectItem>
                  <SelectItem value={JobStatus.GENERATING_SPEECH}>Generating Speech</SelectItem>
                  <SelectItem value={JobStatus.ASSEMBLING_AUDIO}>Assembling Audio</SelectItem>
                  <SelectItem value={JobStatus.COMPLETED}>Completed</SelectItem>
                  <SelectItem value={JobStatus.FAILED}>Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                const [field, direction] = value.split('-') as [SortField, SortDirection];
                setSortField(field);
                setSortDirection(direction);
              }}>
                <SelectTrigger className="w-40">
                  {sortDirection === 'asc' ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt-desc">Latest Updated</SelectItem>
                  <SelectItem value="updatedAt-asc">Oldest Updated</SelectItem>
                  <SelectItem value="createdAt-desc">Latest Created</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest Created</SelectItem>
                  <SelectItem value="title-asc">Title A-Z</SelectItem>
                  <SelectItem value="title-desc">Title Z-A</SelectItem>
                  <SelectItem value="progress-desc">Progress High-Low</SelectItem>
                  <SelectItem value="progress-asc">Progress Low-High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Job Statistics */}
          <JobStatistics jobs={jobs} />
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Loader2 className="h-4 w-4" />
            Active ({activeJobs.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed ({completedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="failed" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Failed ({failedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Active Jobs Tab */}
        <TabsContent value="active" className="space-y-6">
          {activeJobs.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeJobs.map((job) => (
                <JobStatusCard
                  key={job.id}
                  job={job}
                  onDownload={handleJobDownload}
                  onCancel={handleJobCancel}
                  onRetry={handleJobRetry}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Active Jobs</h3>
                <p className="text-sm text-gray-500">
                  {jobs.length === 0 
                    ? "Upload a video to start your first dubbing job"
                    : "All your jobs have been completed or are waiting to start"
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Completed Jobs Tab */}
        <TabsContent value="completed" className="space-y-6">
          {completedJobs.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {completedJobs.map((job) => (
                <JobStatusCard
                  key={job.id}
                  job={job}
                  onDownload={handleJobDownload}
                  onCancel={handleJobCancel}
                  onRetry={handleJobRetry}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Completed Jobs</h3>
                <p className="text-sm text-gray-500">
                  Completed jobs will appear here once processing is finished
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Failed Jobs Tab */}
        <TabsContent value="failed" className="space-y-6">
          {failedJobs.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {failedJobs.map((job) => (
                <JobStatusCard
                  key={job.id}
                  job={job}
                  onDownload={handleJobDownload}
                  onCancel={handleJobCancel}
                  onRetry={handleJobRetry}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Failed Jobs</h3>
                <p className="text-sm text-gray-500">
                  Failed jobs will appear here if processing encounters errors
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <JobHistoryTable
            jobs={filteredAndSortedJobs}
            onSort={toggleSort}
            sortField={sortField}
            sortDirection={sortDirection}
            onDownload={handleJobDownload}
            onDelete={handleJobDelete}
            onRetry={handleJobRetry}
          />
        </TabsContent>
      </Tabs>

      {/* Processing Steps Visualization for Selected Job */}
      {selectedJobId && (
        <ProcessingStepsVisualization
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
};
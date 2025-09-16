import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  DollarSign,
  Timer,
  TrendingUp
} from 'lucide-react';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { formatDistanceToNow } from 'date-fns';

interface JobStatisticsProps {
  jobs: DubbingJob[];
}

export const JobStatistics: React.FC<JobStatisticsProps> = ({ jobs }) => {
  // Calculate statistics
  const totalJobs = jobs.length;
  const activeJobs = jobs.filter(job => 
    [JobStatus.UPLOADED, JobStatus.EXTRACTING_AUDIO, JobStatus.TRANSCRIBING, 
     JobStatus.TRANSLATING, JobStatus.GENERATING_SPEECH, JobStatus.ASSEMBLING_AUDIO].includes(job.status)
  ).length;
  const completedJobs = jobs.filter(job => job.status === JobStatus.COMPLETED).length;
  const failedJobs = jobs.filter(job => job.status === JobStatus.FAILED).length;

  // Calculate total processing time and cost
  const totalProcessingTime = jobs.reduce((sum, job) => 
    sum + (job.processingMetrics.totalProcessingTime || 0), 0
  );
  const totalCost = jobs.reduce((sum, job) => 
    sum + job.processingMetrics.costBreakdown.totalCost, 0
  );

  // Calculate average processing time for completed jobs
  const completedJobsWithTime = jobs.filter(job => 
    job.status === JobStatus.COMPLETED && job.processingMetrics.totalProcessingTime
  );
  const averageProcessingTime = completedJobsWithTime.length > 0
    ? completedJobsWithTime.reduce((sum, job) => sum + (job.processingMetrics.totalProcessingTime || 0), 0) / completedJobsWithTime.length
    : 0;

  // Find most recent job
  const mostRecentJob = jobs.length > 0 
    ? jobs.reduce((latest, job) => 
        new Date(job.updatedAt) > new Date(latest.updatedAt) ? job : latest
      )
    : null;

  // Calculate success rate
  const processedJobs = completedJobs + failedJobs;
  const successRate = processedJobs > 0 ? (completedJobs / processedJobs) * 100 : 0;

  const formatDuration = (ms: number) => {
    if (ms === 0) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED:
        return 'text-green-600 bg-green-50';
      case JobStatus.FAILED:
        return 'text-red-600 bg-red-50';
      case JobStatus.UPLOADED:
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-yellow-600 bg-yellow-50';
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
      {/* Total Jobs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold">{totalJobs}</p>
            </div>
            <Activity className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      {/* Active Jobs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-yellow-600">{activeJobs}</p>
            </div>
            <Loader2 className="h-8 w-8 text-yellow-600" />
          </div>
        </CardContent>
      </Card>

      {/* Completed Jobs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedJobs}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      {/* Failed Jobs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{failedJobs}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {processedJobs > 0 ? `${successRate.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      {/* Total Cost */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-purple-600">
                ${totalCost.toFixed(4)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-600" />
          </div>
        </CardContent>
      </Card>

      {/* Additional Statistics Row */}
      <div className="col-span-2 md:col-span-4 lg:col-span-6">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Average Processing Time */}
              <div className="flex items-center gap-3">
                <Timer className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
                  <p className="text-lg font-semibold">
                    {averageProcessingTime > 0 ? formatDuration(averageProcessingTime) : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Total Processing Time */}
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Processing Time</p>
                  <p className="text-lg font-semibold">
                    {totalProcessingTime > 0 ? formatDuration(totalProcessingTime) : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Most Recent Activity */}
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Last Activity</p>
                  {mostRecentJob ? (
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">
                        {formatDistanceToNow(new Date(mostRecentJob.updatedAt), { addSuffix: true })}
                      </p>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getStatusColor(mostRecentJob.status)}`}
                      >
                        {mostRecentJob.status}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold">No activity</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
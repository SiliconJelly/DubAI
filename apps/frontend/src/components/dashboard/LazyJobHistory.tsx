import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LazyList, useLazyLoad } from '@/components/ui/LazyList';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import { 
  Download, 
  Play, 
  MoreHorizontal, 
  Calendar,
  Clock,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LazyJobHistoryProps {
  fetchJobs: (page: number, pageSize: number) => Promise<{ items: DubbingJob[]; hasMore: boolean }>;
  onJobSelect?: (job: DubbingJob) => void;
  onDownload?: (job: DubbingJob) => void;
  onPreview?: (job: DubbingJob) => void;
  className?: string;
}

export function LazyJobHistory({
  fetchJobs,
  onJobSelect,
  onDownload,
  onPreview,
  className
}: LazyJobHistoryProps) {
  const { isMobile, isTablet } = useResponsive();
  
  const {
    items: jobs,
    hasMore,
    isLoading,
    error,
    loadMore,
    refresh
  } = useLazyLoad({
    pageSize: 20,
    fetchPage: fetchJobs
  });

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED:
        return 'bg-green-500 text-white';
      case JobStatus.FAILED:
        return 'bg-red-500 text-white';
      case JobStatus.UPLOADED:
        return 'bg-blue-500 text-white';
      default:
        return 'bg-yellow-500 text-white';
    }
  };

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED:
        return <Download className="h-3 w-3" />;
      case JobStatus.FAILED:
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isMobile) {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderJobItem = (job: DubbingJob, index: number) => (
    <Card 
      key={job.id}
      className={cn(
        'transition-all duration-200 hover:shadow-md cursor-pointer',
        isMobile && 'touch-manipulation'
      )}
      onClick={() => onJobSelect?.(job)}
    >
      <CardContent className={cn(
        'p-4',
        isMobile && 'p-3'
      )}>
        <div className={cn(
          'flex items-center justify-between',
          isMobile && 'flex-col space-y-3 items-stretch'
        )}>
          {/* Job Info */}
          <div className={cn(
            'flex-1 min-w-0',
            isMobile && 'w-full'
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                'p-2 rounded-lg bg-primary/10 flex-shrink-0',
                isMobile && 'p-1.5'
              )}>
                <FileText className={cn(
                  'text-primary',
                  isMobile ? 'h-4 w-4' : 'h-5 w-5'
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  'font-medium text-foreground truncate',
                  isMobile ? 'text-sm' : 'text-base'
                )}>
                  {job.title}
                </h3>
                
                <div className={cn(
                  'flex items-center gap-2 mt-1',
                  isMobile && 'flex-col items-start gap-1'
                )}>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span className="text-xs">
                      {formatDate(job.createdAt)}
                    </span>
                  </div>
                  
                  {job.processingMetrics?.totalProcessingTime && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">
                        {Math.round(job.processingMetrics.totalProcessingTime / 1000)}s
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Status and Actions */}
          <div className={cn(
            'flex items-center gap-3',
            isMobile && 'w-full justify-between'
          )}>
            <Badge 
              className={cn(
                getStatusColor(job.status),
                'flex items-center gap-1',
                isMobile && 'text-xs px-2 py-1'
              )}
            >
              {getStatusIcon(job.status)}
              {job.status}
            </Badge>
            
            {job.status === JobStatus.COMPLETED && (
              <div className={cn(
                'flex items-center gap-1',
                isMobile && 'flex-1 justify-end'
              )}>
                {onPreview && (
                  <Button
                    variant="ghost"
                    size={isMobile ? "sm" : "default"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(job);
                    }}
                    className="touch-manipulation"
                  >
                    <Play className="h-4 w-4" />
                    {!isMobile && <span className="ml-1">Preview</span>}
                  </Button>
                )}
                
                {onDownload && (
                  <Button
                    variant="ghost"
                    size={isMobile ? "sm" : "default"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(job);
                    }}
                    className="touch-manipulation"
                  >
                    <Download className="h-4 w-4" />
                    {!isMobile && <span className="ml-1">Download</span>}
                  </Button>
                )}
              </div>
            )}
            
            {/* More actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size={isMobile ? "sm" : "default"}
                  onClick={(e) => e.stopPropagation()}
                  className="touch-manipulation"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onJobSelect?.(job)}>
                  View Details
                </DropdownMenuItem>
                {job.status === JobStatus.COMPLETED && onDownload && (
                  <DropdownMenuItem onClick={() => onDownload(job)}>
                    Download Files
                  </DropdownMenuItem>
                )}
                {job.status === JobStatus.FAILED && (
                  <DropdownMenuItem>
                    Retry Job
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive">
                  Delete Job
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Progress bar for active jobs */}
        {job.status !== JobStatus.COMPLETED && job.status !== JobStatus.FAILED && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Progress
              </span>
              <span className="text-xs font-medium">
                {job.progress}%
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const emptyComponent = (
    <div className="text-center py-8">
      <div className="p-4 rounded-full bg-muted/50 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground mb-4">
        No jobs found in your history
      </p>
      <Button onClick={refresh} variant="outline">
        Refresh
      </Button>
    </div>
  );

  const loadingComponent = (
    <div className="flex items-center justify-center gap-2 py-4">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
      <span className="text-sm text-muted-foreground">Loading more jobs...</span>
    </div>
  );

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive mb-4">Failed to load job history</p>
          <Button onClick={refresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <LazyList
        items={jobs}
        renderItem={renderJobItem}
        itemHeight={isMobile ? 120 : 100}
        containerHeight={isMobile ? 400 : 500}
        overscan={3}
        onLoadMore={loadMore}
        hasMore={hasMore}
        isLoading={isLoading}
        emptyComponent={emptyComponent}
        loadingComponent={loadingComponent}
        className="space-y-3"
      />
    </div>
  );
}

export default LazyJobHistory;
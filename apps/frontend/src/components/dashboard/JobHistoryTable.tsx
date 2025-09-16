import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { 
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText
} from 'lucide-react';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { formatDistanceToNow, format } from 'date-fns';

interface JobHistoryTableProps {
  jobs: DubbingJob[];
  onSort: (field: SortField) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onDownload: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onViewDetails?: (jobId: string) => void;
}

type SortField = 'createdAt' | 'updatedAt' | 'title' | 'status' | 'progress';
type SortDirection = 'asc' | 'desc';

export const JobHistoryTable: React.FC<JobHistoryTableProps> = ({
  jobs,
  onSort,
  sortField,
  sortDirection,
  onDownload,
  onDelete,
  onRetry,
  onViewDetails
}) => {
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case JobStatus.FAILED:
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case JobStatus.UPLOADED:
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />;
    }
  };

  const getStatusBadge = (status: JobStatus) => {
    const config = {
      [JobStatus.UPLOADED]: { variant: 'secondary' as const, className: 'bg-blue-100 text-blue-800' },
      [JobStatus.EXTRACTING_AUDIO]: { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800' },
      [JobStatus.TRANSCRIBING]: { variant: 'secondary' as const, className: 'bg-orange-100 text-orange-800' },
      [JobStatus.TRANSLATING]: { variant: 'secondary' as const, className: 'bg-purple-100 text-purple-800' },
      [JobStatus.GENERATING_SPEECH]: { variant: 'secondary' as const, className: 'bg-indigo-100 text-indigo-800' },
      [JobStatus.ASSEMBLING_AUDIO]: { variant: 'secondary' as const, className: 'bg-pink-100 text-pink-800' },
      [JobStatus.COMPLETED]: { variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      [JobStatus.FAILED]: { variant: 'destructive' as const, className: 'bg-red-100 text-red-800' }
    };

    const { variant, className } = config[status];
    
    return (
      <Badge variant={variant} className={className}>
        <span className="flex items-center gap-1">
          {getStatusIcon(status)}
          {status.replace('_', ' ').toLowerCase()}
        </span>
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return 'N/A';
    
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

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-semibold hover:bg-transparent"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? 
            <ChevronUp className="h-4 w-4" /> : 
            <ChevronDown className="h-4 w-4" />
        )}
      </span>
    </Button>
  );

  const handleDeleteConfirm = () => {
    if (deleteJobId) {
      onDelete(deleteJobId);
      setDeleteJobId(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Jobs Found</h3>
          <p className="text-sm text-gray-500">
            Your job history will appear here once you start processing videos
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Job History ({jobs.length} jobs)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">
                  <SortButton field="title">Job Title</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="status">Status</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="progress">Progress</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="createdAt">Created</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="updatedAt">Last Updated</SortButton>
                </TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div>
                      <p className="font-medium truncate max-w-[250px]" title={job.title}>
                        {job.title}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {job.id.slice(0, 8)}...
                      </p>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {getStatusBadge(job.status)}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            job.status === JobStatus.COMPLETED ? 'bg-green-500' :
                            job.status === JobStatus.FAILED ? 'bg-red-500' :
                            'bg-blue-500'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 min-w-[3rem]">
                        {job.progress}%
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      <p>{format(new Date(job.createdAt), 'MMM dd, yyyy')}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(job.createdAt), 'HH:mm')}
                      </p>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      <p>{formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(job.updatedAt), 'HH:mm')}
                      </p>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3 text-gray-400" />
                      {formatDuration(job.processingMetrics.totalProcessingTime || 0)}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <DollarSign className="h-3 w-3 text-gray-400" />
                      ${job.processingMetrics.costBreakdown.totalCost.toFixed(4)}
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {onViewDetails && (
                          <>
                            <DropdownMenuItem onClick={() => onViewDetails(job.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        
                        {job.status === JobStatus.COMPLETED && (
                          <DropdownMenuItem onClick={() => onDownload(job.id)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                        )}
                        
                        {job.status === JobStatus.FAILED && (
                          <DropdownMenuItem onClick={() => onRetry(job.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeleteJobId(job.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this job? This action cannot be undone.
                All associated files and processing data will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
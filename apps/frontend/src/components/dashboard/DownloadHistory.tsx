import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { 
  Download,
  Search,
  Filter,
  FileText,
  Music,
  Video,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Archive,
  HardDrive,
  TrendingUp
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { useToast } from '../../hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

interface DownloadHistoryProps {
  className?: string;
}

interface DownloadRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  fileType: 'audio' | 'srt' | 'video';
  filename: string;
  downloadedAt: string;
  fileSize: number;
}

interface DownloadHistoryData {
  downloads: DownloadRecord[];
  totalDownloads: number;
  totalSize: number;
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({ className }) => {
  const { toast } = useToast();
  const [historyData, setHistoryData] = useState<DownloadHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'srt' | 'video'>('all');
  const [sortBy] = useState<'date' | 'size' | 'name'>('date');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadDownloadHistory();
  }, []);

  const loadDownloadHistory = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDownloadHistory();
      setHistoryData(data);
    } catch (error) {
      console.error('Failed to load download history:', error);
      toast({
        title: "Error",
        description: "Failed to load download history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'audio':
        return <Music className="h-4 w-4 text-blue-600" />;
      case 'srt':
        return <FileText className="h-4 w-4 text-green-600" />;
      case 'video':
        return <Video className="h-4 w-4 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getFileTypeBadge = (fileType: string) => {
    const config = {
      audio: { label: 'Audio', className: 'bg-blue-100 text-blue-800' },
      srt: { label: 'Subtitles', className: 'bg-green-100 text-green-800' },
      video: { label: 'Video', className: 'bg-purple-100 text-purple-800' }
    };

    const { label, className } = config[fileType as keyof typeof config] || 
      { label: 'File', className: 'bg-gray-100 text-gray-800' };

    return (
      <Badge variant="secondary" className={className}>
        {getFileTypeIcon(fileType)}
        <span className="ml-1">{label}</span>
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTotalSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
  };

  const filteredAndSortedDownloads = React.useMemo(() => {
    if (!historyData) return [];

    let filtered = historyData.downloads.filter(download => {
      const matchesSearch = download.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           download.jobTitle.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'all' || download.fileType === filterType;
      return matchesSearch && matchesFilter;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.downloadedAt).getTime() - new Date(b.downloadedAt).getTime();
          break;
        case 'size':
          comparison = a.fileSize - b.fileSize;
          break;
        case 'name':
          comparison = a.filename.localeCompare(b.filename);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [historyData, searchTerm, filterType, sortBy, sortOrder]);

  const handleRedownload = async (download: DownloadRecord) => {
    try {
      // This would trigger a re-download of the file
      toast({
        title: "Download Started",
        description: `Re-downloading ${download.filename}`,
      });
    } catch (error) {
      console.error('Re-download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to re-download file",
        variant: "destructive",
      });
    }
  };

  const handleViewJob = (jobId: string) => {
    // Navigate to job details
    window.location.href = `/jobs/${jobId}`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading download history...</p>
        </CardContent>
      </Card>
    );
  }

  if (!historyData || historyData.downloads.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <Download className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Downloads Yet</h3>
          <p className="text-sm text-gray-500">
            Your download history will appear here once you start downloading files
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Download className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Downloads</p>
                <p className="text-2xl font-bold">{historyData.totalDownloads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <HardDrive className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Size</p>
                <p className="text-2xl font-bold">{formatTotalSize(historyData.totalSize)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold">
                  {historyData.downloads.filter(d => 
                    new Date(d.downloadedAt).getMonth() === new Date().getMonth()
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Download History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Download History
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search downloads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>

              {/* Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    {filterType === 'all' ? 'All Types' : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFilterType('all')}>
                    All Types
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterType('audio')}>
                    <Music className="h-4 w-4 mr-2" />
                    Audio Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType('srt')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Subtitle Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType('video')}>
                    <Video className="h-4 w-4 mr-2" />
                    Video Files
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Downloaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedDownloads.map((download) => (
                  <TableRow key={download.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileTypeIcon(download.fileType)}
                        <div>
                          <p className="font-medium truncate max-w-[200px]" title={download.filename}>
                            {download.filename}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {download.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {getFileTypeBadge(download.fileType)}
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <p className="font-medium truncate max-w-[150px]" title={download.jobTitle}>
                          {download.jobTitle}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {download.jobId.slice(0, 8)}...
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm">{formatFileSize(download.fileSize)}</span>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(download.downloadedAt), 'MMM dd, yyyy')}</p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(download.downloadedAt), { addSuffix: true })}
                        </p>
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
                          <DropdownMenuItem onClick={() => handleRedownload(download)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Again
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewJob(download.jobId)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Job
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from History
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAndSortedDownloads.length === 0 && (
            <div className="text-center py-8">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No downloads match your search criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
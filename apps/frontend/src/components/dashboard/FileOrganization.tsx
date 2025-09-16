import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { 
  Folder,
  FolderPlus,
  File,
  Download,
  Share2,
  Trash2,
  MoreHorizontal,
  Search,
  Filter,
  Grid,
  List,
  Calendar,
  FileText,
  Music,
  Video,
  Star,
  Archive,
  Tag,
  Move,
  Copy,
  Eye,
  Clock,
  HardDrive
} from 'lucide-react';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { apiClient } from '../../services/api';
import { useToast } from '../../hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

interface FileOrganizationProps {
  jobs: DubbingJob[];
  onJobSelect?: (job: DubbingJob) => void;
}

interface FileFolder {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  jobCount: number;
  totalSize: number;
  color: string;
}

interface OrganizedFile {
  id: string;
  jobId: string;
  jobTitle: string;
  filename: string;
  fileType: 'audio' | 'srt' | 'video';
  fileSize: number;
  createdAt: string;
  folderId?: string;
  tags: string[];
  isFavorite: boolean;
  downloadCount: number;
  lastDownloaded?: string;
}

export const FileOrganization: React.FC<FileOrganizationProps> = ({ jobs, onJobSelect }) => {
  const { toast } = useToast();
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [files, setFiles] = useState<OrganizedFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'srt' | 'video'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'downloads'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    initializeFileOrganization();
  }, [jobs]);

  const initializeFileOrganization = () => {
    // Initialize with default folders
    const defaultFolders: FileFolder[] = [
      {
        id: 'recent',
        name: 'Recent',
        description: 'Recently completed jobs',
        createdAt: new Date().toISOString(),
        jobCount: 0,
        totalSize: 0,
        color: 'blue'
      },
      {
        id: 'favorites',
        name: 'Favorites',
        description: 'Your favorite results',
        createdAt: new Date().toISOString(),
        jobCount: 0,
        totalSize: 0,
        color: 'yellow'
      },
      {
        id: 'archived',
        name: 'Archived',
        description: 'Archived projects',
        createdAt: new Date().toISOString(),
        jobCount: 0,
        totalSize: 0,
        color: 'gray'
      }
    ];

    // Convert jobs to organized files
    const organizedFiles: OrganizedFile[] = jobs
      .filter(job => job.status === JobStatus.COMPLETED)
      .flatMap(job => {
        const files: OrganizedFile[] = [];
        
        if (job.outputFiles.dubbedAudio) {
          files.push({
            id: `${job.id}-audio`,
            jobId: job.id,
            jobTitle: job.title,
            filename: job.outputFiles.dubbedAudio.filename,
            fileType: 'audio',
            fileSize: job.outputFiles.dubbedAudio.size,
            createdAt: job.updatedAt,
            tags: ['dubbed', 'audio'],
            isFavorite: false,
            downloadCount: 0
          });
        }
        
        if (job.outputFiles.translatedSrt) {
          files.push({
            id: `${job.id}-srt`,
            jobId: job.id,
            jobTitle: job.title,
            filename: job.outputFiles.translatedSrt.filename,
            fileType: 'srt',
            fileSize: job.outputFiles.translatedSrt.size,
            createdAt: job.updatedAt,
            tags: ['subtitles', 'translated'],
            isFavorite: false,
            downloadCount: 0
          });
        }
        
        return files;
      });

    // Update folder counts
    defaultFolders[0].jobCount = organizedFiles.filter(f => 
      new Date(f.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    
    defaultFolders[1].jobCount = organizedFiles.filter(f => f.isFavorite).length;

    setFolders(defaultFolders);
    setFiles(organizedFiles);
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
        return <File className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFolderColor = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  const filteredFiles = React.useMemo(() => {
    let filtered = files.filter(file => {
      const matchesSearch = file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           file.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           file.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = filterType === 'all' || file.fileType === filterType;
      const matchesFolder = !selectedFolder || 
                           (selectedFolder === 'recent' && new Date(file.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
                           (selectedFolder === 'favorites' && file.isFavorite) ||
                           (selectedFolder === 'archived' && file.folderId === 'archived') ||
                           file.folderId === selectedFolder;
      
      return matchesSearch && matchesFilter && matchesFolder;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'size':
          comparison = a.fileSize - b.fileSize;
          break;
        case 'downloads':
          comparison = a.downloadCount - b.downloadCount;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [files, searchTerm, filterType, selectedFolder, sortBy, sortOrder]);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    const newFolder: FileFolder = {
      id: Date.now().toString(),
      name: newFolderName,
      description: newFolderDescription,
      createdAt: new Date().toISOString(),
      jobCount: 0,
      totalSize: 0,
      color: 'blue'
    };

    setFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    setNewFolderDescription('');
    setCreateFolderOpen(false);

    toast({
      title: "Folder Created",
      description: `Created folder "${newFolderName}"`,
    });
  };

  const handleToggleFavorite = (fileId: string) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, isFavorite: !file.isFavorite } : file
    ));
  };

  const handleMoveToFolder = (fileIds: string[], folderId: string) => {
    setFiles(prev => prev.map(file => 
      fileIds.includes(file.id) ? { ...file, folderId } : file
    ));
    setSelectedFiles(new Set());
    
    toast({
      title: "Files Moved",
      description: `Moved ${fileIds.length} file(s) to folder`,
    });
  };

  const handleDownloadFile = async (file: OrganizedFile) => {
    try {
      // Update download count
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, downloadCount: f.downloadCount + 1, lastDownloaded: new Date().toISOString() }
          : f
      ));

      toast({
        title: "Download Started",
        description: `Downloading ${file.filename}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const renderFileGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredFiles.map((file) => (
        <Card key={file.id} className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getFileTypeIcon(file.fileType)}
                <Badge variant="secondary" className="text-xs">
                  {file.fileType.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleToggleFavorite(file.id)}
                >
                  <Star className={`h-3 w-3 ${file.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Move className="h-4 w-4 mr-2" />
                      Move to Folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm truncate" title={file.filename}>
                {file.filename}
              </h4>
              <p className="text-xs text-gray-600 truncate" title={file.jobTitle}>
                {file.jobTitle}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatFileSize(file.fileSize)}</span>
                <span>{format(new Date(file.createdAt), 'MMM dd')}</span>
              </div>
              
              {file.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {file.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                      {tag}
                    </Badge>
                  ))}
                  {file.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      +{file.tags.length - 2}
                    </Badge>
                  )}
                </div>
              )}
              
              {file.downloadCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Download className="h-3 w-3" />
                  <span>{file.downloadCount} downloads</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderFileList = () => (
    <div className="space-y-2">
      {filteredFiles.map((file) => (
        <Card key={file.id} className="hover:bg-gray-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileTypeIcon(file.fileType)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate" title={file.filename}>
                      {file.filename}
                    </h4>
                    {file.isFavorite && (
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 truncate" title={file.jobTitle}>
                    {file.jobTitle}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{formatFileSize(file.fileSize)}</span>
                <span>{formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}</span>
                {file.downloadCount > 0 && (
                  <span>{file.downloadCount} downloads</span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Move className="h-4 w-4 mr-2" />
                      Move to Folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Folders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Folders
            </CardTitle>
            <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Folder</DialogTitle>
                  <DialogDescription>
                    Organize your files by creating custom folders
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="folderName">Folder Name</Label>
                    <Input
                      id="folderName"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Enter folder name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="folderDescription">Description (optional)</Label>
                    <Input
                      id="folderDescription"
                      value={newFolderDescription}
                      onChange={(e) => setNewFolderDescription(e.target.value)}
                      placeholder="Enter folder description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateFolder}>
                    Create Folder
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {folders.map((folder) => (
              <Card 
                key={folder.id} 
                className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                  selectedFolder === folder.id ? getFolderColor(folder.color) : 'border-gray-200'
                }`}
                onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Folder className={`h-5 w-5 ${
                      selectedFolder === folder.id ? 'text-current' : 'text-gray-600'
                    }`} />
                    <h4 className="font-medium">{folder.name}</h4>
                  </div>
                  {folder.description && (
                    <p className="text-xs text-gray-600 mb-2">{folder.description}</p>
                  )}
                  <div className="text-xs text-gray-500">
                    {folder.jobCount} files
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Files */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Files {selectedFolder && `in ${folders.find(f => f.id === selectedFolder)?.name}`}
              <Badge variant="secondary">{filteredFiles.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search files..."
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
                    {filterType === 'all' ? 'All' : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFilterType('all')}>
                    All Types
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterType('audio')}>
                    <Music className="h-4 w-4 mr-2" />
                    Audio
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType('srt')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Subtitles
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType('video')}>
                    <Video className="h-4 w-4 mr-2" />
                    Video
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View Mode */}
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Files Found</h3>
              <p className="text-sm text-gray-500">
                {selectedFolder 
                  ? `No files in this folder match your criteria`
                  : `Complete some jobs to see your files here`
                }
              </p>
            </div>
          ) : (
            viewMode === 'grid' ? renderFileGrid() : renderFileList()
          )}
        </CardContent>
      </Card>
    </div>
  );
};
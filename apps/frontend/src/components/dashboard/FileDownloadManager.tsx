import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Download,
  FileText,
  Star,
  BarChart3,
  FolderOpen
} from 'lucide-react';
import { DubbingJob } from '@dubai/shared';
import { ResultsManager } from './ResultsManager';
import { DownloadHistory } from './DownloadHistory';
import { QualityAssessment } from './QualityAssessment';
import { FileOrganization } from './FileOrganization';

interface FileDownloadManagerProps {
  jobs: DubbingJob[];
  selectedJob?: DubbingJob;
  onJobSelect?: (job: DubbingJob) => void;
}

export const FileDownloadManager: React.FC<FileDownloadManagerProps> = ({
  jobs,
  selectedJob,
  onJobSelect
}) => {
  const [activeTab, setActiveTab] = useState('results');

  const completedJobs = jobs.filter(job => job.status === 'completed');
  const totalDownloads = completedJobs.reduce((acc, job) => {
    let count = 0;
    if (job.outputFiles.dubbedAudio) count++;
    if (job.outputFiles.translatedSrt) count++;
    if (job.outputFiles.finalVideo) count++;
    return acc + count;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Download className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Available Downloads</p>
                <p className="text-2xl font-bold">{totalDownloads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed Jobs</p>
                <p className="text-2xl font-bold">{completedJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Quality</p>
                <p className="text-2xl font-bold">
                  {completedJobs.length > 0 
                    ? (completedJobs.reduce((acc, job) => acc + (job.processingMetrics?.qualityScore || 0), 0) / completedJobs.length).toFixed(1)
                    : '0.0'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Processing</p>
                <p className="text-2xl font-bold">
                  {Math.round(completedJobs.reduce((acc, job) => acc + (job.processingMetrics?.totalDuration || 0), 0) / 3600)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              File Download & Results Management
            </CardTitle>
            {selectedJob && (
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {selectedJob.title}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="results" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Results
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="quality" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Quality
              </TabsTrigger>
              <TabsTrigger value="organize" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Organize
              </TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="mt-6">
              {selectedJob ? (
                <ResultsManager job={selectedJob} />
              ) : (
                <div className="text-center py-12">
                  <Download className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Job</h3>
                  <p className="text-sm text-gray-500">
                    Choose a completed job to view and download results
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <DownloadHistory />
            </TabsContent>

            <TabsContent value="quality" className="mt-6">
              {selectedJob ? (
                <QualityAssessment job={selectedJob} />
              ) : (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Job</h3>
                  <p className="text-sm text-gray-500">
                    Choose a completed job to view quality assessment
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="organize" className="mt-6">
              <FileOrganization jobs={jobs} onJobSelect={onJobSelect} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
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
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { 
  Download,
  Share2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Star,
  FileText,
  Video,
  Music,
  Copy,
  Eye,
  Clock,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { DubbingJob, JobStatus } from '@dubai/shared';
import { apiClient } from '../../services/api';
import { useToast } from '../../hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ResultsManagerProps {
  job: DubbingJob;
}

interface JobResults {
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
}

interface QualityFeedback {
  audioQuality: number;
  translationAccuracy: number;
  overallRating: number;
  comments: string;
  reportIssues: string[];
}

export const ResultsManager: React.FC<ResultsManagerProps> = ({ job }) => {
  const { toast } = useToast();
  const [results, setResults] = useState<JobResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  const [shareOptions, setShareOptions] = useState({
    expiresIn: 24,
    allowDownload: true,
    password: ''
  });
  const [feedback, setFeedback] = useState<QualityFeedback>({
    audioQuality: 5,
    translationAccuracy: 5,
    overallRating: 5,
    comments: '',
    reportIssues: []
  });
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    loadResults();
  }, [job.id]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const jobResults = await apiClient.getJobResults(job.id);
      setResults(jobResults);
    } catch (error) {
      console.error('Failed to load results:', error);
      toast({
        title: "Error",
        description: "Failed to load job results",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      setDownloading(fileId);
      const { downloadUrl } = await apiClient.getFileDownloadUrl(fileId);
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download Started",
        description: `Downloading ${filename}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download file",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleCreateShareLink = async () => {
    try {
      const { shareUrl } = await apiClient.createShareLink(job.id, shareOptions);
      setShareLink(shareUrl);
      toast({
        title: "Share Link Created",
        description: "Share link has been generated successfully",
      });
    } catch (error) {
      console.error('Failed to create share link:', error);
      toast({
        title: "Error",
        description: "Failed to create share link",
        variant: "destructive",
      });
    }
  };

  const handleCopyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast({
        title: "Copied",
        description: "Share link copied to clipboard",
      });
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      setSubmittingFeedback(true);
      await apiClient.submitQualityFeedback(job.id, feedback);
      setFeedbackDialogOpen(false);
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback",
        variant: "destructive",
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleAudioPlay = () => {
    if (audioRef) {
      if (audioPlaying) {
        audioRef.pause();
      } else {
        audioRef.play();
      }
      setAudioPlaying(!audioPlaying);
    }
  };

  const handleAudioMute = () => {
    if (audioRef) {
      audioRef.muted = !audioMuted;
      setAudioMuted(!audioMuted);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderStarRating = (rating: number, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 cursor-pointer transition-colors ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => onRatingChange?.(star)}
          />
        ))}
      </div>
    );
  };

  if (job.status !== JobStatus.COMPLETED) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Processing In Progress</h3>
          <p className="text-sm text-gray-500">
            Results will be available once processing is complete
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading results...</p>
        </CardContent>
      </Card>
    );
  }

  if (!results) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Results Available</h3>
          <p className="text-sm text-gray-500">
            Unable to load results for this job
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Processing Complete
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Job completed {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </DialogTrigger>
              </Dialog>
              
              <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Feedback
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Results Tabs */}
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="files">Output Files</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-4">
            {/* Dubbed Audio */}
            {results.outputFiles.dubbedAudio && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Music className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Dubbed Audio</h4>
                        <p className="text-sm text-gray-600">
                          {results.outputFiles.dubbedAudio.filename} • {formatFileSize(results.outputFiles.dubbedAudio.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Preview functionality would be implemented here
                          console.log('Preview file:', results.outputFiles.dubbedAudio);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(
                          results.outputFiles.dubbedAudio!.id,
                          results.outputFiles.dubbedAudio!.filename
                        )}
                        disabled={downloading === results.outputFiles.dubbedAudio.id}
                      >
                        {downloading === results.outputFiles.dubbedAudio.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Translated SRT */}
            {results.outputFiles.translatedSrt && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FileText className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Translated Subtitles</h4>
                        <p className="text-sm text-gray-600">
                          {results.outputFiles.translatedSrt.filename} • {formatFileSize(results.outputFiles.translatedSrt.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleDownload(
                        results.outputFiles.translatedSrt!.id,
                        results.outputFiles.translatedSrt!.filename
                      )}
                      disabled={downloading === results.outputFiles.translatedSrt.id}
                    >
                      {downloading === results.outputFiles.translatedSrt.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Final Video */}
            {results.outputFiles.finalVideo && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Video className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Final Video</h4>
                        <p className="text-sm text-gray-600">
                          {results.outputFiles.finalVideo.filename} • {formatFileSize(results.outputFiles.finalVideo.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleDownload(
                        results.outputFiles.finalVideo!.id,
                        results.outputFiles.finalVideo!.filename
                      )}
                      disabled={downloading === results.outputFiles.finalVideo.id}
                    >
                      {downloading === results.outputFiles.finalVideo.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audio Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {results.outputFiles.dubbedAudio ? (
                <div className="space-y-4">
                  <audio
                    ref={setAudioRef}
                    src={results.outputFiles.dubbedAudio.downloadUrl}
                    onPlay={() => setAudioPlaying(true)}
                    onPause={() => setAudioPlaying(false)}
                    onEnded={() => setAudioPlaying(false)}
                    className="w-full"
                    controls
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAudioPlay}
                    >
                      {audioPlaying ? (
                        <Pause className="h-4 w-4 mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {audioPlaying ? 'Pause' : 'Play'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAudioMute}
                    >
                      {audioMuted ? (
                        <VolumeX className="h-4 w-4 mr-2" />
                      ) : (
                        <Volume2 className="h-4 w-4 mr-2" />
                      )}
                      {audioMuted ? 'Unmute' : 'Mute'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No audio file available for preview</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {results.qualityMetrics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {results.qualityMetrics.audioQuality}/5
                      </div>
                      <div className="text-sm text-gray-600">Audio Quality</div>
                      {renderStarRating(results.qualityMetrics.audioQuality)}
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {results.qualityMetrics.translationAccuracy}/5
                      </div>
                      <div className="text-sm text-gray-600">Translation Accuracy</div>
                      {renderStarRating(results.qualityMetrics.translationAccuracy)}
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {results.qualityMetrics.overallRating}/5
                      </div>
                      <div className="text-sm text-gray-600">Overall Rating</div>
                      {renderStarRating(results.qualityMetrics.overallRating)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No quality metrics available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Results</DialogTitle>
            <DialogDescription>
              Create a secure link to share your dubbing results
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="expires">Expires in (hours)</Label>
              <Input
                id="expires"
                type="number"
                value={shareOptions.expiresIn}
                onChange={(e) => setShareOptions(prev => ({ ...prev, expiresIn: parseInt(e.target.value) }))}
                min="1"
                max="168"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allowDownload"
                checked={shareOptions.allowDownload}
                onCheckedChange={(checked) => setShareOptions(prev => ({ ...prev, allowDownload: checked as boolean }))}
              />
              <Label htmlFor="allowDownload">Allow downloads</Label>
            </div>
            <div>
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                value={shareOptions.password}
                onChange={(e) => setShareOptions(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Leave empty for no password"
              />
            </div>
            {shareLink && (
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input value={shareLink} readOnly />
                  <Button variant="outline" onClick={handleCopyShareLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateShareLink}>
              Create Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quality Feedback</DialogTitle>
            <DialogDescription>
              Help us improve by rating the quality of your results
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Audio Quality</Label>
              {renderStarRating(feedback.audioQuality, (rating) => 
                setFeedback(prev => ({ ...prev, audioQuality: rating }))
              )}
            </div>
            <div>
              <Label>Translation Accuracy</Label>
              {renderStarRating(feedback.translationAccuracy, (rating) => 
                setFeedback(prev => ({ ...prev, translationAccuracy: rating }))
              )}
            </div>
            <div>
              <Label>Overall Rating</Label>
              {renderStarRating(feedback.overallRating, (rating) => 
                setFeedback(prev => ({ ...prev, overallRating: rating }))
              )}
            </div>
            <div>
              <Label htmlFor="comments">Comments (optional)</Label>
              <Textarea
                id="comments"
                value={feedback.comments}
                onChange={(e) => setFeedback(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Share your thoughts about the results..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback} disabled={submittingFeedback}>
              {submittingFeedback ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
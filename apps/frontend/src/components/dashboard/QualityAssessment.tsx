import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Textarea } from '../ui/textarea';
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
  Star,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  BarChart3,
  Target,
  Award,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Loader2,
  Eye,
  Volume2,
  FileText
} from 'lucide-react';
import { DubbingJob } from '@dubai/shared';
import { apiClient } from '../../services/api';
import { useToast } from '../../hooks/use-toast';

interface QualityAssessmentProps {
  job: DubbingJob;
  className?: string;
}

interface QualityMetrics {
  audioQuality: number;
  translationAccuracy: number;
  overallRating: number;
  processingTime: number;
  costEfficiency: number;
  userSatisfaction?: number;
}

interface QualityFeedback {
  audioQuality: number;
  translationAccuracy: number;
  overallRating: number;
  comments: string;
  reportIssues: string[];
  wouldRecommend: boolean;
}

interface QualityReport {
  metrics: QualityMetrics;
  feedback?: QualityFeedback;
  benchmarks: {
    industryAverage: QualityMetrics;
    personalBest: QualityMetrics;
  };
  recommendations: string[];
  issues: Array<{
    type: 'audio' | 'translation' | 'timing' | 'technical';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestion: string;
  }>;
}

export const QualityAssessment: React.FC<QualityAssessmentProps> = ({ job, className }) => {
  const { toast } = useToast();
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<QualityFeedback>({
    audioQuality: 5,
    translationAccuracy: 5,
    overallRating: 5,
    comments: '',
    reportIssues: [],
    wouldRecommend: true
  });

  useEffect(() => {
    loadQualityReport();
  }, [job.id]);

  const loadQualityReport = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch comprehensive quality metrics
      const mockReport: QualityReport = {
        metrics: {
          audioQuality: 4.2,
          translationAccuracy: 4.5,
          overallRating: 4.3,
          processingTime: job.processingMetrics?.totalProcessingTime || 0,
          costEfficiency: 4.1,
          userSatisfaction: 4.4
        },
        benchmarks: {
          industryAverage: {
            audioQuality: 3.8,
            translationAccuracy: 3.9,
            overallRating: 3.8,
            processingTime: 0,
            costEfficiency: 3.5,
            userSatisfaction: 3.7
          },
          personalBest: {
            audioQuality: 4.8,
            translationAccuracy: 4.9,
            overallRating: 4.7,
            processingTime: 0,
            costEfficiency: 4.6,
            userSatisfaction: 4.8
          }
        },
        recommendations: [
          "Consider using Coqui TTS for better voice naturalness",
          "Audio quality could be improved with noise reduction",
          "Translation accuracy is excellent - keep current settings"
        ],
        issues: [
          {
            type: 'audio',
            severity: 'low',
            description: 'Minor background noise detected',
            suggestion: 'Apply noise reduction filter before processing'
          },
          {
            type: 'timing',
            severity: 'medium',
            description: 'Some segments have slight timing misalignment',
            suggestion: 'Review subtitle timing for better synchronization'
          }
        ]
      };
      
      setQualityReport(mockReport);
    } catch (error) {
      console.error('Failed to load quality report:', error);
      toast({
        title: "Error",
        description: "Failed to load quality assessment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      setSubmittingFeedback(true);
      await apiClient.submitQualityFeedback(job.id, feedback);
      setFeedbackDialogOpen(false);
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback! It helps us improve.",
      });
      
      // Reload quality report to include user feedback
      await loadQualityReport();
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

  const renderStarRating = (rating: number, onRatingChange?: (rating: number) => void, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6'
    };

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClasses[size]} ${onRatingChange ? 'cursor-pointer' : ''} transition-colors ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => onRatingChange?.(star)}
          />
        ))}
      </div>
    );
  };

  const getQualityColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600';
    if (score >= 3.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityBadge = (score: number) => {
    if (score >= 4.5) return { label: 'Excellent', className: 'bg-green-100 text-green-800' };
    if (score >= 3.5) return { label: 'Good', className: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Needs Improvement', className: 'bg-red-100 text-red-800' };
  };

  const getTrendIcon = (current: number, benchmark: number) => {
    if (current > benchmark) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (current < benchmark) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Target className="h-4 w-4 text-gray-600" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Analyzing quality metrics...</p>
        </CardContent>
      </Card>
    );
  }

  if (!qualityReport) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Quality Assessment Unavailable</h3>
          <p className="text-sm text-gray-500">
            Unable to generate quality report for this job
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Quality Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Quality Assessment
            </CardTitle>
            <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Provide Feedback
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <div className="text-4xl font-bold mb-2 text-blue-600">
              {qualityReport.metrics.overallRating.toFixed(1)}/5.0
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              {renderStarRating(qualityReport.metrics.overallRating, undefined, 'lg')}
            </div>
            <Badge className={getQualityBadge(qualityReport.metrics.overallRating).className}>
              {getQualityBadge(qualityReport.metrics.overallRating).label}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Volume2 className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold mb-1 text-blue-600">
                {qualityReport.metrics.audioQuality.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Audio Quality</div>
              {renderStarRating(qualityReport.metrics.audioQuality, undefined, 'sm')}
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <FileText className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold mb-1 text-green-600">
                {qualityReport.metrics.translationAccuracy.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Translation Accuracy</div>
              {renderStarRating(qualityReport.metrics.translationAccuracy, undefined, 'sm')}
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Target className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold mb-1 text-purple-600">
                {qualityReport.metrics.costEfficiency.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Cost Efficiency</div>
              {renderStarRating(qualityReport.metrics.costEfficiency, undefined, 'sm')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(qualityReport.metrics).map(([key, value]) => {
              if (key === 'processingTime') return null;
              
              const industryAvg = qualityReport.benchmarks.industryAverage[key as keyof QualityMetrics] as number;
              const personalBest = qualityReport.benchmarks.personalBest[key as keyof QualityMetrics] as number;
              
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${getQualityColor(value)}`}>
                        {value.toFixed(1)}
                      </span>
                      {getTrendIcon(value, industryAvg)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Progress value={(value / 5) * 100} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Industry Avg: {industryAvg.toFixed(1)}</span>
                      <span>Your Best: {personalBest.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Issues & Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Issues & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qualityReport.issues.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Identified Issues</h4>
                {qualityReport.issues.map((issue, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <Badge className={getSeverityColor(issue.severity)}>
                        {issue.severity.toUpperCase()}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{issue.description}</p>
                        <p className="text-xs text-gray-600 mt-1">{issue.suggestion}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {qualityReport.recommendations.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Recommendations</h4>
                <div className="space-y-2">
                  {qualityReport.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
              <label className="text-sm font-medium">Audio Quality</label>
              <div className="mt-1">
                {renderStarRating(feedback.audioQuality, (rating) => 
                  setFeedback(prev => ({ ...prev, audioQuality: rating }))
                )}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Translation Accuracy</label>
              <div className="mt-1">
                {renderStarRating(feedback.translationAccuracy, (rating) => 
                  setFeedback(prev => ({ ...prev, translationAccuracy: rating }))
                )}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Overall Rating</label>
              <div className="mt-1">
                {renderStarRating(feedback.overallRating, (rating) => 
                  setFeedback(prev => ({ ...prev, overallRating: rating }))
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Would you recommend this service?</label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={feedback.wouldRecommend ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFeedback(prev => ({ ...prev, wouldRecommend: true }))}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  Yes
                </Button>
                <Button
                  variant={!feedback.wouldRecommend ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFeedback(prev => ({ ...prev, wouldRecommend: false }))}
                >
                  <ThumbsDown className="h-4 w-4 mr-1" />
                  No
                </Button>
              </div>
            </div>
            
            <div>
              <label htmlFor="comments" className="text-sm font-medium">Comments (optional)</label>
              <Textarea
                id="comments"
                value={feedback.comments}
                onChange={(e) => setFeedback(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Share your thoughts about the results..."
                className="mt-1"
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
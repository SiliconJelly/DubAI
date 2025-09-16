import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Zap, 
  DollarSign, 
  Star, 
  Clock, 
  Info,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { apiClient } from '@/services/api';

interface ServiceRecommendation {
  recommendedService: string;
  reasoning: string;
  costEstimate: number;
  qualityScore: number;
}

interface ServiceSelectorProps {
  charactersToProcess?: number;
  onServiceSelected?: (service: string, recommendation: ServiceRecommendation) => void;
  defaultQuality?: 'high' | 'medium' | 'low';
  showEstimation?: boolean;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  charactersToProcess = 1000,
  onServiceSelected,
  defaultQuality = 'medium',
  showEstimation = true
}) => {
  const [qualityRequirement, setQualityRequirement] = useState<'high' | 'medium' | 'low'>(defaultQuality);
  const [selectedService, setSelectedService] = useState<'auto' | 'google_cloud' | 'coqui_local'>('auto');
  const [recommendation, setRecommendation] = useState<ServiceRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimatedCharacters, setEstimatedCharacters] = useState(charactersToProcess);

  useEffect(() => {
    if (selectedService === 'auto') {
      getRecommendation();
    }
  }, [qualityRequirement, estimatedCharacters, selectedService]);

  const getRecommendation = async () => {
    if (selectedService !== 'auto') return;
    
    try {
      setLoading(true);
      setError(null);
      
      const rec = await apiClient.getOptimalService(estimatedCharacters, qualityRequirement);
      setRecommendation(rec);
      
      if (onServiceSelected) {
        onServiceSelected(rec.recommendedService, rec);
      }
    } catch (err) {
      console.error('Error getting service recommendation:', err);
      setError(err instanceof Error ? err.message : 'Failed to get recommendation');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceChange = (service: 'auto' | 'google_cloud' | 'coqui_local') => {
    setSelectedService(service);
    
    if (service !== 'auto') {
      // Create a manual recommendation
      const manualRec: ServiceRecommendation = {
        recommendedService: service,
        reasoning: 'Manually selected by user',
        costEstimate: service === 'google_cloud' 
          ? estimatedCharacters * 0.000016 
          : estimatedCharacters * 0.000005,
        qualityScore: service === 'google_cloud' 
          ? (qualityRequirement === 'high' ? 9 : qualityRequirement === 'medium' ? 9 : 8)
          : (qualityRequirement === 'high' ? 7 : qualityRequirement === 'medium' ? 8 : 8)
      };
      
      setRecommendation(manualRec);
      
      if (onServiceSelected) {
        onServiceSelected(service, manualRec);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'google_cloud':
        return <Zap className="h-4 w-4" />;
      case 'coqui_local':
        return <Star className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getServiceName = (service: string) => {
    switch (service) {
      case 'google_cloud':
        return 'Google TTS';
      case 'coqui_local':
        return 'Coqui TTS';
      default:
        return 'Auto Select';
    }
  };

  const getServiceDescription = (service: string) => {
    switch (service) {
      case 'google_cloud':
        return 'High-quality cloud-based text-to-speech with natural voices';
      case 'coqui_local':
        return 'Cost-effective local processing with good quality';
      default:
        return 'Automatically choose the best service based on your requirements';
    }
  };

  const getQualityDescription = (quality: string) => {
    switch (quality) {
      case 'high':
        return 'Premium quality for professional content';
      case 'medium':
        return 'Good balance of quality and cost';
      case 'low':
        return 'Basic quality for draft content';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Character Estimation */}
      {showEstimation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Text Length Estimation</CardTitle>
            <CardDescription>
              Estimate the number of characters to be processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="characters">Characters to process: {estimatedCharacters.toLocaleString()}</Label>
                <Slider
                  id="characters"
                  min={100}
                  max={50000}
                  step={100}
                  value={[estimatedCharacters]}
                  onValueChange={(value) => setEstimatedCharacters(value[0])}
                  className="mt-2"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>• Short text (100-1,000 chars): Single paragraph or subtitle segment</p>
                <p>• Medium text (1,000-10,000 chars): Article or multiple subtitles</p>
                <p>• Long text (10,000+ chars): Full document or movie subtitles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Requirement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quality Requirement</CardTitle>
          <CardDescription>
            Choose the quality level for your text-to-speech conversion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={qualityRequirement}
            onValueChange={(value) => setQualityRequirement(value as 'high' | 'medium' | 'low')}
          >
            <div className="space-y-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">High Quality</div>
                      <div className="text-sm text-muted-foreground">
                        {getQualityDescription('high')}
                      </div>
                    </div>
                    <Badge variant="outline">Premium</Badge>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Medium Quality</div>
                      <div className="text-sm text-muted-foreground">
                        {getQualityDescription('medium')}
                      </div>
                    </div>
                    <Badge variant="outline">Recommended</Badge>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="low" id="low" />
                <Label htmlFor="low" className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Low Quality</div>
                      <div className="text-sm text-muted-foreground">
                        {getQualityDescription('low')}
                      </div>
                    </div>
                    <Badge variant="outline">Budget</Badge>
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Service Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">TTS Service Selection</CardTitle>
          <CardDescription>
            Choose how to select the text-to-speech service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selectedService}
            onValueChange={(value) => handleServiceChange(value as any)}
          >
            <div className="space-y-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="auto" id="auto" />
                <Label htmlFor="auto" className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getServiceIcon('auto')}
                      <div>
                        <div className="font-medium">Automatic Selection</div>
                        <div className="text-sm text-muted-foreground">
                          {getServiceDescription('auto')}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">Smart</Badge>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="google_cloud" id="google_cloud" />
                <Label htmlFor="google_cloud" className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getServiceIcon('google_cloud')}
                      <div>
                        <div className="font-medium">Google TTS</div>
                        <div className="text-sm text-muted-foreground">
                          {getServiceDescription('google_cloud')}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">Cloud</Badge>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="coqui_local" id="coqui_local" />
                <Label htmlFor="coqui_local" className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getServiceIcon('coqui_local')}
                      <div>
                        <div className="font-medium">Coqui TTS</div>
                        <div className="text-sm text-muted-foreground">
                          {getServiceDescription('coqui_local')}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">Local</Badge>
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Recommendation Display */}
      {recommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedService === 'auto' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Recommended Service
                </>
              ) : (
                <>
                  {getServiceIcon(selectedService)}
                  Selected Service
                </>
              )}
            </CardTitle>
            <CardDescription>
              {selectedService === 'auto' 
                ? 'Based on your requirements and current quota status'
                : 'Manual selection override'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Service Info */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {getServiceIcon(recommendation.recommendedService)}
                  <div>
                    <div className="font-medium text-lg">
                      {getServiceName(recommendation.recommendedService)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getServiceDescription(recommendation.recommendedService)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4" />
                    Quality: {recommendation.qualityScore}/10
                  </div>
                </div>
              </div>

              {/* Cost and Reasoning */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="h-4 w-4" />
                    Estimated Cost
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(recommendation.costEstimate)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    For {estimatedCharacters.toLocaleString()} characters
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="h-4 w-4" />
                    Reasoning
                  </div>
                  <div className="text-sm">
                    {recommendation.reasoning}
                  </div>
                </div>
              </div>

              {/* Cost Comparison */}
              <div className="border-t pt-4">
                <div className="text-sm font-medium mb-2">Cost Comparison</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Google TTS:</span>
                    <span className="text-sm font-mono">
                      {formatCurrency(estimatedCharacters * 0.000016)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Coqui TTS:</span>
                    <span className="text-sm font-mono">
                      {formatCurrency(estimatedCharacters * 0.000005)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-medium border-t pt-2">
                    <span className="text-sm">Selected Service:</span>
                    <span className="text-sm font-mono">
                      {formatCurrency(recommendation.costEstimate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
};
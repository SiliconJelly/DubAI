import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  Zap, 
  Star, 
  Calculator,
  TrendingUp,
  Info,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useCostTracking } from '@/hooks/useCostTracking';

interface PricingTier {
  name: string;
  description: string;
  monthlyLimit: number;
  pricePerCharacter: number;
  features: string[];
  recommended?: boolean;
}

interface ServicePricing {
  service: 'google_cloud' | 'coqui_local';
  name: string;
  description: string;
  pricePerCharacter: number;
  qualityScore: number;
  processingSpeed: 'fast' | 'medium' | 'slow';
  features: string[];
  limitations?: string[];
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    description: 'Perfect for getting started',
    monthlyLimit: 4000000, // 4M characters
    pricePerCharacter: 0,
    features: [
      '4M characters per month',
      'Google TTS access',
      'Coqui TTS unlimited',
      'Basic support',
      'Standard quality'
    ]
  },
  {
    name: 'Basic',
    description: 'For regular users',
    monthlyLimit: 10000000, // 10M characters
    pricePerCharacter: 0.000012,
    features: [
      '10M characters per month',
      'All TTS services',
      'Priority processing',
      'Email support',
      'High quality voices'
    ]
  },
  {
    name: 'Pro',
    description: 'For professionals',
    monthlyLimit: 50000000, // 50M characters
    pricePerCharacter: 0.000008,
    features: [
      '50M characters per month',
      'Premium voices',
      'Batch processing',
      'API access',
      'Priority support',
      'Custom voice training'
    ],
    recommended: true
  },
  {
    name: 'Enterprise',
    description: 'For large organizations',
    monthlyLimit: -1, // Unlimited
    pricePerCharacter: 0.000005,
    features: [
      'Unlimited characters',
      'Custom deployment',
      'Dedicated support',
      'SLA guarantee',
      'Advanced analytics',
      'White-label options'
    ]
  }
];

const SERVICE_PRICING: ServicePricing[] = [
  {
    service: 'google_cloud',
    name: 'Google Cloud TTS',
    description: 'High-quality neural voices with natural intonation',
    pricePerCharacter: 0.000016,
    qualityScore: 9,
    processingSpeed: 'fast',
    features: [
      'WaveNet neural voices',
      '220+ voices in 40+ languages',
      'SSML support',
      'Custom voice training',
      'Real-time streaming',
      '99.9% uptime SLA'
    ],
    limitations: [
      '4M characters free per month',
      'Requires internet connection',
      'Usage-based pricing after free tier'
    ]
  },
  {
    service: 'coqui_local',
    name: 'Coqui TTS (Local)',
    description: 'Open-source TTS running locally for privacy and cost control',
    pricePerCharacter: 0.000005,
    qualityScore: 7,
    processingSpeed: 'medium',
    features: [
      'Complete privacy (local processing)',
      'No usage limits',
      'Customizable models',
      'Multiple voice options',
      'Offline capability',
      'One-time setup cost'
    ],
    limitations: [
      'Requires local compute resources',
      'Setup complexity',
      'Limited voice variety compared to cloud'
    ]
  }
];

interface PricingDisplayProps {
  showCalculator?: boolean;
  showComparison?: boolean;
  currentUsage?: number;
}

export const PricingDisplay: React.FC<PricingDisplayProps> = ({
  showCalculator = true,
  showComparison = true,
  currentUsage
}) => {
  const { quotaStatus, costBreakdown, usageMetrics } = useCostTracking();
  const [calculatorCharacters, setCalculatorCharacters] = useState(10000);
  const [selectedTier, setSelectedTier] = useState<string>('free');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const calculateMonthlyCost = (characters: number, tier: PricingTier) => {
    if (tier.name === 'Free') {
      return characters <= tier.monthlyLimit ? 0 : (characters - tier.monthlyLimit) * 0.000016;
    }
    return characters * tier.pricePerCharacter;
  };

  const getCurrentTier = () => {
    const monthlyUsage = currentUsage || quotaStatus?.googleTTS.used || 0;
    
    if (monthlyUsage <= PRICING_TIERS[0].monthlyLimit) return PRICING_TIERS[0];
    if (monthlyUsage <= PRICING_TIERS[1].monthlyLimit) return PRICING_TIERS[1];
    if (monthlyUsage <= PRICING_TIERS[2].monthlyLimit) return PRICING_TIERS[2];
    return PRICING_TIERS[3];
  };

  const getRecommendedTier = (projectedUsage: number) => {
    for (const tier of PRICING_TIERS) {
      if (tier.monthlyLimit === -1 || projectedUsage <= tier.monthlyLimit) {
        return tier;
      }
    }
    return PRICING_TIERS[PRICING_TIERS.length - 1];
  };

  const currentTier = getCurrentTier();
  const monthlyUsage = currentUsage || quotaStatus?.googleTTS.used || 0;

  return (
    <div className="space-y-6">
      {/* Current Usage Overview */}
      {quotaStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Current Usage & Costs
            </CardTitle>
            <CardDescription>
              Your usage this month and associated costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatNumber(monthlyUsage)}
                </div>
                <div className="text-sm text-muted-foreground">Characters Used</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {quotaStatus.googleTTS.percentageUsed.toFixed(1)}% of free tier
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {costBreakdown ? formatCurrency(costBreakdown.totalCost) : '$0.0000'}
                </div>
                <div className="text-sm text-muted-foreground">Total Cost</div>
                <div className="text-xs text-muted-foreground mt-1">
                  This month
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {currentTier.name}
                </div>
                <div className="text-sm text-muted-foreground">Current Tier</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {currentTier.description}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tiers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tiers">Pricing Tiers</TabsTrigger>
          <TabsTrigger value="services">Service Comparison</TabsTrigger>
          {showCalculator && <TabsTrigger value="calculator">Cost Calculator</TabsTrigger>}
        </TabsList>

        {/* Pricing Tiers */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PRICING_TIERS.map((tier) => (
              <Card key={tier.name} className={`relative ${tier.recommended ? 'border-primary' : ''}`}>
                {tier.recommended && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    Recommended
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {tier.name}
                    {tier.name === currentTier.name && (
                      <Badge variant="outline">Current</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="text-3xl font-bold">
                        {tier.pricePerCharacter === 0 
                          ? 'Free' 
                          : formatCurrency(tier.pricePerCharacter)
                        }
                      </div>
                      {tier.pricePerCharacter > 0 && (
                        <div className="text-sm text-muted-foreground">per character</div>
                      )}
                    </div>
                    
                    <div className="text-sm">
                      <div className="font-medium">
                        {tier.monthlyLimit === -1 
                          ? 'Unlimited characters' 
                          : `${formatNumber(tier.monthlyLimit)} characters/month`
                        }
                      </div>
                    </div>
                    
                    <ul className="space-y-1 text-sm">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      className="w-full" 
                      variant={tier.name === currentTier.name ? "outline" : "default"}
                      disabled={tier.name === currentTier.name}
                    >
                      {tier.name === currentTier.name ? 'Current Plan' : `Upgrade to ${tier.name}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Service Comparison */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {SERVICE_PRICING.map((service) => (
              <Card key={service.service}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {service.service === 'google_cloud' ? (
                      <Zap className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Star className="h-5 w-5 text-green-500" />
                    )}
                    {service.name}
                  </CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Pricing */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Price per character:</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(service.pricePerCharacter)}
                      </span>
                    </div>
                    
                    {/* Quality and Speed */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Quality Score:</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">{service.qualityScore}/10</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Speed:</span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium capitalize">{service.processingSpeed}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Features */}
                    <div>
                      <div className="text-sm font-medium mb-2">Features:</div>
                      <ul className="space-y-1 text-sm">
                        {service.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Limitations */}
                    {service.limitations && (
                      <div>
                        <div className="text-sm font-medium mb-2">Limitations:</div>
                        <ul className="space-y-1 text-sm">
                          {service.limitations.map((limitation, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <Info className="h-3 w-3 text-yellow-500" />
                              {limitation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Cost Comparison Chart */}
          {showComparison && (
            <Card>
              <CardHeader>
                <CardTitle>Cost Comparison by Usage</CardTitle>
                <CardDescription>
                  Compare costs between services at different usage levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1000, 10000, 100000, 1000000, 10000000].map((characters) => (
                    <div key={characters} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="font-medium">
                        {formatNumber(characters)} characters
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Google TTS: </span>
                          <span className="font-medium">
                            {formatCurrency(characters * SERVICE_PRICING[0].pricePerCharacter)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Coqui TTS: </span>
                          <span className="font-medium">
                            {formatCurrency(characters * SERVICE_PRICING[1].pricePerCharacter)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Savings: </span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(characters * (SERVICE_PRICING[0].pricePerCharacter - SERVICE_PRICING[1].pricePerCharacter))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cost Calculator */}
        {showCalculator && (
          <TabsContent value="calculator" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Cost Calculator
                </CardTitle>
                <CardDescription>
                  Estimate your monthly costs based on expected usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Input */}
                  <div>
                    <label className="text-sm font-medium">
                      Expected monthly characters: {formatNumber(calculatorCharacters)}
                    </label>
                    <input
                      type="range"
                      min="1000"
                      max="50000000"
                      step="1000"
                      value={calculatorCharacters}
                      onChange={(e) => setCalculatorCharacters(parseInt(e.target.value))}
                      className="w-full mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>1K</span>
                      <span>50M</span>
                    </div>
                  </div>
                  
                  {/* Results */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {PRICING_TIERS.map((tier) => {
                      const cost = calculateMonthlyCost(calculatorCharacters, tier);
                      const isRecommended = tier === getRecommendedTier(calculatorCharacters);
                      
                      return (
                        <div 
                          key={tier.name} 
                          className={`p-4 border rounded-lg ${isRecommended ? 'border-primary bg-primary/5' : ''}`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium">{tier.name}</h4>
                            {isRecommended && (
                              <Badge variant="outline">Recommended</Badge>
                            )}
                          </div>
                          <div className="text-2xl font-bold">
                            {formatCurrency(cost)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            per month
                          </div>
                          {tier.monthlyLimit !== -1 && calculatorCharacters > tier.monthlyLimit && (
                            <div className="text-xs text-red-500 mt-1">
                              Exceeds limit by {formatNumber(calculatorCharacters - tier.monthlyLimit)} characters
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Service Breakdown */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Service Cost Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Google TTS only:</span>
                        <span className="font-medium">
                          {formatCurrency(calculatorCharacters * SERVICE_PRICING[0].pricePerCharacter)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Coqui TTS only:</span>
                        <span className="font-medium">
                          {formatCurrency(calculatorCharacters * SERVICE_PRICING[1].pricePerCharacter)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-sm font-medium">Potential savings with Coqui:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(calculatorCharacters * (SERVICE_PRICING[0].pricePerCharacter - SERVICE_PRICING[1].pricePerCharacter))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
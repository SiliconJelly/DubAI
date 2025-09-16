import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CostDashboard } from '../CostDashboard';
import { useCostTracking } from '@/hooks/useCostTracking';

// Mock the cost tracking hook
vi.mock('@/hooks/useCostTracking');

// Mock recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />
}));

const mockCostTrackingData = {
  costBreakdown: {
    googleTTSCost: 0.0032,
    coquiTTSCost: 0.0008,
    processingCost: 0.004,
    storageCost: 0.0001,
    totalCost: 0.0041,
    currency: 'USD'
  },
  usageMetrics: {
    totalCharacters: 25000,
    totalApiCalls: 15,
    totalProcessingTime: 45000,
    serviceBreakdown: {
      google_cloud: {
        characters: 20000,
        apiCalls: 12,
        processingTime: 30000,
        cost: 0.0032
      },
      coqui_local: {
        characters: 5000,
        apiCalls: 3,
        processingTime: 15000,
        cost: 0.0008
      }
    },
    dailyUsage: [
      {
        date: '2024-12-15',
        characters: 10000,
        cost: 0.0016,
        service: 'google_cloud'
      },
      {
        date: '2024-12-16',
        characters: 15000,
        cost: 0.0025,
        service: 'google_cloud'
      }
    ]
  },
  quotaStatus: {
    googleTTS: {
      used: 1500000,
      limit: 4000000,
      remaining: 2500000,
      resetDate: '2025-01-01T00:00:00Z',
      percentageUsed: 37.5
    },
    monthlyBudget: {
      used: 0.0041,
      limit: 10.0,
      remaining: 9.9959,
      percentageUsed: 0.041
    }
  },
  recommendations: [
    {
      type: 'service_switch' as const,
      title: 'Consider Coqui TTS for Cost Savings',
      description: 'You could save money by using Coqui TTS for non-critical content.',
      potentialSavings: 0.0024,
      impact: 'medium' as const,
      actionRequired: 'Enable automatic service selection'
    }
  ],
  alerts: [],
  costSavings: {
    totalCost: 0.0041,
    totalCharacters: 25000,
    actualSavings: 0.0008,
    potentialSavings: 0.0024,
    savingsPercentage: 16.3,
    serviceDistribution: {
      googleTTS: {
        characters: 20000,
        cost: 0.0032,
        percentage: 80
      },
      coquiTTS: {
        characters: 5000,
        cost: 0.0008,
        percentage: 20
      }
    }
  },
  loading: false,
  error: null,
  refresh: vi.fn(),
  setTimeframe: vi.fn(),
  getOptimalService: vi.fn(),
  hasAlerts: false,
  hasCriticalAlerts: false,
  totalSavings: 0.0008,
  quotaWarningLevel: 'safe' as const
};

describe('CostDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCostTracking as any).mockReturnValue(mockCostTrackingData);
  });

  it('renders cost dashboard with overview cards', async () => {
    render(<CostDashboard />);

    // Check if main title is rendered
    expect(screen.getByText('Cost Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Track your usage, costs, and optimize your TTS service selection')).toBeInTheDocument();

    // Check overview cards
    await waitFor(() => {
      expect(screen.getByText('Total Cost')).toBeInTheDocument();
      expect(screen.getByText('$0.0041')).toBeInTheDocument();
      expect(screen.getByText('Characters Processed')).toBeInTheDocument();
      expect(screen.getByText('25,000')).toBeInTheDocument();
      expect(screen.getByText('Cost Savings')).toBeInTheDocument();
      expect(screen.getByText('$0.0008')).toBeInTheDocument();
      expect(screen.getByText('Google TTS Quota')).toBeInTheDocument();
      expect(screen.getByText('37.5%')).toBeInTheDocument();
    });
  });

  it('displays tabs for different views', () => {
    render(<CostDashboard />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Usage Details' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Optimization' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Quota Management' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (useCostTracking as any).mockReturnValue({
      ...mockCostTrackingData,
      loading: true
    });

    render(<CostDashboard />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error state', () => {
    (useCostTracking as any).mockReturnValue({
      ...mockCostTrackingData,
      loading: false,
      error: 'Failed to load cost data'
    });

    render(<CostDashboard />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load cost data')).toBeInTheDocument();
  });

  it('displays optimization recommendations', async () => {
    render(<CostDashboard />);

    // Click on optimization tab
    const optimizationTab = screen.getByRole('tab', { name: 'Optimization' });
    optimizationTab.click();

    await waitFor(() => {
      expect(screen.getByText('Optimization Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Consider Coqui TTS for Cost Savings')).toBeInTheDocument();
      expect(screen.getByText('You could save money by using Coqui TTS for non-critical content.')).toBeInTheDocument();
      expect(screen.getByText('$0.0024')).toBeInTheDocument();
    });
  });

  it('displays quota status', async () => {
    render(<CostDashboard />);

    // Click on quota tab
    const quotaTab = screen.getByRole('tab', { name: 'Quota Management' });
    quotaTab.click();

    await waitFor(() => {
      expect(screen.getByText('Google TTS Quota')).toBeInTheDocument();
      expect(screen.getByText('Free tier: 4M characters per month')).toBeInTheDocument();
      expect(screen.getByText('1,500,000 / 4,000,000')).toBeInTheDocument();
      expect(screen.getByText('Monthly Budget')).toBeInTheDocument();
      expect(screen.getByText('$0.0041 / $10.0000')).toBeInTheDocument();
    });
  });

  it('handles timeframe changes', () => {
    render(<CostDashboard />);

    const timeframeSelect = screen.getByDisplayValue('Last Month');
    expect(timeframeSelect).toBeInTheDocument();

    // Change timeframe
    timeframeSelect.click();
    // Note: In a real test, you'd simulate selecting a different option
  });

  it('displays service distribution', async () => {
    render(<CostDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Service Distribution')).toBeInTheDocument();
      expect(screen.getByText('Google TTS')).toBeInTheDocument();
      expect(screen.getByText('80.0%')).toBeInTheDocument();
      expect(screen.getByText('Coqui TTS')).toBeInTheDocument();
      expect(screen.getByText('20.0%')).toBeInTheDocument();
    });
  });

  it('shows no data message when no cost data available', () => {
    (useCostTracking as any).mockReturnValue({
      ...mockCostTrackingData,
      costBreakdown: null,
      usageMetrics: null
    });

    render(<CostDashboard />);

    expect(screen.getByText('No cost data available')).toBeInTheDocument();
  });

  it('displays alerts when present', () => {
    (useCostTracking as any).mockReturnValue({
      ...mockCostTrackingData,
      alerts: [
        {
          service: 'google_cloud',
          currentUsage: 3600000,
          limit: 4000000,
          threshold: 90,
          severity: 'critical',
          message: 'Google TTS quota is 90% exhausted',
          recommendedAction: 'Switch to Coqui TTS or wait for quota reset'
        }
      ],
      hasAlerts: true,
      hasCriticalAlerts: true
    });

    render(<CostDashboard />);

    expect(screen.getByText('Google TTS quota is 90% exhausted')).toBeInTheDocument();
    expect(screen.getByText('Switch to Coqui TTS or wait for quota reset')).toBeInTheDocument();
  });
});
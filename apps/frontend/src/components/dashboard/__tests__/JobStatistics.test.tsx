import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JobStatistics } from '../JobStatistics';
import { DubbingJob, JobStatus } from '@dubai/shared';

const mockJobs: DubbingJob[] = [
  {
    id: 'job-1',
    userId: 'user-1',
    title: 'Test Job 1',
    status: JobStatus.COMPLETED,
    progress: 100,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
    inputFiles: {},
    outputFiles: {},
    processingMetrics: {
      totalProcessingTime: 120000,
      ttsService: 'google',
      costBreakdown: {
        transcriptionCost: 0.01,
        translationCost: 0.005,
        ttsCost: 0.02,
        processingCost: 0.001,
        totalCost: 0.036
      }
    }
  },
  {
    id: 'job-2',
    userId: 'user-1',
    title: 'Test Job 2',
    status: JobStatus.TRANSCRIBING,
    progress: 45,
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    inputFiles: {},
    outputFiles: {},
    processingMetrics: {
      ttsService: 'coqui',
      costBreakdown: {
        transcriptionCost: 0,
        translationCost: 0,
        ttsCost: 0,
        processingCost: 0,
        totalCost: 0
      }
    }
  },
  {
    id: 'job-3',
    userId: 'user-1',
    title: 'Test Job 3',
    status: JobStatus.FAILED,
    progress: 0,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:30:00Z',
    inputFiles: {},
    outputFiles: {},
    processingMetrics: {
      costBreakdown: {
        transcriptionCost: 0,
        translationCost: 0,
        ttsCost: 0,
        processingCost: 0,
        totalCost: 0
      }
    },
    errorMessage: 'Processing failed'
  }
];

describe('JobStatistics', () => {
  it('renders job statistics correctly', () => {
    render(<JobStatistics jobs={mockJobs} />);
    
    // Check total jobs
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    
    // Check active jobs (transcribing)
    expect(screen.getByText('Active')).toBeInTheDocument();
    
    // Check completed jobs
    expect(screen.getByText('Completed')).toBeInTheDocument();
    
    // Check failed jobs
    expect(screen.getByText('Failed')).toBeInTheDocument();
    
    // Check success rate
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    
    // Check total cost
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
  });

  it('handles empty jobs array', () => {
    render(<JobStatistics jobs={[]} />);
    
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(4); // Total, Active, Completed, Failed
  });

  it('calculates success rate correctly', () => {
    render(<JobStatistics jobs={mockJobs} />);
    
    // With 1 completed and 1 failed job, success rate should be 50%
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  it('displays total cost correctly', () => {
    render(<JobStatistics jobs={mockJobs} />);
    
    // Total cost should be $0.0360 (only from completed job)
    expect(screen.getByText('$0.0360')).toBeInTheDocument();
  });
});
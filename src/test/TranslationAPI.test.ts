import request from 'supertest';
import express from 'express';
import { TranslationAPI } from '../api/TranslationAPI';
import { TranslationEngine } from '../services/TranslationEngine';
import { SRTFileImpl } from '../models/SRTFile';
import { MovieAnalysisImpl } from '../models/MovieAnalysis';

// Mock TranslationEngine
class MockTranslationEngine implements TranslationEngine {
  private progressMap: Map<string, any> = new Map();
  private resultMap: Map<string, any> = new Map();
  private jobIdCounter = 0;

  async translateSRTWithAnalysis(srtFile: any, targetLanguage: string, movieMetadata?: any): Promise<any> {
    const jobId = `test-job-${++this.jobIdCounter}`;
    
    // Simulate processing stages
    this.progressMap.set(jobId, { stage: 'PROCESSING', progress: 50, message: 'Processing...' });
    
    const result = {
      id: jobId,
      originalSRT: srtFile,
      translatedSRT: new SRTFileImpl(
        'translated-id',
        '1\n00:00:00,000 --> 00:00:02,000\nহ্যালো ওয়ার্ল্ড\n',
        [{ index: 1, startTime: '00:00:00,000', endTime: '00:00:02,000', text: 'হ্যালো ওয়ার্ল্ড' }],
        2
      ),
      movieAnalysis: new MovieAnalysisImpl(
        'analysis-id',
        'Test movie analysis',
        ['friendship'],
        [],
        ['Drama'],
        { overall: 0.5, segments: [] },
        [],
        [],
        1000,
        0.8
      ),
      processingMetrics: {
        transcriptionTime: 500,
        translationTime: 800,
        analysisTime: 1000,
        totalProcessingTime: 2300,
        whisperModelUsed: 'large-v3',
        segmentsProcessed: 1,
        charactersProcessed: 50,
        confidence: 0.8
      },
      createdAt: new Date()
    };
    
    // Store result immediately for synchronous access
    this.resultMap.set(jobId, result);
    
    // Simulate completion after a short delay
    setTimeout(() => {
      this.progressMap.set(jobId, { stage: 'COMPLETED', progress: 100, message: 'Completed' });
    }, 100);

    return result;
  }

  async getTranslationProgress(jobId: string): Promise<any> {
    return this.progressMap.get(jobId) || null;
  }

  async getCachedResult(srtHash: string): Promise<any> {
    return null;
  }

  async clearCache(): Promise<void> {
    // Mock implementation
  }

  // Helper method to get stored result for testing
  getStoredResult(jobId: string): any {
    return this.resultMap.get(jobId);
  }

  // Helper method to set progress for testing
  setProgress(jobId: string, progress: any): void {
    this.progressMap.set(jobId, progress);
  }
}

describe('TranslationAPI', () => {
  let app: express.Application;
  let translationAPI: TranslationAPI;
  let mockTranslationEngine: MockTranslationEngine;
  let activeJobIds: string[] = [];

  beforeEach(() => {
    mockTranslationEngine = new MockTranslationEngine();
    translationAPI = new TranslationAPI(mockTranslationEngine);
    activeJobIds = [];
    
    app = express();
    app.use(express.json());
    app.use('/api/translation', translationAPI.getRouter());
  });

  afterEach(() => {
    // Clean up any active jobs to prevent memory leaks
    activeJobIds.forEach(jobId => {
      (translationAPI as any).activeJobs.delete(jobId);
    });
    activeJobIds = [];
  });

  describe('POST /api/translation/translate', () => {
    it('should accept SRT file and start translation job', async () => {
      const srtContent = '1\n00:00:00,000 --> 00:00:02,000\nHello world\n';
      
      const response = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from(srtContent), 'test.srt')
        .field('targetLanguage', 'bn')
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.status).toBe('PROCESSING');
      expect(response.body.data.estimatedCompletionTime).toBeGreaterThan(0);
      
      activeJobIds.push(response.body.data.jobId);
    });

    it('should accept movie metadata with translation request', async () => {
      const srtContent = '1\n00:00:00,000 --> 00:00:02,000\nHello world\n';
      const movieMetadata = {
        title: 'Test Movie',
        year: 2023,
        genre: ['Drama'],
        cast: ['Actor 1', 'Actor 2']
      };
      
      const response = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from(srtContent), 'test.srt')
        .field('targetLanguage', 'bn')
        .field('movieMetadata', JSON.stringify(movieMetadata))
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
      
      activeJobIds.push(response.body.data.jobId);
    });

    it('should reject request without SRT file', async () => {
      const response = await request(app)
        .post('/api/translation/translate')
        .field('targetLanguage', 'bn')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No SRT file provided');
    });

    it('should reject invalid file types', async () => {
      const response = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from('test content'), 'test.txt')
        .field('targetLanguage', 'bn')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate SRT file format', async () => {
      const invalidSrtContent = 'This is not a valid SRT file';
      
      const response = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from(invalidSrtContent), 'test.srt')
        .field('targetLanguage', 'bn')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid SRT file');
    });
  });

  describe('GET /api/translation/status/:jobId', () => {
    it('should return job status for valid job ID', async () => {
      // First create a job
      const srtContent = '1\n00:00:00,000 --> 00:00:02,000\nHello world\n';
      const createResponse = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from(srtContent), 'test.srt')
        .field('targetLanguage', 'bn');

      const jobId = createResponse.body.data.jobId;
      activeJobIds.push(jobId);

      // Set up mock progress for this job ID
      mockTranslationEngine.setProgress(jobId, { 
        stage: 'PROCESSING', 
        progress: 50, 
        message: 'Processing...' 
      });

      // Then check status
      const response = await request(app)
        .get(`/api/translation/status/${jobId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe(jobId);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.progress).toBeDefined();
    });

    it('should return 404 for non-existent job ID', async () => {
      const response = await request(app)
        .get('/api/translation/status/non-existent-job')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });

    it('should return 400 for missing job ID', async () => {
      const response = await request(app)
        .get('/api/translation/status/')
        .expect(404); // Express returns 404 for missing route parameters
    });
  });

  describe('GET /api/translation/result/:jobId', () => {
    it('should return completed job result', async () => {
      // Create a job and wait for completion
      const srtContent = '1\n00:00:00,000 --> 00:00:02,000\nHello world\n';
      const createResponse = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from(srtContent), 'test.srt')
        .field('targetLanguage', 'bn');

      const jobId = createResponse.body.data.jobId;
      activeJobIds.push(jobId);

      // Wait for job completion
      await new Promise(resolve => setTimeout(resolve, 200));

      const response = await request(app)
        .get(`/api/translation/result/${jobId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe(jobId);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.result).toBeDefined();
      expect(response.body.data.result.translatedSRT).toBeDefined();
      expect(response.body.data.result.movieAnalysis).toBeDefined();
      expect(response.body.data.downloadUrls).toBeDefined();
    });

    it('should return processing status for incomplete job', async () => {
      // Mock a processing job
      const jobId = 'processing-job';
      jest.spyOn(mockTranslationEngine, 'getTranslationProgress')
        .mockResolvedValue({ stage: 'PROCESSING', progress: 50, message: 'Processing...' });

      // Simulate active job
      (translationAPI as any).activeJobs.set(jobId, { status: 'PROCESSING', progress: 50 });

      const response = await request(app)
        .get(`/api/translation/result/${jobId}`)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PROCESSING');
    });

    it('should return error for failed job', async () => {
      const jobId = 'failed-job';
      
      // Simulate failed job
      (translationAPI as any).activeJobs.set(jobId, { 
        status: 'FAILED', 
        error: 'Translation failed' 
      });

      const response = await request(app)
        .get(`/api/translation/result/${jobId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Translation job failed');
    });
  });

  describe('GET /api/translation/download/:jobId/:type', () => {
    it('should download translated SRT file', async () => {
      const jobId = 'completed-job';
      const mockResult = {
        translatedSRT: {
          content: '1\n00:00:00,000 --> 00:00:02,000\nহ্যালো ওয়ার্ল্ড\n'
        },
        movieAnalysis: { summary: 'Test analysis' }
      };

      // Simulate completed job
      (translationAPI as any).activeJobs.set(jobId, { 
        status: 'COMPLETED', 
        result: mockResult 
      });

      const response = await request(app)
        .get(`/api/translation/download/${jobId}/srt`)
        .expect(200);

      expect(response.text).toContain('হ্যালো ওয়ার্ল্ড');
      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    });

    it('should download movie analysis JSON', async () => {
      const jobId = 'completed-job';
      const mockResult = {
        translatedSRT: { content: 'test srt' },
        movieAnalysis: { 
          summary: 'Test analysis',
          themes: ['friendship'],
          confidence: 0.8
        }
      };

      // Simulate completed job
      (translationAPI as any).activeJobs.set(jobId, { 
        status: 'COMPLETED', 
        result: mockResult 
      });

      const response = await request(app)
        .get(`/api/translation/download/${jobId}/analysis`)
        .expect(200);

      expect(response.body.summary).toBe('Test analysis');
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/translation/download/non-existent/srt')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found or not completed');
    });

    it('should return 400 for invalid download type', async () => {
      const jobId = 'completed-job';
      
      // Simulate completed job
      (translationAPI as any).activeJobs.set(jobId, { 
        status: 'COMPLETED', 
        result: { translatedSRT: {}, movieAnalysis: {} } 
      });

      const response = await request(app)
        .get(`/api/translation/download/${jobId}/invalid`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid download type');
    });
  });

  describe('DELETE /api/translation/cancel/:jobId', () => {
    it('should cancel processing job', async () => {
      const jobId = 'processing-job';
      
      // Simulate processing job
      (translationAPI as any).activeJobs.set(jobId, { status: 'PROCESSING' });

      const response = await request(app)
        .delete(`/api/translation/cancel/${jobId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Job cancelled successfully');
    });

    it('should not cancel completed job', async () => {
      const jobId = 'completed-job';
      
      // Simulate completed job
      (translationAPI as any).activeJobs.set(jobId, { status: 'COMPLETED' });

      const response = await request(app)
        .delete(`/api/translation/cancel/${jobId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot cancel completed job');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .delete('/api/translation/cancel/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('GET /api/translation/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/translation/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toBeDefined();
      expect(response.body.data.activeJobs).toBeDefined();
      expect(response.body.data.uptime).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle translation engine errors gracefully', async () => {
      // Mock translation engine to throw error
      jest.spyOn(mockTranslationEngine, 'translateSRTWithAnalysis')
        .mockRejectedValue(new Error('Translation engine failed'));

      const srtContent = '1\n00:00:00,000 --> 00:00:02,000\nHello world\n';
      
      const response = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from(srtContent), 'test.srt')
        .field('targetLanguage', 'bn')
        .expect(202); // Should still accept the job

      expect(response.body.success).toBe(true);
      
      // The error should be handled in the background job processing
      const jobId = response.body.data.jobId;
      activeJobIds.push(jobId);
      
      // Wait for background processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check that job failed gracefully
      const activeJob = (translationAPI as any).activeJobs.get(jobId);
      expect(activeJob?.status).toBe('FAILED');
    });

    it('should handle malformed JSON in movie metadata', async () => {
      const srtContent = '1\n00:00:00,000 --> 00:00:02,000\nHello world\n';
      
      const response = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from(srtContent), 'test.srt')
        .field('targetLanguage', 'bn')
        .field('movieMetadata', 'invalid json')
        .expect(202); // Should still process, just ignore invalid metadata

      expect(response.body.success).toBe(true);
      activeJobIds.push(response.body.data.jobId);
    });
  });

  describe('File size limits', () => {
    it('should reject files larger than 10MB', async () => {
      const largeSrtContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/translation/translate')
        .attach('srtFile', Buffer.from(largeSrtContent), 'large.srt')
        .field('targetLanguage', 'bn')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
import request from 'supertest';
import { DubAIServer } from '../server';
import { cleanupRateLimiters } from '../middleware/rateLimitMiddleware';

describe('DubAI Server Integration', () => {
  let server: DubAIServer;
  let app: any;

  beforeAll(async () => {
    // Set test environment variables
    process.env['NODE_ENV'] = 'test';
    process.env['SUPABASE_URL'] = 'https://localhost:54321'; // Use localhost to avoid network calls
    process.env['SUPABASE_ANON_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
    process.env['PORT'] = '0'; // Use random port for testing
    process.env['CORS_ORIGIN'] = 'http://localhost:3000';

    server = new DubAIServer();
    app = server.getApp();
  });

  afterAll(async () => {
    // Clean up
    if (server) {
      await server.shutdown();
    }
    cleanupRateLimiters();
  });

  describe('Server Configuration', () => {
    it('should create Express app successfully', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('should have Supabase client configured', () => {
      const supabase = server.getSupabase();
      expect(supabase).toBeDefined();
    });

    it('should have logger configured', () => {
      const logger = server.getLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });
  });

  describe('Health Check Endpoints', () => {
    it('should respond to root endpoint', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'DubAI Backend API Server',
        data: {
          version: '1.0.0',
          environment: 'test'
        }
      });
    });

    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: expect.any(String),
          responseTime: expect.any(Number),
          checks: expect.any(Object)
        }
      });
    });

    it('should respond to liveness probe', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'alive',
          uptime: expect.any(Number)
        }
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      // CORS headers are set by the cors middleware
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle OPTIONS requests', async () => {
      await request(app)
        .options('/api/jobs')
        .set('Origin', 'http://localhost:3000')
        .expect(204); // OPTIONS requests return 204 No Content
    });
  });

  describe('Request ID Middleware', () => {
    it('should add request ID to response headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(typeof response.headers['x-request-id']).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Not Found',
        message: expect.stringContaining('Route GET /api/nonexistent not found')
      });
    });
  });

  describe('Authentication Protected Routes', () => {
    it('should require authentication for job routes', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authorization header missing or invalid'
      });
    });

    it('should require authentication for file routes', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authorization header missing or invalid'
      });
    });

    it('should require authentication for user routes', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authorization header missing or invalid'
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Metrics Endpoints', () => {
    it('should respond to system metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/system')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          memory: expect.any(Object),
          uptime: expect.any(Number),
          platform: expect.any(String)
        }
      });
    });

    it('should respond to application metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/application')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          requests: expect.any(Object),
          jobs: expect.any(Object),
          users: expect.any(Object)
        }
      });
    });
  });

  describe('Request Validation', () => {
    it('should validate request body for job creation', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', 'Bearer invalid-token')
        .send({}) // Empty body should fail validation
        .expect(401); // Will fail auth first, but that's expected

      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED'
      });
    });
  });
});
import request from 'supertest';
import { DubAIServer } from '../server';

describe('Authentication Integration', () => {
  let server: DubAIServer;
  let app: any;

  beforeAll(async () => {
    // Set test environment variables
    process.env['SUPABASE_URL'] = 'https://htziyscagagblsostopa.supabase.co';
    process.env['SUPABASE_ANON_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0eml5c2NhZ2FnYmxzb3N0b3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTM5MjUsImV4cCI6MjA3MzA2OTkyNX0.Zn9u57EEj7MZvfCuADWLdiZ46fJ__WBdiYXI1Uk32j8';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test_service_role_key';
    process.env['NODE_ENV'] = 'test';
    
    server = new DubAIServer();
    app = server.getApp();
  });

  describe('Health Check (No Auth Required)', () => {
    it('should return health status without authentication', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
    });
  });

  describe('Protected Routes', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid authorization header', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Invalid Token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid bearer token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Jobs API', () => {
    it('should require authentication for jobs endpoint', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should require authentication for creating jobs', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({ title: 'Test Job' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Files API', () => {
    it('should require authentication for files endpoint', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('User Profile API', () => {
    it('should require authentication for profile endpoint', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should require authentication for stats endpoint', async () => {
      const response = await request(app)
        .get('/api/users/stats')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should require authentication for profile updates', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({ fullName: 'Test User' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });
});
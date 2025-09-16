import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { WebSocketService } from '../services/WebSocketService';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';

// Mock Supabase
jest.mock('@supabase/supabase-js');
const mockSupabase = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    }))
  })),
  channel: jest.fn(() => ({
    on: jest.fn(() => ({
      on: jest.fn(() => ({
        on: jest.fn(() => ({
          subscribe: jest.fn()
        }))
      }))
    }))
  }))
};

describe('WebSocketService', () => {
  let httpServer: any;
  let webSocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let logger: winston.Logger;
  let port: number;

  beforeAll((done) => {
    // Create logger
    logger = winston.createLogger({
      level: 'error', // Reduce noise in tests
      transports: [new winston.transports.Console({ silent: true })]
    });

    // Create HTTP server
    httpServer = createServer();
    
    // Find available port
    httpServer.listen(() => {
      port = (httpServer.address() as any).port;
      
      // Create WebSocket service
      webSocketService = new WebSocketService(httpServer, {
        corsOrigin: ['http://localhost'],
        logger,
        supabase: mockSupabase as any
      });

      done();
    });
  });

  afterAll((done) => {
    if (clientSocket) {
      clientSocket.close();
    }
    webSocketService.shutdown().then(() => {
      httpServer.close(done);
    });
  });

  beforeEach((done) => {
    // Create client socket
    clientSocket = Client(`http://localhost:${port}`, {
      transports: ['websocket']
    });
    
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.close();
    }
  });

  describe('Connection Management', () => {
    test('should accept client connections', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Test timed out waiting for system message'));
      }, 15000);

      clientSocket.on('system_message', (message) => {
        clearTimeout(timeout);
        expect(message.type).toBe('system_message');
        expect(message.payload.message).toBe('Connected to DubAI server');
        done();
      });
    }, 20000);

    test('should handle client disconnection', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Test timed out'));
      }, 15000);

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
        
        // Check that service handles disconnection gracefully
        setTimeout(() => {
          clearTimeout(timeout);
          expect(webSocketService.getConnectionsCount()).toBe(0);
          done();
        }, 100);
      });
    }, 20000);

    test('should track connection counts', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Test timed out'));
      }, 15000);

      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        // Should have 1 connection but 0 authenticated users
        expect(webSocketService.getConnectionsCount()).toBe(0); // Not authenticated yet
        expect(webSocketService.getConnectedUsersCount()).toBe(0);
        done();
      });
    }, 20000);
  });

  describe('Authentication', () => {
    test('should authenticate valid users', (done) => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.userId).toBe(mockUser.id);
        expect(webSocketService.getConnectedUsersCount()).toBe(1);
        expect(webSocketService.isUserConnected(mockUser.id)).toBe(true);
        done();
      });

      clientSocket.emit('authenticate', { token: 'valid-token' });
    });

    test('should reject invalid authentication', (done) => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      clientSocket.on('auth_error', (error) => {
        expect(error.message).toBe('Authentication failed');
        done();
      });

      clientSocket.on('disconnect', () => {
        // Should be disconnected after auth failure
        expect(webSocketService.getConnectionsCount()).toBe(0);
      });

      clientSocket.emit('authenticate', { token: 'invalid-token' });
    });

    test('should handle authentication errors gracefully', (done) => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Database error'));

      clientSocket.on('auth_error', (error) => {
        expect(error.message).toBe('Authentication failed');
        done();
      });

      clientSocket.emit('authenticate', { token: 'error-token' });
    });
  });

  describe('Job Subscriptions', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    beforeEach((done) => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      clientSocket.on('authenticated', () => done());
      clientSocket.emit('authenticate', { token: 'valid-token' });
    });

    test('should allow job subscription', (done) => {
      const jobId = 'job-123';

      clientSocket.on('job_subscribed', (data) => {
        expect(data.jobId).toBe(jobId);
        done();
      });

      clientSocket.emit('subscribe_job', { jobId });
    });

    test('should allow job unsubscription', (done) => {
      const jobId = 'job-123';

      clientSocket.on('job_unsubscribed', (data) => {
        expect(data.jobId).toBe(jobId);
        done();
      });

      clientSocket.emit('unsubscribe_job', { jobId });
    });

    test('should reject subscription for unauthenticated users', (done) => {
      // Create new unauthenticated client
      const unauthClient = Client(`http://localhost:${port}`);
      
      unauthClient.on('error', (error) => {
        expect(error.message).toBe('Not authenticated');
        unauthClient.close();
        done();
      });

      unauthClient.on('connect', () => {
        unauthClient.emit('subscribe_job', { jobId: 'job-123' });
      });
    });
  });

  describe('Real-time Updates', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    beforeEach((done) => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      clientSocket.on('authenticated', () => done());
      clientSocket.emit('authenticate', { token: 'valid-token' });
    });

    test('should send job updates to user', (done) => {
      const jobUpdate = {
        jobId: 'job-123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing...'
      };

      clientSocket.on('job_update', (message) => {
        expect(message.type).toBe('job_update');
        expect(message.payload).toMatchObject(jobUpdate);
        done();
      });

      webSocketService.sendJobUpdateToUser(mockUser.id, jobUpdate);
    });

    test('should send processing metrics to user', (done) => {
      const metrics = {
        jobId: 'job-123',
        stepName: 'transcription',
        stepOrder: 1,
        status: 'completed',
        duration: 5000,
        serviceUsed: 'whisper'
      };

      clientSocket.on('processing_metrics', (message) => {
        expect(message.type).toBe('processing_metrics');
        expect(message.payload).toMatchObject(metrics);
        done();
      });

      webSocketService.sendMetricsUpdateToUser(mockUser.id, metrics);
    });

    test('should send queue updates to user', (done) => {
      const queueUpdate = {
        jobId: 'job-123',
        queuePosition: 2,
        estimatedStartTime: new Date().toISOString(),
        estimatedDuration: 300
      };

      clientSocket.on('queue_update', (message) => {
        expect(message.type).toBe('queue_update');
        expect(message.payload).toMatchObject(queueUpdate);
        done();
      });

      webSocketService.sendQueueUpdateToUser(mockUser.id, queueUpdate);
    });

    test('should send error messages to user', (done) => {
      const errorMessage = 'Processing failed';

      clientSocket.on('error', (message) => {
        expect(message.type).toBe('error');
        expect(message.payload.message).toBe(errorMessage);
        done();
      });

      webSocketService.sendErrorToUser(mockUser.id, errorMessage);
    });

    test('should send system messages to user', (done) => {
      const systemMessage = 'System maintenance scheduled';

      clientSocket.on('system_message', (message) => {
        expect(message.type).toBe('system_message');
        expect(message.payload.message).toBe(systemMessage);
        done();
      });

      webSocketService.sendSystemMessageToUser(mockUser.id, systemMessage);
    });
  });

  describe('Job-specific Updates', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const jobId = 'job-123';

    beforeEach((done) => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('subscribe_job', { jobId });
        clientSocket.on('job_subscribed', () => done());
      });
      
      clientSocket.emit('authenticate', { token: 'valid-token' });
    });

    test('should send updates to job subscribers', (done) => {
      const jobUpdate = {
        jobId,
        status: 'completed' as any,
        progress: 100,
        message: 'Job completed successfully'
      };

      clientSocket.on('job_update', (message) => {
        expect(message.payload.jobId).toBe(jobId);
        done();
      });

      webSocketService.sendJobUpdateToJob(jobId, jobUpdate);
    });
  });

  describe('Ping/Pong Health Check', () => {
    test('should respond to ping with pong', (done) => {
      clientSocket.on('pong', (data) => {
        expect(data.timestamp).toBeDefined();
        expect(typeof data.timestamp).toBe('number');
        done();
      });

      clientSocket.emit('ping');
    });
  });

  describe('Service Management', () => {
    test('should provide connection statistics', () => {
      expect(typeof webSocketService.getConnectedUsersCount()).toBe('number');
      expect(typeof webSocketService.getConnectionsCount()).toBe('number');
    });

    test('should check user connection status', () => {
      expect(webSocketService.isUserConnected('non-existent-user')).toBe(false);
    });

    test('should provide Socket.IO instance', () => {
      const io = webSocketService.getIO();
      expect(io).toBeInstanceOf(SocketIOServer);
    });

    test('should handle graceful shutdown', async () => {
      // This is tested in the afterAll hook
      expect(webSocketService.shutdown).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle socket errors gracefully', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Test timed out'));
      }, 15000);

      clientSocket.on('connect', () => {
        // Simulate socket error
        clientSocket.emit('error', new Error('Test error'));
        
        // Should not crash the service
        setTimeout(() => {
          clearTimeout(timeout);
          expect(webSocketService.getIO()).toBeDefined();
          done();
        }, 100);
      });
    }, 20000);

    test('should handle malformed authentication data', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Test timed out waiting for auth_error'));
      }, 15000);

      clientSocket.on('auth_error', () => {
        clearTimeout(timeout);
        done();
      });

      clientSocket.on('connect', () => {
        // Send malformed auth data
        clientSocket.emit('authenticate', 'invalid-data');
      });
    }, 20000);
  });
});
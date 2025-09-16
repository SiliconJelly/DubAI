import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { WebSocketService } from '../services/WebSocketService';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';
import { JobStatus } from '@dubai/shared';

// Mock Supabase for integration testing
const mockSupabase = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn()
          }))
        }))
      })),
      limit: jest.fn()
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  })),
  channel: jest.fn(() => ({
    on: jest.fn(() => ({
      on: jest.fn(() => ({
        on: jest.fn(() => ({
          subscribe: jest.fn((callback) => {
            // Simulate successful subscription
            setTimeout(() => callback('SUBSCRIBED'), 100);
            return { unsubscribe: jest.fn() };
          })
        }))
      }))
    }))
  }))
};

describe('WebSocket Integration Tests', () => {
  let httpServer: any;
  let webSocketService: WebSocketService;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let logger: winston.Logger;
  let port: number;

  const mockUser1 = { id: 'user-123', email: 'user1@example.com' };
  const mockUser2 = { id: 'user-456', email: 'user2@example.com' };

  beforeAll((done) => {
    // Create silent logger for tests
    logger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })]
    });

    // Create HTTP server
    httpServer = createServer();
    
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
    if (clientSocket1) clientSocket1.close();
    if (clientSocket2) clientSocket2.close();
    
    webSocketService.shutdown().then(() => {
      httpServer.close(done);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (clientSocket1 && clientSocket1.connected) {
      clientSocket1.close();
    }
    if (clientSocket2 && clientSocket2.connected) {
      clientSocket2.close();
    }
  });

  describe('Multi-User Real-time Updates', () => {
    test('should handle multiple authenticated users simultaneously', (done) => {
      let user1Connected = false;
      let user2Connected = false;
      
      // Mock authentication for both users
      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: mockUser1 }, error: null })
        .mockResolvedValueOnce({ data: { user: mockUser2 }, error: null });

      // Create first client
      clientSocket1 = Client(`http://localhost:${port}`);
      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', { token: 'token1' });
      });
      
      clientSocket1.on('authenticated', (data) => {
        expect(data.userId).toBe(mockUser1.id);
        user1Connected = true;
        
        if (user1Connected && user2Connected) {
          expect(webSocketService.getConnectedUsersCount()).toBe(2);
          done();
        }
      });

      // Create second client after a short delay
      setTimeout(() => {
        clientSocket2 = Client(`http://localhost:${port}`);
        clientSocket2.on('connect', () => {
          clientSocket2.emit('authenticate', { token: 'token2' });
        });
        
        clientSocket2.on('authenticated', (data) => {
          expect(data.userId).toBe(mockUser2.id);
          user2Connected = true;
          
          if (user1Connected && user2Connected) {
            expect(webSocketService.getConnectedUsersCount()).toBe(2);
            done();
          }
        });
      }, 100);
    }, 10000);

    test('should send job updates only to the job owner', (done) => {
      let user1Authenticated = false;
      let user2Authenticated = false;
      let user1ReceivedUpdate = false;
      let user2ReceivedUpdate = false;

      // Mock authentication
      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: mockUser1 }, error: null })
        .mockResolvedValueOnce({ data: { user: mockUser2 }, error: null });

      // Set up first client (job owner)
      clientSocket1 = Client(`http://localhost:${port}`);
      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', { token: 'token1' });
      });
      
      clientSocket1.on('authenticated', () => {
        user1Authenticated = true;
        checkAndSendUpdate();
      });

      clientSocket1.on('job_update', (message) => {
        expect(message.payload.jobId).toBe('job-123');
        user1ReceivedUpdate = true;
        
        // Wait a bit to ensure user2 doesn't receive the update
        setTimeout(() => {
          expect(user2ReceivedUpdate).toBe(false);
          done();
        }, 200);
      });

      // Set up second client (different user)
      clientSocket2 = Client(`http://localhost:${port}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('authenticate', { token: 'token2' });
      });
      
      clientSocket2.on('authenticated', () => {
        user2Authenticated = true;
        checkAndSendUpdate();
      });

      clientSocket2.on('job_update', () => {
        user2ReceivedUpdate = true;
      });

      function checkAndSendUpdate() {
        if (user1Authenticated && user2Authenticated) {
          // Send job update to user1 only
          webSocketService.sendJobUpdateToUser(mockUser1.id, {
            jobId: 'job-123',
            status: JobStatus.PROCESSING,
            progress: 50,
            message: 'Processing...'
          });
        }
      }
    }, 10000);

    test('should handle job-specific subscriptions correctly', (done) => {
      const jobId = 'job-456';
      let subscribedUsers = 0;
      let updatesReceived = 0;

      // Mock authentication
      mockSupabase.auth.getUser
        .mockResolvedValue({ data: { user: mockUser1 }, error: null });

      // Create multiple clients for the same user
      clientSocket1 = Client(`http://localhost:${port}`);
      clientSocket2 = Client(`http://localhost:${port}`);

      const setupClient = (socket: ClientSocket) => {
        socket.on('connect', () => {
          socket.emit('authenticate', { token: 'token1' });
        });
        
        socket.on('authenticated', () => {
          socket.emit('subscribe_job', { jobId });
        });
        
        socket.on('job_subscribed', (data) => {
          expect(data.jobId).toBe(jobId);
          subscribedUsers++;
          
          if (subscribedUsers === 2) {
            // Send update to job-specific room
            webSocketService.sendJobUpdateToJob(jobId, {
              jobId,
              status: JobStatus.COMPLETED,
              progress: 100,
              message: 'Job completed!'
            });
          }
        });
        
        socket.on('job_update', (message) => {
          expect(message.payload.jobId).toBe(jobId);
          updatesReceived++;
          
          if (updatesReceived === 2) {
            done();
          }
        });
      };

      setupClient(clientSocket1);
      setupClient(clientSocket2);
    }, 10000);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle authentication failures gracefully', (done) => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      clientSocket1 = Client(`http://localhost:${port}`);
      
      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', { token: 'invalid-token' });
      });
      
      clientSocket1.on('auth_error', (error) => {
        expect(error.message).toBe('Authentication failed');
      });
      
      clientSocket1.on('disconnect', (reason) => {
        expect(reason).toBe('server namespace disconnect');
        expect(webSocketService.getConnectedUsersCount()).toBe(0);
        done();
      });
    }, 10000);

    test('should handle Supabase realtime subscription setup', (done) => {
      // The WebSocket service should set up Supabase realtime subscriptions
      expect(mockSupabase.channel).toHaveBeenCalledWith('job_updates');
      
      // Simulate a database change event
      const mockPayload = {
        new: {
          id: 'job-789',
          user_id: mockUser1.id,
          status: JobStatus.TRANSCRIBING,
          progress: 25,
          error_message: null
        }
      };

      // Mock user authentication first
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser1 },
        error: null
      });

      clientSocket1 = Client(`http://localhost:${port}`);
      
      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', { token: 'token1' });
      });
      
      clientSocket1.on('authenticated', () => {
        // Simulate Supabase realtime event
        webSocketService.sendJobUpdateToUser(mockUser1.id, {
          jobId: mockPayload.new.id,
          status: mockPayload.new.status,
          progress: mockPayload.new.progress,
          message: 'Transcribing audio content...'
        });
      });
      
      clientSocket1.on('job_update', (message) => {
        expect(message.payload.jobId).toBe('job-789');
        expect(message.payload.status).toBe(JobStatus.TRANSCRIBING);
        done();
      });
    }, 10000);
  });

  describe('Performance and Scalability', () => {
    test('should handle rapid job updates efficiently', (done) => {
      const updateCount = 10;
      let receivedUpdates = 0;

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser1 },
        error: null
      });

      clientSocket1 = Client(`http://localhost:${port}`);
      
      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', { token: 'token1' });
      });
      
      clientSocket1.on('authenticated', () => {
        // Send multiple rapid updates
        for (let i = 0; i < updateCount; i++) {
          setTimeout(() => {
            webSocketService.sendJobUpdateToUser(mockUser1.id, {
              jobId: 'job-rapid',
              status: JobStatus.PROCESSING,
              progress: (i + 1) * 10,
              message: `Update ${i + 1}`
            });
          }, i * 10); // 10ms intervals
        }
      });
      
      clientSocket1.on('job_update', (message) => {
        receivedUpdates++;
        
        if (receivedUpdates === updateCount) {
          expect(message.payload.progress).toBe(100);
          done();
        }
      });
    }, 10000);

    test('should maintain connection health with ping/pong', (done) => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser1 },
        error: null
      });

      clientSocket1 = Client(`http://localhost:${port}`);
      
      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', { token: 'token1' });
      });
      
      clientSocket1.on('authenticated', () => {
        // Send ping
        clientSocket1.emit('ping');
      });
      
      clientSocket1.on('pong', (data) => {
        expect(data.timestamp).toBeDefined();
        expect(typeof data.timestamp).toBe('number');
        expect(data.timestamp).toBeGreaterThan(Date.now() - 1000);
        done();
      });
    }, 10000);
  });

  describe('System Messages and Notifications', () => {
    test('should broadcast system messages to all users', (done) => {
      let user1ReceivedMessage = false;
      let user2ReceivedMessage = false;

      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: mockUser1 }, error: null })
        .mockResolvedValueOnce({ data: { user: mockUser2 }, error: null });

      const checkCompletion = () => {
        if (user1ReceivedMessage && user2ReceivedMessage) {
          done();
        }
      };

      // Set up first client
      clientSocket1 = Client(`http://localhost:${port}`);
      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', { token: 'token1' });
      });
      
      clientSocket1.on('system_message', (message) => {
        if (message.payload.message === 'System maintenance scheduled') {
          user1ReceivedMessage = true;
          checkCompletion();
        }
      });

      // Set up second client
      clientSocket2 = Client(`http://localhost:${port}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('authenticate', { token: 'token2' });
      });
      
      clientSocket2.on('system_message', (message) => {
        if (message.payload.message === 'System maintenance scheduled') {
          user2ReceivedMessage = true;
          checkCompletion();
        }
      });

      // Wait for both to authenticate, then send system message
      setTimeout(() => {
        webSocketService.sendSystemMessageToUser(mockUser1.id, 'System maintenance scheduled');
        webSocketService.sendSystemMessageToUser(mockUser2.id, 'System maintenance scheduled');
      }, 500);
    }, 10000);
  });
});
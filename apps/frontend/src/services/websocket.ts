import { io, Socket } from 'socket.io-client';
import { JobUpdate, WebSocketMessage } from '@dubai/shared';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export interface ProcessingMetricsUpdate {
  jobId: string;
  stepName: string;
  stepOrder: number;
  status: string;
  duration?: number;
  serviceUsed?: string;
  costEstimate?: number;
}

export interface QueueUpdate {
  jobId: string;
  queuePosition: number;
  estimatedStartTime?: string;
  estimatedDuration?: number;
}

export interface ConnectionStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  userId?: string;
  lastPing?: number;
  reconnectAttempts: number;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private isAuthenticated = false;
  private userId?: string;
  private authToken?: string;
  private pingInterval?: NodeJS.Timeout;
  private connectionListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private subscribedJobs: Set<string> = new Set();

  async connect(authToken?: string): Promise<void> {
    if (authToken) {
      this.authToken = authToken;
    }

    return new Promise((resolve, reject) => {
      try {
        // Disconnect existing connection
        if (this.socket) {
          this.socket.disconnect();
        }

        this.socket = io(WS_URL, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
          timeout: 20000,
          forceNew: true
        });

        this.setupEventHandlers();

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.startPingInterval();
          
          // Authenticate if token is available
          if (this.authToken) {
            this.authenticate(this.authToken);
          }
          
          this.notifyConnectionListeners();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.notifyConnectionListeners();
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isAuthenticated = false;
      this.stopPingInterval();
      this.notifyConnectionListeners();
      
      // Auto-reconnect for certain disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        return;
      }
      
      this.handleReconnect();
    });

    this.socket.on('authenticated', (data: { userId: string; timestamp: string }) => {
      console.log('WebSocket authenticated for user:', data.userId);
      this.isAuthenticated = true;
      this.userId = data.userId;
      this.notifyConnectionListeners();
      
      // Re-subscribe to previously subscribed jobs
      this.subscribedJobs.forEach(jobId => {
        this.subscribeToJob(jobId);
      });
    });

    this.socket.on('auth_error', (error: { message: string }) => {
      console.error('WebSocket authentication error:', error);
      this.isAuthenticated = false;
      this.userId = undefined;
      this.notifyConnectionListeners();
    });

    this.socket.on('pong', (data: { timestamp: number }) => {
      // Update last ping time for connection health monitoring
      this.notifyConnectionListeners();
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  authenticate(token: string): void {
    this.authToken = token;
    if (this.socket?.connected) {
      this.socket.emit('authenticate', { token });
    }
  }

  disconnect(): void {
    this.stopPingInterval();
    this.subscribedJobs.clear();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isAuthenticated = false;
    this.userId = undefined;
    this.notifyConnectionListeners();
  }

  subscribeToJob(jobId: string): void {
    this.subscribedJobs.add(jobId);
    if (this.socket?.connected && this.isAuthenticated) {
      this.socket.emit('subscribe_job', { jobId });
    }
  }

  unsubscribeFromJob(jobId: string): void {
    this.subscribedJobs.delete(jobId);
    if (this.socket?.connected && this.isAuthenticated) {
      this.socket.emit('unsubscribe_job', { jobId });
    }
  }

  // Event listeners
  onJobUpdate(callback: (update: JobUpdate) => void): () => void {
    if (this.socket) {
      const handler = (message: WebSocketMessage) => {
        if (message.type === 'job_update') {
          callback(message.payload as JobUpdate);
        }
      };
      this.socket.on('job_update', handler);
      
      // Return cleanup function
      return () => {
        if (this.socket) {
          this.socket.off('job_update', handler);
        }
      };
    }
    return () => {};
  }

  onProcessingMetrics(callback: (metrics: ProcessingMetricsUpdate) => void): () => void {
    if (this.socket) {
      const handler = (data: { payload: ProcessingMetricsUpdate }) => {
        callback(data.payload);
      };
      this.socket.on('processing_metrics', handler);
      
      return () => {
        if (this.socket) {
          this.socket.off('processing_metrics', handler);
        }
      };
    }
    return () => {};
  }

  onQueueUpdate(callback: (update: QueueUpdate) => void): () => void {
    if (this.socket) {
      const handler = (data: { payload: QueueUpdate }) => {
        callback(data.payload);
      };
      this.socket.on('queue_update', handler);
      
      return () => {
        if (this.socket) {
          this.socket.off('queue_update', handler);
        }
      };
    }
    return () => {};
  }

  onError(callback: (error: { message: string }) => void): () => void {
    if (this.socket) {
      const handler = (message: WebSocketMessage) => {
        if (message.type === 'error') {
          callback(message.payload as { message: string });
        }
      };
      this.socket.on('error', handler);
      
      return () => {
        if (this.socket) {
          this.socket.off('error', handler);
        }
      };
    }
    return () => {};
  }

  onSystemMessage(callback: (message: { message: string }) => void): () => void {
    if (this.socket) {
      const handler = (message: WebSocketMessage) => {
        if (message.type === 'system_message') {
          callback(message.payload as { message: string });
        }
      };
      this.socket.on('system_message', handler);
      
      return () => {
        if (this.socket) {
          this.socket.off('system_message', handler);
        }
      };
    }
    return () => {};
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void {
    this.connectionListeners.add(callback);
    
    // Immediately call with current status
    callback(this.getConnectionStatus());
    
    // Return cleanup function
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay
      );
      
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
      
      setTimeout(() => {
        this.connect(this.authToken).catch(console.error);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.notifyConnectionListeners();
    }
  }

  private notifyConnectionListeners(): void {
    const status = this.getConnectionStatus();
    this.connectionListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  getConnectionStatus(): ConnectionStatus {
    return {
      isConnected: this.socket?.connected || false,
      isAuthenticated: this.isAuthenticated,
      userId: this.userId,
      lastPing: Date.now(),
      reconnectAttempts: this.reconnectAttempts
    };
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getAuthenticatedUserId(): string | undefined {
    return this.isAuthenticated ? this.userId : undefined;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      this.socket.emit('ping');
      this.socket.once('pong', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
import { Server as SocketIOServer, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import winston from 'winston';
import { JobUpdate, WebSocketMessage } from '@dubai/shared';

export interface WebSocketServiceConfig {
  corsOrigin: string[];
  logger: winston.Logger;
  supabase: SupabaseClient;
}

export class WebSocketService {
  private io: SocketIOServer;
  private logger: winston.Logger;
  private supabase: SupabaseClient;
  private authenticatedUsers: Map<string, string> = new Map(); // socketId -> userId
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(server: any, config: WebSocketServiceConfig) {
    this.logger = config.logger;
    this.supabase = config.supabase;
    
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    this.setupSupabaseRealtimeSubscriptions();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.logger.info(`WebSocket client connected: ${socket.id}`);
      
      // Send welcome message
      this.sendSystemMessage(socket, 'Connected to DubAI server');

      // Handle authentication
      socket.on('authenticate', async (data: { token: string }) => {
        await this.handleAuthentication(socket, data.token);
      });

      // Handle job subscription
      socket.on('subscribe_job', (data: { jobId: string }) => {
        this.handleJobSubscription(socket, data.jobId);
      });

      // Handle job unsubscription
      socket.on('unsubscribe_job', (data: { jobId: string }) => {
        this.handleJobUnsubscription(socket, data.jobId);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });

      // Handle errors
      socket.on('error', (error) => {
        this.logger.error(`WebSocket error for client ${socket.id}:`, error);
        this.sendErrorMessage(socket, 'WebSocket error occurred');
      });
    });
  }

  private async handleAuthentication(socket: Socket, token: string): Promise<void> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      
      if (error || !user) {
        this.logger.warn(`Authentication failed for socket ${socket.id}: ${error?.message}`);
        socket.emit('auth_error', { message: 'Authentication failed' });
        socket.disconnect();
        return;
      }

      // Store user authentication
      this.authenticatedUsers.set(socket.id, user.id);
      
      // Add socket to user's socket set
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);

      // Join user-specific room
      socket.join(`user:${user.id}`);
      
      // Send authentication success
      socket.emit('authenticated', { 
        userId: user.id,
        timestamp: new Date().toISOString()
      });
      
      this.logger.info(`User ${user.id} authenticated via WebSocket (socket: ${socket.id})`);
      
      // Send any pending notifications for this user
      await this.sendPendingNotifications(user.id);
      
    } catch (error) {
      this.logger.error('WebSocket authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  }

  private handleJobSubscription(socket: Socket, jobId: string): void {
    const userId = this.authenticatedUsers.get(socket.id);
    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Join job-specific room
    socket.join(`job:${jobId}`);
    socket.emit('job_subscribed', { jobId, timestamp: new Date().toISOString() });
    
    this.logger.debug(`User ${userId} subscribed to job ${jobId} updates`);
  }

  private handleJobUnsubscription(socket: Socket, jobId: string): void {
    socket.leave(`job:${jobId}`);
    socket.emit('job_unsubscribed', { jobId, timestamp: new Date().toISOString() });
  }

  private handleDisconnection(socket: Socket, reason: string): void {
    const userId = this.authenticatedUsers.get(socket.id);
    
    if (userId) {
      // Remove socket from user's socket set
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      
      this.authenticatedUsers.delete(socket.id);
      this.logger.info(`User ${userId} disconnected (socket: ${socket.id}), reason: ${reason}`);
    } else {
      this.logger.info(`Unauthenticated client disconnected: ${socket.id}, reason: ${reason}`);
    }
  }

  private setupSupabaseRealtimeSubscriptions(): void {
    // Subscribe to job status changes
    this.supabase
      .channel('job_updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'dubbing_jobs',
          filter: 'status=neq.uploaded' // Only listen to processing jobs
        }, 
        (payload) => {
          this.handleJobStatusChange(payload);
        }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'processing_metrics'
        },
        (payload) => {
          this.handleProcessingMetricsUpdate(payload);
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_queue'
        },
        (payload) => {
          this.handleQueueUpdate(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.logger.info('Supabase realtime subscriptions established');
        } else if (status === 'CHANNEL_ERROR') {
          this.logger.error('Supabase realtime subscription error');
        }
      });
  }

  private handleJobStatusChange(payload: any): void {
    const jobData = payload.new;
    const userId = jobData.user_id;
    
    const jobUpdate: JobUpdate = {
      jobId: jobData.id,
      status: jobData.status,
      progress: jobData.progress || 0,
      message: this.getStatusMessage(jobData.status),
      error: jobData.error_message || undefined
    };

    // Send to user-specific room
    this.sendJobUpdateToUser(userId, jobUpdate);
    
    // Send to job-specific room
    this.sendJobUpdateToJob(jobData.id, jobUpdate);
    
    this.logger.debug(`Job ${jobData.id} status updated to ${jobData.status} for user ${userId}`);
  }

  private handleProcessingMetricsUpdate(payload: any): void {
    const metricsData = payload.new;
    
    // Get job details to find user
    this.supabase
      .from('dubbing_jobs')
      .select('user_id')
      .eq('id', metricsData.job_id)
      .single()
      .then(({ data: jobData, error }) => {
        if (error || !jobData) {
          this.logger.error('Failed to get job data for metrics update:', error);
          return;
        }

        const metricsUpdate = {
          jobId: metricsData.job_id,
          stepName: metricsData.step_name,
          stepOrder: metricsData.step_order,
          status: metricsData.status,
          duration: metricsData.duration_ms,
          serviceUsed: metricsData.service_used,
          costEstimate: metricsData.cost_estimate
        };

        // Send metrics update to user
        this.sendMetricsUpdateToUser(jobData.user_id, metricsUpdate);
        
        // Send to job-specific room
        this.sendMetricsUpdateToJob(metricsData.job_id, metricsUpdate);
      });
  }

  private handleQueueUpdate(payload: any): void {
    const queueData = payload.new;
    
    // Get job details to find user
    this.supabase
      .from('dubbing_jobs')
      .select('user_id')
      .eq('id', queueData.job_id)
      .single()
      .then(({ data: jobData, error }) => {
        if (error || !jobData) {
          this.logger.error('Failed to get job data for queue update:', error);
          return;
        }

        const queueUpdate = {
          jobId: queueData.job_id,
          queuePosition: queueData.queue_position,
          estimatedStartTime: queueData.estimated_start_time,
          estimatedDuration: queueData.estimated_duration_minutes
        };

        // Send queue update to user
        this.sendQueueUpdateToUser(jobData.user_id, queueUpdate);
      });
  }

  private getStatusMessage(status: string): string {
    const statusMessages: Record<string, string> = {
      'extracting_audio': 'Extracting audio from video...',
      'transcribing': 'Transcribing audio content...',
      'translating': 'Translating to target language...',
      'generating_speech': 'Generating speech audio...',
      'assembling_audio': 'Assembling final audio track...',
      'completed': 'Processing completed successfully!',
      'failed': 'Processing failed. Please try again.'
    };
    
    return statusMessages[status] || `Status: ${status}`;
  }

  // Public methods for sending updates
  public sendJobUpdateToUser(userId: string, update: JobUpdate): void {
    const message: WebSocketMessage = {
      type: 'job_update',
      payload: update,
      timestamp: new Date().toISOString()
    };
    
    this.io.to(`user:${userId}`).emit('job_update', message);
  }

  public sendJobUpdateToJob(jobId: string, update: JobUpdate): void {
    const message: WebSocketMessage = {
      type: 'job_update',
      payload: update,
      timestamp: new Date().toISOString()
    };
    
    this.io.to(`job:${jobId}`).emit('job_update', message);
  }

  public sendMetricsUpdateToUser(userId: string, metrics: any): void {
    this.io.to(`user:${userId}`).emit('processing_metrics', {
      type: 'processing_metrics',
      payload: metrics,
      timestamp: new Date().toISOString()
    });
  }

  public sendMetricsUpdateToJob(jobId: string, metrics: any): void {
    this.io.to(`job:${jobId}`).emit('processing_metrics', {
      type: 'processing_metrics',
      payload: metrics,
      timestamp: new Date().toISOString()
    });
  }

  public sendQueueUpdateToUser(userId: string, queueUpdate: any): void {
    this.io.to(`user:${userId}`).emit('queue_update', {
      type: 'queue_update',
      payload: queueUpdate,
      timestamp: new Date().toISOString()
    });
  }

  public sendErrorToUser(userId: string, error: string): void {
    const message: WebSocketMessage = {
      type: 'error',
      payload: { message: error },
      timestamp: new Date().toISOString()
    };
    
    this.io.to(`user:${userId}`).emit('error', message);
  }

  public sendSystemMessageToUser(userId: string, message: string): void {
    const wsMessage: WebSocketMessage = {
      type: 'system_message',
      payload: { message },
      timestamp: new Date().toISOString()
    };
    
    this.io.to(`user:${userId}`).emit('system_message', wsMessage);
  }

  private sendSystemMessage(socket: Socket, message: string): void {
    const wsMessage: WebSocketMessage = {
      type: 'system_message',
      payload: { message },
      timestamp: new Date().toISOString()
    };
    
    socket.emit('system_message', wsMessage);
  }

  private sendErrorMessage(socket: Socket, message: string): void {
    const wsMessage: WebSocketMessage = {
      type: 'error',
      payload: { message },
      timestamp: new Date().toISOString()
    };
    
    socket.emit('error', wsMessage);
  }

  private async sendPendingNotifications(userId: string): Promise<void> {
    try {
      // Get any active jobs for this user
      const { data: activeJobs, error } = await this.supabase
        .from('dubbing_jobs')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['extracting_audio', 'transcribing', 'translating', 'generating_speech', 'assembling_audio'])
        .order('updated_at', { ascending: false });

      if (error) {
        this.logger.error('Failed to fetch active jobs for user:', error);
        return;
      }

      // Send current status for each active job
      activeJobs?.forEach(job => {
        const jobUpdate: JobUpdate = {
          jobId: job.id,
          status: job.status,
          progress: job.progress || 0,
          message: this.getStatusMessage(job.status)
        };
        
        this.sendJobUpdateToUser(userId, jobUpdate);
      });

    } catch (error) {
      this.logger.error('Error sending pending notifications:', error);
    }
  }

  public getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  public getConnectionsCount(): number {
    return this.authenticatedUsers.size;
  }

  public isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down WebSocket service...');
    
    // Notify all connected clients
    this.io.emit('system_message', {
      type: 'system_message',
      payload: { message: 'Server is shutting down. Please reconnect in a moment.' },
      timestamp: new Date().toISOString()
    });

    // Close all connections
    this.io.close();
    
    // Clear internal state
    this.authenticatedUsers.clear();
    this.userSockets.clear();
    
    this.logger.info('WebSocket service shutdown complete');
  }
}
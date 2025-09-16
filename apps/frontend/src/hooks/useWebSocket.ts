import { useEffect, useCallback, useState, useRef } from 'react';
import { JobUpdate } from '@dubai/shared';
import webSocketService, { 
  ProcessingMetricsUpdate, 
  QueueUpdate, 
  ConnectionStatus 
} from '../services/websocket';
import { useAuth } from './useAuth';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  subscribeToJobs?: string[];
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { autoConnect = true, subscribeToJobs = [] } = options;
  const { user, getAccessToken } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isAuthenticated: false,
    reconnectAttempts: 0
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // Connection management
  useEffect(() => {
    if (!autoConnect) return;

    const connect = async () => {
      try {
        setConnectionError(null);
        
        // Get auth token if user is logged in
        let token: string | undefined;
        if (user) {
          token = await getAccessToken();
        }
        
        await webSocketService.connect(token);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        setConnectionError(errorMessage);
        console.error('WebSocket connection failed:', error);
      }
    };

    connect();

    // Set up connection status listener
    const unsubscribeStatus = webSocketService.onConnectionChange(setConnectionStatus);
    cleanupFunctionsRef.current.push(unsubscribeStatus);

    return () => {
      // Clean up all listeners
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
      
      webSocketService.disconnect();
    };
  }, [autoConnect, user, getAccessToken]);

  // Job subscription management
  useEffect(() => {
    if (connectionStatus.isAuthenticated && subscribeToJobs.length > 0) {
      subscribeToJobs.forEach(jobId => {
        webSocketService.subscribeToJob(jobId);
      });

      return () => {
        subscribeToJobs.forEach(jobId => {
          webSocketService.unsubscribeFromJob(jobId);
        });
      };
    }
  }, [connectionStatus.isAuthenticated, subscribeToJobs]);

  // Event listener hooks
  const onJobUpdate = useCallback((callback: (update: JobUpdate) => void) => {
    const cleanup = webSocketService.onJobUpdate(callback);
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onProcessingMetrics = useCallback((callback: (metrics: ProcessingMetricsUpdate) => void) => {
    const cleanup = webSocketService.onProcessingMetrics(callback);
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onQueueUpdate = useCallback((callback: (update: QueueUpdate) => void) => {
    const cleanup = webSocketService.onQueueUpdate(callback);
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onError = useCallback((callback: (error: { message: string }) => void) => {
    const cleanup = webSocketService.onError(callback);
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onSystemMessage = useCallback((callback: (message: { message: string }) => void) => {
    const cleanup = webSocketService.onSystemMessage(callback);
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  // Connection control methods
  const connect = useCallback(async () => {
    try {
      setConnectionError(null);
      let token: string | undefined;
      if (user) {
        token = await getAccessToken();
      }
      await webSocketService.connect(token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(errorMessage);
      throw error;
    }
  }, [user, getAccessToken]);

  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);

  const subscribeToJob = useCallback((jobId: string) => {
    webSocketService.subscribeToJob(jobId);
  }, []);

  const unsubscribeFromJob = useCallback((jobId: string) => {
    webSocketService.unsubscribeFromJob(jobId);
  }, []);

  const healthCheck = useCallback(async () => {
    return webSocketService.healthCheck();
  }, []);

  return {
    // Connection status
    isConnected: connectionStatus.isConnected,
    isAuthenticated: connectionStatus.isAuthenticated,
    userId: connectionStatus.userId,
    reconnectAttempts: connectionStatus.reconnectAttempts,
    connectionError,
    connectionStatus,

    // Event listeners
    onJobUpdate,
    onProcessingMetrics,
    onQueueUpdate,
    onError,
    onSystemMessage,

    // Connection control
    connect,
    disconnect,
    subscribeToJob,
    unsubscribeFromJob,
    healthCheck,
  };
};

// Specialized hook for job-specific updates
export const useJobWebSocket = (jobId: string | null) => {
  const webSocket = useWebSocket({
    autoConnect: true,
    subscribeToJobs: jobId ? [jobId] : []
  });

  const [jobStatus, setJobStatus] = useState<JobUpdate | null>(null);
  const [processingMetrics, setProcessingMetrics] = useState<ProcessingMetricsUpdate[]>([]);
  const [queueInfo, setQueueInfo] = useState<QueueUpdate | null>(null);

  useEffect(() => {
    if (!jobId) return;

    // Listen for job updates
    const cleanupJobUpdate = webSocket.onJobUpdate((update) => {
      if (update.jobId === jobId) {
        setJobStatus(update);
      }
    });

    // Listen for processing metrics
    const cleanupMetrics = webSocket.onProcessingMetrics((metrics) => {
      if (metrics.jobId === jobId) {
        setProcessingMetrics(prev => {
          const existing = prev.find(m => m.stepName === metrics.stepName);
          if (existing) {
            return prev.map(m => m.stepName === metrics.stepName ? metrics : m);
          }
          return [...prev, metrics].sort((a, b) => a.stepOrder - b.stepOrder);
        });
      }
    });

    // Listen for queue updates
    const cleanupQueue = webSocket.onQueueUpdate((update) => {
      if (update.jobId === jobId) {
        setQueueInfo(update);
      }
    });

    return () => {
      cleanupJobUpdate();
      cleanupMetrics();
      cleanupQueue();
    };
  }, [jobId, webSocket]);

  return {
    ...webSocket,
    jobStatus,
    processingMetrics,
    queueInfo,
    clearJobData: () => {
      setJobStatus(null);
      setProcessingMetrics([]);
      setQueueInfo(null);
    }
  };
};
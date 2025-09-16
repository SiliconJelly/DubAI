import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useWebSocket, useJobWebSocket } from '../useWebSocket';
import webSocketService from '../../services/websocket';
import { useAuth } from '../useAuth';

// Mock the WebSocket service
vi.mock('../../services/websocket');
vi.mock('../useAuth');

const mockWebSocketService = webSocketService as any;
const mockUseAuth = useAuth as any;

describe('useWebSocket', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockGetAccessToken = vi.fn().mockResolvedValue('mock-token');

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      loading: false,
      initialized: true,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      refreshSession: vi.fn()
    });

    mockWebSocketService.connect = vi.fn().mockResolvedValue(undefined);
    mockWebSocketService.disconnect = vi.fn();
    mockWebSocketService.onConnectionChange = vi.fn().mockImplementation((callback) => {
      callback({
        isConnected: true,
        isAuthenticated: true,
        userId: mockUser.id,
        reconnectAttempts: 0
      });
      return vi.fn(); // cleanup function
    });
    mockWebSocketService.onJobUpdate = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.onProcessingMetrics = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.onQueueUpdate = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.onError = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.onSystemMessage = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.subscribeToJob = vi.fn();
    mockWebSocketService.unsubscribeFromJob = vi.fn();
    mockWebSocketService.healthCheck = vi.fn();
  });

  describe('Connection Management', () => {
    test('should auto-connect by default', async () => {
      renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(mockWebSocketService.connect).toHaveBeenCalledWith('mock-token');
      });
    });

    test('should not auto-connect when disabled', () => {
      renderHook(() => useWebSocket({ autoConnect: false }));

      expect(mockWebSocketService.connect).not.toHaveBeenCalled();
    });

    test('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockWebSocketService.disconnect).toHaveBeenCalled();
    });

    test('should handle connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mockWebSocketService.connect.mockRejectedValue(connectionError);

      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.connectionError).toBe('Connection failed');
      });
    });
  });

  describe('Connection Status', () => {
    test('should provide connection status', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.userId).toBe(mockUser.id);
        expect(result.current.reconnectAttempts).toBe(0);
      });
    });

    test('should update connection status when it changes', async () => {
      let connectionCallback: (status: any) => void;
      mockWebSocketService.onConnectionChange.mockImplementation((callback) => {
        connectionCallback = callback;
        return vi.fn();
      });

      const { result } = renderHook(() => useWebSocket());

      // Simulate connection status change
      act(() => {
        connectionCallback({
          isConnected: false,
          isAuthenticated: false,
          reconnectAttempts: 1
        });
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.reconnectAttempts).toBe(1);
    });
  });

  describe('Event Listeners', () => {
    test('should set up job update listener', () => {
      const { result } = renderHook(() => useWebSocket());

      const mockCallback = vi.fn();
      act(() => {
        result.current.onJobUpdate(mockCallback);
      });

      expect(mockWebSocketService.onJobUpdate).toHaveBeenCalledWith(mockCallback);
    });

    test('should set up processing metrics listener', () => {
      const { result } = renderHook(() => useWebSocket());

      const mockCallback = vi.fn();
      act(() => {
        result.current.onProcessingMetrics(mockCallback);
      });

      expect(mockWebSocketService.onProcessingMetrics).toHaveBeenCalledWith(mockCallback);
    });

    test('should set up queue update listener', () => {
      const { result } = renderHook(() => useWebSocket());

      const mockCallback = vi.fn();
      act(() => {
        result.current.onQueueUpdate(mockCallback);
      });

      expect(mockWebSocketService.onQueueUpdate).toHaveBeenCalledWith(mockCallback);
    });

    test('should set up error listener', () => {
      const { result } = renderHook(() => useWebSocket());

      const mockCallback = vi.fn();
      act(() => {
        result.current.onError(mockCallback);
      });

      expect(mockWebSocketService.onError).toHaveBeenCalledWith(mockCallback);
    });

    test('should set up system message listener', () => {
      const { result } = renderHook(() => useWebSocket());

      const mockCallback = vi.fn();
      act(() => {
        result.current.onSystemMessage(mockCallback);
      });

      expect(mockWebSocketService.onSystemMessage).toHaveBeenCalledWith(mockCallback);
    });
  });

  describe('Job Subscriptions', () => {
    test('should subscribe to jobs when authenticated', async () => {
      const jobIds = ['job-1', 'job-2'];
      renderHook(() => useWebSocket({ subscribeToJobs: jobIds }));

      await waitFor(() => {
        expect(mockWebSocketService.subscribeToJob).toHaveBeenCalledWith('job-1');
        expect(mockWebSocketService.subscribeToJob).toHaveBeenCalledWith('job-2');
      });
    });

    test('should unsubscribe from jobs on unmount', async () => {
      const jobIds = ['job-1', 'job-2'];
      const { unmount } = renderHook(() => useWebSocket({ subscribeToJobs: jobIds }));

      await waitFor(() => {
        expect(mockWebSocketService.subscribeToJob).toHaveBeenCalled();
      });

      unmount();

      expect(mockWebSocketService.unsubscribeFromJob).toHaveBeenCalledWith('job-1');
      expect(mockWebSocketService.unsubscribeFromJob).toHaveBeenCalledWith('job-2');
    });
  });

  describe('Manual Connection Control', () => {
    test('should allow manual connection', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }));

      await act(async () => {
        await result.current.connect();
      });

      expect(mockWebSocketService.connect).toHaveBeenCalledWith('mock-token');
    });

    test('should allow manual disconnection', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.disconnect();
      });

      expect(mockWebSocketService.disconnect).toHaveBeenCalled();
    });

    test('should allow job subscription', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.subscribeToJob('job-123');
      });

      expect(mockWebSocketService.subscribeToJob).toHaveBeenCalledWith('job-123');
    });

    test('should allow job unsubscription', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.unsubscribeFromJob('job-123');
      });

      expect(mockWebSocketService.unsubscribeFromJob).toHaveBeenCalledWith('job-123');
    });
  });

  describe('Health Check', () => {
    test('should perform health check', async () => {
      mockWebSocketService.healthCheck.mockResolvedValue(true);
      const { result } = renderHook(() => useWebSocket());

      let healthResult: boolean;
      await act(async () => {
        healthResult = await result.current.healthCheck();
      });

      expect(healthResult!).toBe(true);
      expect(mockWebSocketService.healthCheck).toHaveBeenCalled();
    });
  });
});

describe('useJobWebSocket', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockGetAccessToken = vi.fn().mockResolvedValue('mock-token');
  const jobId = 'job-123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      loading: false,
      initialized: true,
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      refreshSession: vi.fn()
    });

    mockWebSocketService.connect = vi.fn().mockResolvedValue(undefined);
    mockWebSocketService.onConnectionChange = vi.fn().mockImplementation((callback) => {
      callback({
        isConnected: true,
        isAuthenticated: true,
        userId: mockUser.id,
        reconnectAttempts: 0
      });
      return vi.fn();
    });
    mockWebSocketService.onJobUpdate = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.onProcessingMetrics = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.onQueueUpdate = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.onError = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.onSystemMessage = vi.fn().mockReturnValue(vi.fn());
    mockWebSocketService.subscribeToJob = vi.fn();
    mockWebSocketService.unsubscribeFromJob = vi.fn();
  });

  test('should subscribe to specific job', async () => {
    renderHook(() => useJobWebSocket(jobId));

    await waitFor(() => {
      expect(mockWebSocketService.subscribeToJob).toHaveBeenCalledWith(jobId);
    });
  });

  test('should not subscribe when jobId is null', () => {
    renderHook(() => useJobWebSocket(null));

    expect(mockWebSocketService.subscribeToJob).not.toHaveBeenCalled();
  });

  test('should handle job updates', async () => {
    let jobUpdateCallback: (update: any) => void;
    mockWebSocketService.onJobUpdate.mockImplementation((callback) => {
      jobUpdateCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useJobWebSocket(jobId));

    const jobUpdate = {
      jobId,
      status: 'processing' as any,
      progress: 50,
      message: 'Processing...'
    };

    act(() => {
      jobUpdateCallback(jobUpdate);
    });

    expect(result.current.jobStatus).toEqual(jobUpdate);
  });

  test('should handle processing metrics', async () => {
    let metricsCallback: (metrics: any) => void;
    mockWebSocketService.onProcessingMetrics.mockImplementation((callback) => {
      metricsCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useJobWebSocket(jobId));

    const metrics = {
      jobId,
      stepName: 'transcription',
      stepOrder: 1,
      status: 'completed',
      duration: 5000
    };

    act(() => {
      metricsCallback(metrics);
    });

    expect(result.current.processingMetrics).toContainEqual(metrics);
  });

  test('should handle queue updates', async () => {
    let queueCallback: (update: any) => void;
    mockWebSocketService.onQueueUpdate.mockImplementation((callback) => {
      queueCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useJobWebSocket(jobId));

    const queueUpdate = {
      jobId,
      queuePosition: 2,
      estimatedStartTime: new Date().toISOString(),
      estimatedDuration: 300
    };

    act(() => {
      queueCallback(queueUpdate);
    });

    expect(result.current.queueInfo).toEqual(queueUpdate);
  });

  test('should clear job data', () => {
    const { result } = renderHook(() => useJobWebSocket(jobId));

    act(() => {
      result.current.clearJobData();
    });

    expect(result.current.jobStatus).toBeNull();
    expect(result.current.processingMetrics).toEqual([]);
    expect(result.current.queueInfo).toBeNull();
  });

  test('should ignore updates for different jobs', async () => {
    let jobUpdateCallback: (update: any) => void;
    mockWebSocketService.onJobUpdate.mockImplementation((callback) => {
      jobUpdateCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useJobWebSocket(jobId));

    const otherJobUpdate = {
      jobId: 'other-job',
      status: 'processing' as any,
      progress: 50,
      message: 'Processing...'
    };

    act(() => {
      jobUpdateCallback(otherJobUpdate);
    });

    expect(result.current.jobStatus).toBeNull();
  });
});
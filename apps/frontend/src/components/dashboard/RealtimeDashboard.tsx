import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Bell, 
  BellOff,
  Activity,
  Users,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { JobStatusCard } from './JobStatusCard';
import { DubbingJob } from '@dubai/shared';
import { useToast } from '../../hooks/use-toast';

interface RealtimeDashboardProps {
  jobs: DubbingJob[];
  onJobUpdate?: (job: DubbingJob) => void;
  onDownload?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
}

export const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({
  jobs,
  onJobUpdate,
  onDownload,
  onCancel,
  onRetry
}) => {
  const {
    isConnected,
    isAuthenticated,
    userId,
    reconnectAttempts,
    connectionError,
    connectionStatus,
    connect,
    disconnect,
    onJobUpdate: onJobUpdateWS,
    onError,
    onSystemMessage,
    healthCheck
  } = useWebSocket({ autoConnect: true });

  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [systemMessages, setSystemMessages] = useState<Array<{
    id: string;
    message: string;
    timestamp: Date;
    type: 'info' | 'error' | 'warning';
  }>>([]);

  // Handle real-time job updates
  useEffect(() => {
    const cleanup = onJobUpdateWS((update) => {
      if (notifications) {
        // Show toast notification for job status changes
        const job = jobs.find(j => j.id === update.jobId);
        if (job) {
          toast({
            title: `Job "${job.title}" Updated`,
            description: update.message || `Status: ${update.status}`,
            duration: 3000,
          });
        }
      }

      // Call parent callback if provided
      if (onJobUpdate) {
        const updatedJob = jobs.find(j => j.id === update.jobId);
        if (updatedJob) {
          onJobUpdate({
            ...updatedJob,
            status: update.status,
            progress: update.progress,
            errorMessage: update.error
          });
        }
      }
    });

    return cleanup;
  }, [onJobUpdateWS, notifications, jobs, onJobUpdate, toast]);

  // Handle error messages
  useEffect(() => {
    const cleanup = onError((error) => {
      setSystemMessages(prev => [{
        id: Date.now().toString(),
        message: error.message,
        timestamp: new Date(),
        type: 'error'
      }, ...prev.slice(0, 9)]); // Keep last 10 messages

      if (notifications) {
        toast({
          title: 'System Error',
          description: error.message,
          variant: 'destructive',
          duration: 5000,
        });
      }
    });

    return cleanup;
  }, [onError, notifications, toast]);

  // Handle system messages
  useEffect(() => {
    const cleanup = onSystemMessage((message) => {
      setSystemMessages(prev => [{
        id: Date.now().toString(),
        message: message.message,
        timestamp: new Date(),
        type: 'info'
      }, ...prev.slice(0, 9)]);

      if (notifications) {
        toast({
          title: 'System Message',
          description: message.message,
          duration: 3000,
        });
      }
    });

    return cleanup;
  }, [onSystemMessage, notifications, toast]);

  const handleReconnect = async () => {
    try {
      await connect();
      toast({
        title: 'Reconnected',
        description: 'Successfully reconnected to real-time updates',
      });
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: 'Failed to reconnect. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleHealthCheck = async () => {
    const isHealthy = await healthCheck();
    toast({
      title: 'Health Check',
      description: isHealthy ? 'Connection is healthy' : 'Connection issues detected',
      variant: isHealthy ? 'default' : 'destructive',
    });
  };

  const getConnectionStatusColor = () => {
    if (!isConnected) return 'bg-red-500';
    if (!isAuthenticated) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getConnectionStatusText = () => {
    if (!isConnected) return 'Disconnected';
    if (!isAuthenticated) return 'Connecting...';
    return 'Connected';
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Dashboard
            </CardTitle>
            
            <div className="flex items-center gap-3">
              {/* Notification toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNotifications(!notifications)}
                className="p-2"
              >
                {notifications ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
              </Button>

              {/* Health check */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleHealthCheck}
                className="p-2"
              >
                <Activity className="h-4 w-4" />
              </Button>

              {/* Connection status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} />
                <span className="text-sm font-medium">
                  {getConnectionStatusText()}
                </span>
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
              </div>

              {/* Reconnect button */}
              {!isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReconnect}
                  disabled={reconnectAttempts > 0}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${reconnectAttempts > 0 ? 'animate-spin' : ''}`} />
                  {reconnectAttempts > 0 ? 'Reconnecting...' : 'Reconnect'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Connection info */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Connection</p>
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {getConnectionStatusText()}
              </Badge>
            </div>

            {/* User info */}
            <div className="space-y-1">
              <p className="text-sm font-medium">User</p>
              <div className="flex items-center gap-1 text-sm">
                <Users className="h-3 w-3" />
                {userId ? `ID: ${userId.slice(0, 8)}...` : 'Not authenticated'}
              </div>
            </div>

            {/* Reconnect attempts */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Reconnect Attempts</p>
              <div className="flex items-center gap-1 text-sm">
                <RefreshCw className="h-3 w-3" />
                {reconnectAttempts}/10
              </div>
            </div>

            {/* Last ping */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Last Update</p>
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3" />
                {connectionStatus.lastPing ? 
                  new Date(connectionStatus.lastPing).toLocaleTimeString() : 
                  'Never'
                }
              </div>
            </div>
          </div>

          {/* Connection error */}
          {connectionError && (
            <Alert className="mt-4" variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Connection Error: {connectionError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* System Messages */}
      {systemMessages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">System Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {systemMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded text-sm ${
                    msg.type === 'error' ? 'bg-red-50 text-red-800' :
                    msg.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                    'bg-blue-50 text-blue-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span>{msg.message}</span>
                    <span className="text-xs opacity-70">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <JobStatusCard
            key={job.id}
            job={job}
            onDownload={onDownload}
            onCancel={onCancel}
            onRetry={onRetry}
          />
        ))}
      </div>

      {/* Empty state */}
      {jobs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-600">No jobs found</p>
              <p className="text-sm text-gray-500">
                Upload a video to start your first dubbing job
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
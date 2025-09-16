import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Play, 
  Pause, 
  Square, 
  Wifi, 
  WifiOff,
  Activity,
  Bell,
  RefreshCw
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';
import { useToast } from '../hooks/use-toast';
import { JobStatus } from '@dubai/shared';

// Mock job data for demonstration
const mockJobs = [
  {
    id: 'job-1',
    title: 'Movie Trailer Dubbing',
    status: JobStatus.TRANSCRIBING,
    progress: 35
  },
  {
    id: 'job-2',
    title: 'Documentary Episode 1',
    status: JobStatus.GENERATING_SPEECH,
    progress: 75
  },
  {
    id: 'job-3',
    title: 'Short Film Project',
    status: JobStatus.COMPLETED,
    progress: 100
  }
];

export const RealtimeDemo: React.FC = () => {
  const {
    isConnected,
    isAuthenticated,
    connectionStatus,
    connectionError,
    connect,
    disconnect,
    onJobUpdate,
    onProcessingMetrics,
    onQueueUpdate,
    onError,
    onSystemMessage,
    subscribeToJob,
    unsubscribeFromJob,
    healthCheck
  } = useWebSocket({ autoConnect: true });

  const { toast } = useToast();
  const [jobUpdates, setJobUpdates] = useState<any[]>([]);
  const [processingMetrics, setProcessingMetrics] = useState<any[]>([]);
  const [queueUpdates, setQueueUpdates] = useState<any[]>([]);
  const [systemMessages, setSystemMessages] = useState<any[]>([]);
  const [subscribedJobs, setSubscribedJobs] = useState<Set<string>>(new Set());

  // Set up event listeners
  useEffect(() => {
    const cleanupJobUpdate = onJobUpdate((update) => {
      setJobUpdates(prev => [update, ...prev.slice(0, 9)]);
      toast({
        title: 'Job Update',
        description: `Job ${update.jobId}: ${update.status}`,
        duration: 3000,
      });
    });

    const cleanupMetrics = onProcessingMetrics((metrics) => {
      setProcessingMetrics(prev => [metrics, ...prev.slice(0, 9)]);
    });

    const cleanupQueue = onQueueUpdate((update) => {
      setQueueUpdates(prev => [update, ...prev.slice(0, 9)]);
    });

    const cleanupError = onError((error) => {
      setSystemMessages(prev => [{
        type: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      }, ...prev.slice(0, 9)]);
    });

    const cleanupSystemMessage = onSystemMessage((message) => {
      setSystemMessages(prev => [{
        type: 'info',
        message: message.message,
        timestamp: new Date().toISOString()
      }, ...prev.slice(0, 9)]);
    });

    return () => {
      cleanupJobUpdate();
      cleanupMetrics();
      cleanupQueue();
      cleanupError();
      cleanupSystemMessage();
    };
  }, [onJobUpdate, onProcessingMetrics, onQueueUpdate, onError, onSystemMessage, toast]);

  const handleJobSubscription = (jobId: string) => {
    if (subscribedJobs.has(jobId)) {
      unsubscribeFromJob(jobId);
      setSubscribedJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
      toast({
        title: 'Unsubscribed',
        description: `Unsubscribed from job ${jobId}`,
      });
    } else {
      subscribeToJob(jobId);
      setSubscribedJobs(prev => new Set(prev).add(jobId));
      toast({
        title: 'Subscribed',
        description: `Subscribed to job ${jobId}`,
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

  const simulateJobUpdate = () => {
    // This would normally come from the server
    const randomJob = mockJobs[Math.floor(Math.random() * mockJobs.length)];
    const update = {
      jobId: randomJob.id,
      status: JobStatus.TRANSCRIBING,
      progress: Math.floor(Math.random() * 100),
      message: 'Simulated update'
    };
    
    setJobUpdates(prev => [update, ...prev.slice(0, 9)]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Real-time WebSocket Demo</h1>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-600" />
          )}
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectionStatus 
            status={connectionStatus}
            onReconnect={connect}
            showDetails={true}
          />
          
          {connectionError && (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>
                Connection Error: {connectionError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={connect}
              disabled={isConnected}
              variant="outline"
            >
              <Play className="h-4 w-4 mr-2" />
              Connect
            </Button>
            
            <Button
              onClick={disconnect}
              disabled={!isConnected}
              variant="outline"
            >
              <Pause className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
            
            <Button
              onClick={handleHealthCheck}
              variant="outline"
            >
              <Activity className="h-4 w-4 mr-2" />
              Health Check
            </Button>
            
            <Button
              onClick={simulateJobUpdate}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Simulate Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Job Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockJobs.map((job) => (
              <div key={job.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{job.title}</h4>
                  <Badge variant="outline">{job.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Progress: {job.progress}%</span>
                  <Button
                    size="sm"
                    variant={subscribedJobs.has(job.id) ? 'default' : 'outline'}
                    onClick={() => handleJobSubscription(job.id)}
                    disabled={!isAuthenticated}
                  >
                    <Bell className="h-3 w-3 mr-1" />
                    {subscribedJobs.has(job.id) ? 'Unsubscribe' : 'Subscribe'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Updates */}
        <Card>
          <CardHeader>
            <CardTitle>Job Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {jobUpdates.length === 0 ? (
                <p className="text-gray-500 text-sm">No job updates yet</p>
              ) : (
                jobUpdates.map((update, index) => (
                  <div key={index} className="p-2 bg-blue-50 rounded text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Job: {update.jobId}</p>
                        <p>Status: {update.status}</p>
                        <p>Progress: {update.progress}%</p>
                        {update.message && <p>Message: {update.message}</p>}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Processing Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {processingMetrics.length === 0 ? (
                <p className="text-gray-500 text-sm">No processing metrics yet</p>
              ) : (
                processingMetrics.map((metric, index) => (
                  <div key={index} className="p-2 bg-green-50 rounded text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Job: {metric.jobId}</p>
                        <p>Step: {metric.stepName}</p>
                        <p>Status: {metric.status}</p>
                        {metric.duration && <p>Duration: {metric.duration}ms</p>}
                        {metric.serviceUsed && <p>Service: {metric.serviceUsed}</p>}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Queue Updates */}
        <Card>
          <CardHeader>
            <CardTitle>Queue Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {queueUpdates.length === 0 ? (
                <p className="text-gray-500 text-sm">No queue updates yet</p>
              ) : (
                queueUpdates.map((update, index) => (
                  <div key={index} className="p-2 bg-yellow-50 rounded text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Job: {update.jobId}</p>
                        <p>Position: {update.queuePosition}</p>
                        {update.estimatedStartTime && (
                          <p>Est. Start: {new Date(update.estimatedStartTime).toLocaleTimeString()}</p>
                        )}
                        {update.estimatedDuration && (
                          <p>Est. Duration: {update.estimatedDuration}min</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Messages */}
        <Card>
          <CardHeader>
            <CardTitle>System Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {systemMessages.length === 0 ? (
                <p className="text-gray-500 text-sm">No system messages yet</p>
              ) : (
                systemMessages.map((message, index) => (
                  <div key={index} className={`p-2 rounded text-sm ${
                    message.type === 'error' ? 'bg-red-50' : 'bg-gray-50'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`font-medium ${
                          message.type === 'error' ? 'text-red-800' : 'text-gray-800'
                        }`}>
                          {message.message}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
import React from 'react';
import { Badge } from './badge';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { ConnectionStatus as ConnectionStatusType } from '../../services/websocket';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  onReconnect?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  onReconnect,
  showDetails = false,
  className = ''
}) => {
  const getStatusInfo = () => {
    if (!status.isConnected) {
      return {
        icon: WifiOff,
        color: 'destructive' as const,
        label: 'Disconnected',
        description: 'No connection to server'
      };
    }
    
    if (!status.isAuthenticated) {
      return {
        icon: Clock,
        color: 'secondary' as const,
        label: 'Connecting',
        description: 'Authenticating with server'
      };
    }
    
    return {
      icon: Wifi,
      color: 'default' as const,
      label: 'Connected',
      description: 'Real-time updates active'
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 ${className}`}>
              <StatusIcon className={`h-4 w-4 ${
                status.isConnected ? 'text-green-600' : 'text-red-600'
              }`} />
              <Badge variant={statusInfo.color} className="text-xs">
                {statusInfo.label}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{statusInfo.description}</p>
              {status.userId && (
                <p className="text-xs">User: {status.userId.slice(0, 8)}...</p>
              )}
              {status.reconnectAttempts > 0 && (
                <p className="text-xs">Reconnect attempts: {status.reconnectAttempts}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${
            status.isConnected ? 'text-green-600' : 'text-red-600'
          }`} />
          <span className="font-medium">{statusInfo.label}</span>
          <Badge variant={statusInfo.color}>
            {statusInfo.description}
          </Badge>
        </div>

        {!status.isConnected && onReconnect && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReconnect}
            disabled={status.reconnectAttempts > 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${
              status.reconnectAttempts > 0 ? 'animate-spin' : ''
            }`} />
            {status.reconnectAttempts > 0 ? 'Reconnecting...' : 'Reconnect'}
          </Button>
        )}
      </div>

      {/* Detailed status */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-gray-600">Connection</p>
          <div className="flex items-center gap-2">
            {status.isConnected ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <span>{status.isConnected ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-gray-600">Authentication</p>
          <div className="flex items-center gap-2">
            {status.isAuthenticated ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Clock className="h-4 w-4 text-yellow-600" />
            )}
            <span>{status.isAuthenticated ? 'Authenticated' : 'Pending'}</span>
          </div>
        </div>

        {status.userId && (
          <div className="space-y-1">
            <p className="font-medium text-gray-600">User ID</p>
            <p className="font-mono text-xs">{status.userId.slice(0, 16)}...</p>
          </div>
        )}

        {status.reconnectAttempts > 0 && (
          <div className="space-y-1">
            <p className="font-medium text-gray-600">Reconnect Attempts</p>
            <p>{status.reconnectAttempts}/10</p>
          </div>
        )}

        {status.lastPing && (
          <div className="space-y-1">
            <p className="font-medium text-gray-600">Last Update</p>
            <p>{new Date(status.lastPing).toLocaleTimeString()}</p>
          </div>
        )}
      </div>

      {/* Connection quality indicator */}
      <div className="space-y-2">
        <p className="font-medium text-gray-600 text-sm">Connection Quality</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                status.isConnected && status.isAuthenticated ? 'bg-green-500' :
                status.isConnected ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ 
                width: status.isConnected && status.isAuthenticated ? '100%' :
                       status.isConnected ? '60%' : '20%'
              }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {status.isConnected && status.isAuthenticated ? 'Excellent' :
             status.isConnected ? 'Good' : 'Poor'}
          </span>
        </div>
      </div>
    </div>
  );
};
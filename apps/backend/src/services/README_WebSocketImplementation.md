# WebSocket Real-time Updates Implementation

This document describes the comprehensive WebSocket implementation for real-time job processing updates in the DubAI application.

## Overview

The WebSocket system provides real-time communication between the backend processing engine and frontend dashboard, enabling users to see live updates of their dubbing job progress, processing metrics, and system notifications.

## Architecture

### Backend Components

#### WebSocketService
- **Location**: `src/services/WebSocketService.ts`
- **Purpose**: Core WebSocket server implementation using Socket.IO
- **Features**:
  - User authentication via Supabase JWT tokens
  - Room-based messaging (user-specific and job-specific)
  - Supabase Realtime integration for database change notifications
  - Connection health monitoring with ping/pong
  - Graceful error handling and recovery

#### Key Features

1. **Authentication Integration**
   ```typescript
   // Authenticate users with Supabase JWT tokens
   socket.on('authenticate', async (data: { token: string }) => {
     const { data: { user }, error } = await this.supabase.auth.getUser(token);
     // Handle authentication and room assignment
   });
   ```

2. **Room Management**
   - `user:{userId}` - User-specific updates
   - `job:{jobId}` - Job-specific updates for subscribers

3. **Supabase Realtime Integration**
   ```typescript
   this.supabase
     .channel('job_updates')
     .on('postgres_changes', { 
       event: 'UPDATE', 
       schema: 'public', 
       table: 'dubbing_jobs' 
     }, (payload) => {
       this.handleJobStatusChange(payload);
     })
     .subscribe();
   ```

### Frontend Components

#### WebSocket Service Client
- **Location**: `src/services/websocket.ts`
- **Purpose**: Client-side WebSocket connection management
- **Features**:
  - Automatic reconnection with exponential backoff
  - Connection health monitoring
  - Event-based message handling
  - Authentication token management

#### React Hooks

1. **useWebSocket Hook**
   - **Location**: `src/hooks/useWebSocket.ts`
   - **Purpose**: General WebSocket connection management
   - **Features**:
     - Auto-connection with authentication
     - Connection status tracking
     - Event listener management
     - Job subscription handling

2. **useJobWebSocket Hook**
   - **Purpose**: Job-specific WebSocket updates
   - **Features**:
     - Automatic job subscription
     - Real-time job status updates
     - Processing metrics tracking
     - Queue position monitoring

#### UI Components

1. **RealtimeDashboard**
   - **Location**: `src/components/dashboard/RealtimeDashboard.tsx`
   - **Purpose**: Main dashboard with real-time updates
   - **Features**:
     - Connection status display
     - System message notifications
     - Job grid with live updates
     - Notification management

2. **JobStatusCard**
   - **Location**: `src/components/dashboard/JobStatusCard.tsx`
   - **Purpose**: Individual job status with real-time updates
   - **Features**:
     - Live progress tracking
     - Processing step visualization
     - Cost and metrics display
     - Action buttons (download, cancel, retry)

3. **ConnectionStatus**
   - **Location**: `src/components/ui/ConnectionStatus.tsx`
   - **Purpose**: WebSocket connection status indicator
   - **Features**:
     - Visual connection quality indicator
     - Detailed connection information
     - Reconnection controls

## Message Types

### Job Updates
```typescript
interface JobUpdate {
  jobId: string;
  status: JobStatus;
  progress: number;
  message?: string;
  error?: string;
}
```

### Processing Metrics
```typescript
interface ProcessingMetricsUpdate {
  jobId: string;
  stepName: string;
  stepOrder: number;
  status: string;
  duration?: number;
  serviceUsed?: string;
  costEstimate?: number;
}
```

### Queue Updates
```typescript
interface QueueUpdate {
  jobId: string;
  queuePosition: number;
  estimatedStartTime?: string;
  estimatedDuration?: number;
}
```

### System Messages
```typescript
interface SystemMessage {
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: string;
}
```

## Event Flow

### Job Processing Flow
1. User uploads video → Job created in database
2. Database trigger → Supabase Realtime event
3. WebSocket service receives event → Broadcasts to user
4. Frontend receives update → UI updates automatically
5. Processing engine updates job status → Repeat cycle

### Connection Flow
1. Frontend connects to WebSocket server
2. Server sends welcome message
3. Frontend sends authentication token
4. Server validates with Supabase
5. User joins user-specific room
6. Server sends pending notifications
7. Frontend subscribes to relevant jobs

## Error Handling

### Connection Errors
- Automatic reconnection with exponential backoff
- Maximum retry attempts (10)
- Connection quality monitoring
- Graceful degradation when offline

### Authentication Errors
- Invalid token handling
- Session expiration recovery
- Automatic re-authentication

### Processing Errors
- Error message broadcasting
- Failed job notifications
- Retry mechanisms

## Performance Optimizations

### Connection Management
- Connection pooling
- Ping/pong health checks (30-second intervals)
- Idle connection cleanup
- Memory leak prevention

### Message Optimization
- Room-based targeting (no broadcast storms)
- Message deduplication
- Efficient JSON serialization
- Rate limiting protection

### Scalability Features
- Horizontal scaling support
- Load balancer compatibility
- Session persistence
- Multi-instance coordination

## Security Features

### Authentication
- JWT token validation
- Supabase integration
- User session management
- Automatic token refresh

### Authorization
- User-specific room access
- Job ownership validation
- Admin privilege checking
- Rate limiting per user

### Data Protection
- Secure WebSocket connections (WSS)
- Message encryption in transit
- No sensitive data in messages
- Audit logging

## Configuration

### Environment Variables
```bash
# WebSocket Configuration
WS_PORT=3001
WS_CORS_ORIGIN=http://localhost:8080,https://yourdomain.com

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Connection Settings
WS_PING_TIMEOUT=60000
WS_PING_INTERVAL=25000
WS_MAX_RECONNECT_ATTEMPTS=10
```

### Frontend Configuration
```typescript
// WebSocket URL configuration
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

// Connection settings
const CONNECTION_CONFIG = {
  transports: ['websocket', 'polling'],
  timeout: 20000,
  forceNew: true
};
```

## Testing

### Backend Tests
- **Location**: `src/test/WebSocketService.test.ts`
- **Coverage**: Connection management, authentication, message handling
- **Integration Tests**: `src/test/WebSocketIntegration.test.ts`

### Frontend Tests
- **Location**: `src/hooks/__tests__/useWebSocket.test.ts`
- **Coverage**: Hook functionality, connection management, event handling

### Test Scenarios
- Multi-user connections
- Job-specific subscriptions
- Error handling and recovery
- Performance under load
- Authentication flows

## Monitoring and Debugging

### Logging
- Connection events
- Authentication attempts
- Message routing
- Error conditions
- Performance metrics

### Metrics
- Active connections count
- Message throughput
- Error rates
- Response times
- Memory usage

### Debug Tools
- Connection status indicators
- Message logging
- Performance profiling
- Error tracking
- Health check endpoints

## Deployment Considerations

### Production Setup
- Use WSS (secure WebSocket) connections
- Configure proper CORS origins
- Set up load balancing
- Enable connection monitoring
- Configure auto-scaling

### Supabase Integration
- Set up Realtime subscriptions
- Configure Row Level Security (RLS)
- Monitor database connections
- Set up proper indexes
- Configure connection pooling

### Performance Tuning
- Optimize message frequency
- Implement message batching
- Use connection pooling
- Monitor memory usage
- Set up caching strategies

## Future Enhancements

### Planned Features
- Message persistence for offline users
- Advanced notification preferences
- Real-time collaboration features
- Enhanced error recovery
- Performance analytics dashboard

### Scalability Improvements
- Redis adapter for multi-instance scaling
- Message queue integration
- Advanced load balancing
- Geographic distribution
- Edge computing support

## Troubleshooting

### Common Issues
1. **Connection Failures**: Check CORS configuration and network connectivity
2. **Authentication Errors**: Verify Supabase configuration and token validity
3. **Message Delivery**: Check room subscriptions and user authentication
4. **Performance Issues**: Monitor connection counts and message frequency

### Debug Commands
```bash
# Check WebSocket server status
curl http://localhost:3000/api/health

# Monitor connection logs
tail -f logs/websocket.log

# Test WebSocket connection
wscat -c ws://localhost:3000
```

This implementation provides a robust, scalable, and secure real-time communication system that enhances the user experience by providing immediate feedback on job processing status and system events.
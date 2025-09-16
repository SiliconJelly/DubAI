# DubAI Backend API Foundation

A comprehensive Express.js backend API server with TypeScript, Supabase integration, and real-time WebSocket support for the DubAI automated video dubbing platform.

## 🚀 Features

### Core Server
- **Express.js** with TypeScript configuration
- **WebSocket** support via Socket.IO for real-time updates
- **Supabase** integration for database operations and authentication
- **Winston** structured logging with multiple transports
- **Comprehensive error handling** with custom error types

### Middleware Stack
- **CORS** middleware with configurable origins
- **Authentication** middleware with Supabase JWT verification
- **Request validation** using Zod schemas
- **Rate limiting** with in-memory store
- **Request/response logging** with performance metrics
- **Error handling** with proper HTTP status codes

### API Routes
- **Health checks** (`/api/health`) - System health monitoring
- **Metrics** (`/api/metrics`) - System and application metrics
- **Jobs** (`/api/jobs`) - Dubbing job management (CRUD operations)
- **Files** (`/api/files`) - File upload and management

### Security Features
- JWT-based authentication via Supabase
- Rate limiting per user/IP
- CORS protection
- Request validation and sanitization
- Structured error responses (no sensitive data leakage)

## 📁 Project Structure

```
apps/backend/src/
├── server.ts                 # Main server class
├── middleware/              # Custom middleware
│   ├── authMiddleware.ts    # JWT authentication
│   ├── errorHandler.ts      # Error handling
│   ├── loggingMiddleware.ts # Request/response logging
│   ├── rateLimitMiddleware.ts # Rate limiting
│   └── validationMiddleware.ts # Request validation
├── routes/                  # API route handlers
│   ├── healthRoutes.ts      # Health check endpoints
│   ├── metricsRoutes.ts     # Metrics endpoints
│   ├── jobRoutes.ts         # Job management
│   └── fileRoutes.ts        # File operations
├── types/                   # TypeScript type definitions
│   ├── api.ts               # API types and Express extensions
│   ├── common.ts            # Common types
│   └── errors.ts            # Custom error classes
└── logs/                    # Log files directory
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase project with database setup

### Environment Variables
Create a `.env` file in the backend directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:8080

# Logging
LOG_LEVEL=info
```

### Installation
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start development server
npm run dev

# Start production server
npm start
```

## 🔧 API Endpoints

### Health & Monitoring
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system health
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

### Metrics
- `GET /api/metrics/system` - System metrics (memory, CPU, etc.)
- `GET /api/metrics/application` - Application-specific metrics
- `GET /api/metrics/database` - Database connection metrics
- `GET /api/metrics/performance` - Performance metrics
- `GET /api/metrics/costs` - Cost tracking metrics (authenticated)

### Jobs (Authenticated)
- `GET /api/jobs` - List user's jobs with pagination
- `GET /api/jobs/:id` - Get specific job details
- `POST /api/jobs` - Create new dubbing job
- `POST /api/jobs/:id/start` - Start job processing
- `POST /api/jobs/:id/cancel` - Cancel job
- `DELETE /api/jobs/:id` - Delete job

### Files (Authenticated)
- `GET /api/files` - List user's files
- `GET /api/files/:id` - Get file metadata
- `GET /api/files/:id/download` - Get download URL
- `POST /api/files/upload` - Upload files (video/SRT)
- `DELETE /api/files/:id` - Delete file

## 🔐 Authentication

The API uses Supabase JWT tokens for authentication:

```javascript
// Include JWT token in requests
headers: {
  'Authorization': 'Bearer your_jwt_token'
}
```

## 📡 WebSocket Events

Real-time updates via Socket.IO:

### Client Events
- `authenticate` - Authenticate WebSocket connection
- `disconnect` - Handle disconnection

### Server Events
- `system_message` - System notifications
- `job_update` - Job status updates
- `auth_error` - Authentication errors
- `authenticated` - Successful authentication

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Test server initialization
npx ts-node src/test-server.ts

# Test API endpoints
npx ts-node src/test-api.ts

# Test middleware stack
npx ts-node src/test-middleware.ts

# Complete integration test
npx ts-node src/test-complete.ts
```

## 📊 Monitoring & Logging

### Logging
- **Winston** structured logging
- Multiple transports (file, console)
- Request/response logging with correlation IDs
- Performance metrics tracking

### Health Checks
- Database connectivity
- Memory usage monitoring
- System resource checks
- Service dependency validation

### Metrics
- Request/response metrics
- Processing time tracking
- Error rate monitoring
- Cost tracking per user

## 🔧 Configuration

The server supports extensive configuration via environment variables:

- **PORT** - Server port (default: 3000)
- **NODE_ENV** - Environment (development/production)
- **CORS_ORIGIN** - Allowed CORS origins (comma-separated)
- **LOG_LEVEL** - Logging level (error/warn/info/debug)
- **SUPABASE_URL** - Supabase project URL
- **SUPABASE_ANON_KEY** - Supabase anonymous key
- **SUPABASE_SERVICE_ROLE_KEY** - Supabase service role key

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Docker Support
The server is containerization-ready with proper health checks and graceful shutdown handling.

### Environment Setup
- Set `NODE_ENV=production`
- Configure proper CORS origins
- Set up log rotation
- Configure monitoring endpoints

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Rate Limiting** - Prevent abuse and DoS attacks
- **CORS Protection** - Configurable cross-origin policies
- **Input Validation** - Zod-based request validation
- **Error Sanitization** - No sensitive data in error responses
- **Request Logging** - Comprehensive audit trail

## 📈 Performance

- **Async/Await** - Non-blocking operations
- **Connection Pooling** - Efficient database connections
- **Memory Management** - Proper cleanup and monitoring
- **Graceful Shutdown** - Clean server termination
- **Request Correlation** - Distributed tracing support

## 🤝 Contributing

1. Follow TypeScript strict mode guidelines
2. Add proper error handling for all operations
3. Include comprehensive logging
4. Write tests for new features
5. Update API documentation

## 📝 License

MIT License - see LICENSE file for details.
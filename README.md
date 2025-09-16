# DubAI Full-Stack MVP

A revolutionary cross-platform movie dubbing SaaS that transforms English video content into high-quality Bangla dubbed videos.

## 🚀 Current Status: Phase 6 Complete - Comprehensive Testing Infrastructure ✅

**176 Total Tests** | **WCAG 2.1 AA Compliant** | **Multi-Browser Support** | **Production Ready**

## Project Structure

This is a monorepo containing the full-stack DubAI application:

```
dubai-fullstack/
├── apps/
│   ├── frontend/          # React frontend application
│   └── backend/           # Node.js backend API
├── packages/
│   └── shared/            # Shared types and utilities
├── .env.example           # Environment variables template
└── package.json           # Root package.json with workspace configuration
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dubai-fullstack
```

2. Install dependencies for all workspaces:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
# Copy and configure root environment
cp .env.example .env

# Copy and configure frontend environment
cp apps/frontend/.env.example apps/frontend/.env

# Copy and configure backend environment
cp apps/backend/.env.example apps/backend/.env
```

4. Build shared packages:
```bash
npm run build:shared
```

### Development

Start both frontend and backend in development mode:
```bash
npm run dev
```

Or start them individually:
```bash
# Start backend only
npm run dev:backend

# Start frontend only
npm run dev:frontend
```

### Building for Production

Build all applications:
```bash
npm run build
```

Or build individually:
```bash
npm run build:backend
npm run build:frontend
```

### Testing

Run tests for all workspaces:
```bash
npm run test
```

Or run tests individually:
```bash
npm run test:backend
npm run test:frontend
```

## Architecture

### Frontend (React + Vite)
- **Port**: 8080
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Radix UI + Tailwind CSS
- **State Management**: TanStack Query
- **Authentication**: Supabase Auth

### Backend (Node.js + Express)
- **Port**: 3000
- **Framework**: Express.js with TypeScript
- **Database**: Supabase PostgreSQL
- **File Storage**: Supabase Storage
- **Real-time**: WebSocket + Supabase Realtime
- **Processing**: Whisper, Google TTS, Coqui TTS

### Shared Package
- **Types**: Zod schemas for type safety
- **Utilities**: Validation helpers and constants
- **API Contracts**: Shared interfaces between frontend and backend

## Environment Variables

### Required Variables

#### Supabase Configuration
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (backend only)

#### Google Cloud Configuration
- `GOOGLE_CLOUD_PROJECT_ID`: Google Cloud project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account key file

### Optional Variables
- `WHISPER_MODEL_PATH`: Path to Whisper model files
- `COQUI_MODEL_PATH`: Path to Coqui TTS model files
- `SENTRY_DSN`: Sentry error tracking DSN
- `LOG_LEVEL`: Logging level (info, debug, error)

## Development Workflow

1. **Shared Types**: Add new types to `packages/shared/src/types/`
2. **Backend API**: Implement endpoints in `apps/backend/src/api/`
3. **Frontend Components**: Create components in `apps/frontend/src/components/`
4. **Testing**: Write tests alongside your code
5. **Build**: Ensure all workspaces build successfully

## Scripts Reference

### Root Level Scripts
- `npm run dev` - Start both frontend and backend
- `npm run build` - Build all workspaces
- `npm run test` - Run all tests
- `npm run lint` - Lint all workspaces
- `npm run clean` - Clean all build artifacts

### Workspace Scripts
- `npm run dev:backend` - Start backend only
- `npm run dev:frontend` - Start frontend only
- `npm run build:backend` - Build backend only
- `npm run build:frontend` - Build frontend only
- `npm run test:backend` - Test backend only
- `npm run test:frontend` - Test frontend only

## Contributing

1. Follow the existing code structure and patterns
2. Add tests for new functionality
3. Update types in the shared package when needed
4. Ensure all linting and type checking passes
5. Test both frontend and backend integration

## License

MIT License - see LICENSE file for details
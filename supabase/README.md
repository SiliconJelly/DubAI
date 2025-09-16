# DubAI Supabase Database Setup

This directory contains the complete database schema, migrations, and setup files for the DubAI application.

## Overview

The database is designed to support a full-stack movie dubbing application with the following key features:
- User authentication and profile management
- File upload and storage tracking
- Job processing and queue management
- Real-time status updates
- Cost tracking and analytics
- Row-level security for data protection

## Database Structure

### Core Tables

1. **user_profiles** - Extended user information beyond Supabase Auth
2. **storage_files** - File metadata and references to Supabase Storage
3. **dubbing_jobs** - Main job tracking with status and progress
4. **processing_metrics** - Detailed step-by-step processing metrics
5. **job_queue** - Processing queue management
6. **system_settings** - Application configuration
7. **user_sessions** - Session tracking and management

### Migration Files

- `001_initial_schema.sql` - Core table definitions and constraints
- `002_rls_policies.sql` - Row Level Security policies
- `003_indexes.sql` - Performance optimization indexes
- `004_functions.sql` - Database functions for common operations
- `005_realtime_triggers.sql` - Real-time notification triggers

### Seed Data

- `seed.sql` - Sample data for development and testing

## Setup Instructions

### 1. Local Development Setup

```bash
# Initialize Supabase project
npx supabase init

# Start local Supabase
npx supabase start

# Apply migrations
npx supabase db reset

# Load seed data (optional)
npx supabase db seed
```

### 2. Production Setup

```bash
# Link to your Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migrations to production
npx supabase db push

# Note: Don't run seed data in production
```

### 3. Environment Variables

Make sure to set these environment variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Key Features

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users can only access their own data
- Proper authentication checks
- Secure data isolation

### Real-time Updates

The database includes triggers for real-time notifications:
- Job status changes
- Processing step updates
- Queue position changes
- User statistics updates

### Performance Optimization

Comprehensive indexing strategy:
- Foreign key indexes
- Query-specific indexes
- Partial indexes for active data
- Full-text search indexes

### Data Integrity

- Foreign key constraints
- Check constraints for valid values
- Automatic timestamp updates
- Status transition validation

## Database Functions

### User Management
- `handle_new_user()` - Auto-create profile on signup
- `get_user_monthly_usage()` - Calculate usage statistics
- `update_user_stats()` - Update user statistics

### Job Management
- `update_job_progress()` - Update job status and progress
- `enqueue_job()` - Add job to processing queue
- `get_job_queue_position()` - Get current queue position

### System Operations
- `cleanup_expired_files()` - Remove expired temporary files
- `get_processing_costs()` - Calculate cost breakdowns
- `get_system_health()` - System health metrics

## Real-time Channels

The application uses these PostgreSQL notification channels:

- `job_status_{user_id}` - User-specific job updates
- `processing_metrics_{user_id}` - Processing step updates
- `queue_updates_{user_id}` - Queue position changes
- `job_updates` - Global job updates
- `queue_updates` - Global queue updates

## Storage Organization

Files are organized in Supabase Storage with this structure:

```
uploads/
├── {user_id}/
│   ├── videos/
│   │   └── {job_id}/
│   │       └── original.mp4
│   └── srt/
│       └── {job_id}/
│           └── original.srt
processing/
└── {user_id}/
    └── {job_id}/
        ├── extracted_audio.wav
        ├── transcription.json
        └── translation.json
outputs/
└── {user_id}/
    └── {job_id}/
        ├── dubbed_audio.wav
        ├── translated.srt
        └── final_video.mp4
```

## Usage Examples

### Creating a New Job

```sql
-- Insert new job
INSERT INTO dubbing_jobs (user_id, title, input_video_file_id)
VALUES (auth.uid(), 'My Movie', 'file-uuid');

-- Add to processing queue
SELECT enqueue_job('job-uuid', 15);
```

### Updating Job Progress

```sql
-- Update job status and progress
SELECT update_job_progress(
  'job-uuid',
  'transcribing',
  25,
  NULL,
  '{"current_step": "transcribing", "estimated_time": 120}'::jsonb
);
```

### Getting User Statistics

```sql
-- Get current month usage
SELECT * FROM get_user_monthly_usage();

-- Get cost breakdown
SELECT * FROM get_processing_costs();
```

## Monitoring and Maintenance

### Regular Maintenance Tasks

1. **Cleanup expired files**:
   ```sql
   SELECT cleanup_expired_files();
   ```

2. **Update user statistics**:
   ```sql
   SELECT update_user_stats(user_id) FROM user_profiles;
   ```

3. **System health check**:
   ```sql
   SELECT * FROM get_system_health();
   ```

### Performance Monitoring

Monitor these key metrics:
- Active job count
- Queue length
- Average processing time
- Storage usage
- Cost per job

## Security Considerations

1. **RLS Policies** - All user data is protected by RLS
2. **Function Security** - Functions use SECURITY DEFINER where needed
3. **Input Validation** - Check constraints prevent invalid data
4. **Audit Trail** - System events are logged for monitoring

## Troubleshooting

### Common Issues

1. **Migration Errors**:
   - Check for existing data conflicts
   - Verify user permissions
   - Review constraint violations

2. **RLS Policy Issues**:
   - Ensure auth.uid() is available
   - Check policy conditions
   - Verify user authentication

3. **Performance Issues**:
   - Check index usage with EXPLAIN
   - Monitor slow queries
   - Consider query optimization

### Debug Queries

```sql
-- Check active jobs
SELECT * FROM dubbing_jobs WHERE status NOT IN ('completed', 'failed', 'cancelled');

-- Check queue status
SELECT * FROM job_queue ORDER BY queue_position;

-- Check recent errors
SELECT * FROM dubbing_jobs WHERE status = 'failed' AND updated_at > NOW() - INTERVAL '1 day';
```

## Contributing

When adding new features:

1. Create new migration files with incremental numbers
2. Add appropriate RLS policies
3. Include necessary indexes
4. Add functions for complex operations
5. Update this README with new features

## Support

For issues with the database setup:
1. Check the Supabase logs
2. Verify migration order
3. Test with seed data
4. Review RLS policies
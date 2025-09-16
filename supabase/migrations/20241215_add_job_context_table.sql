-- Create job_context table for storing processing context data
CREATE TABLE IF NOT EXISTS job_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  context_key TEXT NOT NULL,
  context_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Create unique constraint on job_id + context_key
  UNIQUE(job_id, context_key)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_context_job_id ON job_context(job_id);
CREATE INDEX IF NOT EXISTS idx_job_context_key ON job_context(context_key);
CREATE INDEX IF NOT EXISTS idx_job_context_updated_at ON job_context(updated_at);

-- Add RLS policy
ALTER TABLE job_context ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to access their own job context
CREATE POLICY "Users can access own job context" ON job_context
  FOR ALL USING (
    job_id IN (
      SELECT id FROM dubbing_jobs WHERE user_id = auth.uid()
    )
  );

-- Add foreign key constraint to dubbing_jobs (if the table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dubbing_jobs') THEN
    ALTER TABLE job_context 
    ADD CONSTRAINT fk_job_context_job_id 
    FOREIGN KEY (job_id) REFERENCES dubbing_jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add cleanup function to remove old job context data
CREATE OR REPLACE FUNCTION cleanup_old_job_context()
RETURNS void AS $$
BEGIN
  -- Delete job context data older than 7 days for completed/failed jobs
  DELETE FROM job_context 
  WHERE updated_at < NOW() - INTERVAL '7 days'
  AND job_id IN (
    SELECT id FROM dubbing_jobs 
    WHERE status IN ('completed', 'failed')
  );
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- This would typically be set up separately in production
COMMENT ON FUNCTION cleanup_old_job_context() IS 'Cleans up old job context data for completed/failed jobs';
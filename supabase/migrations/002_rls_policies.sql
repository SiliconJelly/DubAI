-- Row Level Security Policies for DubAI
-- Ensures users can only access their own data

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE dubbing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Storage Files Policies
CREATE POLICY "Users can view own files" ON storage_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files" ON storage_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files" ON storage_files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" ON storage_files
  FOR DELETE USING (auth.uid() = user_id);

-- Dubbing Jobs Policies
CREATE POLICY "Users can view own jobs" ON dubbing_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs" ON dubbing_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON dubbing_jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON dubbing_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Processing Metrics Policies (via job ownership)
CREATE POLICY "Users can view metrics for own jobs" ON processing_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dubbing_jobs 
      WHERE dubbing_jobs.id = processing_metrics.job_id 
      AND dubbing_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert processing metrics" ON processing_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dubbing_jobs 
      WHERE dubbing_jobs.id = processing_metrics.job_id 
      AND dubbing_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "System can update processing metrics" ON processing_metrics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM dubbing_jobs 
      WHERE dubbing_jobs.id = processing_metrics.job_id 
      AND dubbing_jobs.user_id = auth.uid()
    )
  );

-- Job Queue Policies (via job ownership)
CREATE POLICY "Users can view own job queue entries" ON job_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dubbing_jobs 
      WHERE dubbing_jobs.id = job_queue.job_id 
      AND dubbing_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage job queue" ON job_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dubbing_jobs 
      WHERE dubbing_jobs.id = job_queue.job_id 
      AND dubbing_jobs.user_id = auth.uid()
    )
  );

-- User Sessions Policies
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON user_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- System Settings Policies (public read, admin write)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public settings" ON system_settings
  FOR SELECT USING (is_public = true);

CREATE POLICY "Authenticated users can view all settings" ON system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Note: Admin policies for system_settings would be added separately
-- based on your admin role implementation
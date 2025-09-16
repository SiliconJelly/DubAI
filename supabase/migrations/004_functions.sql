-- Database Functions for Common Operations
-- Functions to handle business logic and data operations

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dubbing_jobs_updated_at 
  BEFORE UPDATE ON dubbing_jobs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_queue_updated_at 
  BEFORE UPDATE ON job_queue 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at 
  BEFORE UPDATE ON system_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update job progress and metrics
CREATE OR REPLACE FUNCTION update_job_progress(
  p_job_id UUID,
  p_status TEXT,
  p_progress INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metrics JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  -- Check if job exists and belongs to current user
  SELECT EXISTS(
    SELECT 1 FROM dubbing_jobs 
    WHERE id = p_job_id AND user_id = auth.uid()
  ) INTO job_exists;
  
  IF NOT job_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Update job status and progress
  UPDATE dubbing_jobs 
  SET 
    status = p_status,
    progress = COALESCE(p_progress, progress),
    error_message = p_error_message,
    processing_metrics = COALESCE(p_metrics, processing_metrics),
    started_at = CASE 
      WHEN p_status NOT IN ('uploaded', 'failed', 'cancelled') AND started_at IS NULL 
      THEN NOW() 
      ELSE started_at 
    END,
    completed_at = CASE 
      WHEN p_status IN ('completed', 'failed', 'cancelled') 
      THEN NOW() 
      ELSE completed_at 
    END
  WHERE id = p_job_id;
  
  RETURN TRUE;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to calculate user's monthly usage
CREATE OR REPLACE FUNCTION get_user_monthly_usage(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  total_jobs INTEGER,
  total_minutes INTEGER,
  current_tier TEXT,
  usage_percentage DECIMAL
) AS $$
DECLARE
  tier_limits JSONB;
BEGIN
  -- Get user's subscription tier and limits
  SELECT 
    up.subscription_tier,
    CASE up.subscription_tier
      WHEN 'free' THEN '{"jobs": 5, "minutes": 60}'::jsonb
      WHEN 'basic' THEN '{"jobs": 50, "minutes": 600}'::jsonb
      WHEN 'pro' THEN '{"jobs": 200, "minutes": 2400}'::jsonb
      WHEN 'enterprise' THEN '{"jobs": -1, "minutes": -1}'::jsonb
    END
  INTO current_tier, tier_limits
  FROM user_profiles up
  WHERE up.id = p_user_id;
  
  -- Calculate current month usage
  SELECT 
    COUNT(*)::INTEGER,
    COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at))/60), 0)::INTEGER
  INTO total_jobs, total_minutes
  FROM dubbing_jobs
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', CURRENT_DATE)
    AND status = 'completed';
  
  -- Calculate usage percentage
  usage_percentage := CASE 
    WHEN tier_limits->>'minutes' = '-1' THEN 0 -- Unlimited
    ELSE (total_minutes::DECIMAL / (tier_limits->>'minutes')::DECIMAL) * 100
  END;
  
  RETURN QUERY SELECT total_jobs, total_minutes, current_tier, usage_percentage;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to get job queue position
CREATE OR REPLACE FUNCTION get_job_queue_position(p_job_id UUID)
RETURNS INTEGER AS $$
DECLARE
  position INTEGER;
BEGIN
  SELECT queue_position INTO position
  FROM job_queue
  WHERE job_id = p_job_id;
  
  RETURN COALESCE(position, 0);
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to add job to processing queue
CREATE OR REPLACE FUNCTION enqueue_job(
  p_job_id UUID,
  p_estimated_duration INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  max_position INTEGER;
  job_exists BOOLEAN;
BEGIN
  -- Check if job exists and belongs to current user
  SELECT EXISTS(
    SELECT 1 FROM dubbing_jobs 
    WHERE id = p_job_id AND user_id = auth.uid()
  ) INTO job_exists;
  
  IF NOT job_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Get next queue position
  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO max_position
  FROM job_queue;
  
  -- Insert into queue
  INSERT INTO job_queue (job_id, queue_position, estimated_duration_minutes)
  VALUES (p_job_id, max_position, p_estimated_duration)
  ON CONFLICT (job_id) DO UPDATE SET
    queue_position = max_position,
    estimated_duration_minutes = p_estimated_duration,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to clean up expired files
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired temporary files
  DELETE FROM storage_files
  WHERE is_temporary = true 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to get processing cost breakdown
CREATE OR REPLACE FUNCTION get_processing_costs(
  p_job_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid(),
  p_start_date DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  service_name TEXT,
  total_cost DECIMAL,
  usage_count INTEGER,
  avg_cost DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.service_used,
    SUM(pm.cost_estimate) as total_cost,
    COUNT(*)::INTEGER as usage_count,
    AVG(pm.cost_estimate) as avg_cost
  FROM processing_metrics pm
  JOIN dubbing_jobs dj ON pm.job_id = dj.id
  WHERE 
    (p_job_id IS NULL OR pm.job_id = p_job_id)
    AND dj.user_id = p_user_id
    AND pm.created_at::DATE BETWEEN p_start_date AND p_end_date
    AND pm.cost_estimate > 0
  GROUP BY pm.service_used
  ORDER BY total_cost DESC;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to update user statistics
CREATE OR REPLACE FUNCTION update_user_stats(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET 
    total_jobs_completed = (
      SELECT COUNT(*) FROM dubbing_jobs 
      WHERE user_id = p_user_id AND status = 'completed'
    ),
    total_processing_time = (
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at))), 0)
      FROM dubbing_jobs 
      WHERE user_id = p_user_id AND status = 'completed'
    ),
    monthly_usage_minutes = (
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at))/60), 0)
      FROM dubbing_jobs 
      WHERE user_id = p_user_id 
        AND status = 'completed'
        AND created_at >= date_trunc('month', CURRENT_DATE)
    )
  WHERE id = p_user_id;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to get system health metrics
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE(
  active_jobs INTEGER,
  queued_jobs INTEGER,
  completed_today INTEGER,
  failed_today INTEGER,
  avg_processing_time DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM dubbing_jobs WHERE status NOT IN ('completed', 'failed', 'cancelled')) as active_jobs,
    (SELECT COUNT(*)::INTEGER FROM job_queue) as queued_jobs,
    (SELECT COUNT(*)::INTEGER FROM dubbing_jobs WHERE status = 'completed' AND completed_at::DATE = CURRENT_DATE) as completed_today,
    (SELECT COUNT(*)::INTEGER FROM dubbing_jobs WHERE status = 'failed' AND updated_at::DATE = CURRENT_DATE) as failed_today,
    (SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) FROM dubbing_jobs WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as avg_processing_time;
END;
$$ language 'plpgsql' SECURITY DEFINER;
-- Database Indexes for Optimal Query Performance
-- Indexes for frequently queried columns and foreign keys

-- User Profiles Indexes
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_subscription_tier ON user_profiles(subscription_tier);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at);
CREATE INDEX idx_user_profiles_monthly_reset ON user_profiles(monthly_usage_reset_date);

-- Storage Files Indexes
CREATE INDEX idx_storage_files_user_id ON storage_files(user_id);
CREATE INDEX idx_storage_files_file_type ON storage_files(file_type);
CREATE INDEX idx_storage_files_file_category ON storage_files(file_category);
CREATE INDEX idx_storage_files_created_at ON storage_files(created_at);
CREATE INDEX idx_storage_files_expires_at ON storage_files(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_storage_files_temporary ON storage_files(is_temporary, expires_at) WHERE is_temporary = true;
CREATE INDEX idx_storage_files_storage_path ON storage_files(storage_path);

-- Dubbing Jobs Indexes
CREATE INDEX idx_dubbing_jobs_user_id ON dubbing_jobs(user_id);
CREATE INDEX idx_dubbing_jobs_status ON dubbing_jobs(status);
CREATE INDEX idx_dubbing_jobs_created_at ON dubbing_jobs(created_at);
CREATE INDEX idx_dubbing_jobs_updated_at ON dubbing_jobs(updated_at);
CREATE INDEX idx_dubbing_jobs_priority ON dubbing_jobs(priority);
CREATE INDEX idx_dubbing_jobs_user_status ON dubbing_jobs(user_id, status);
CREATE INDEX idx_dubbing_jobs_user_created ON dubbing_jobs(user_id, created_at DESC);
CREATE INDEX idx_dubbing_jobs_processing ON dubbing_jobs(status, priority) WHERE status IN ('uploaded', 'extracting_audio', 'transcribing', 'translating', 'generating_speech', 'assembling_audio');

-- Composite index for user's recent jobs
CREATE INDEX idx_dubbing_jobs_user_recent ON dubbing_jobs(user_id, created_at DESC, status);

-- Processing Metrics Indexes
CREATE INDEX idx_processing_metrics_job_id ON processing_metrics(job_id);
CREATE INDEX idx_processing_metrics_step_name ON processing_metrics(step_name);
CREATE INDEX idx_processing_metrics_status ON processing_metrics(status);
CREATE INDEX idx_processing_metrics_job_step ON processing_metrics(job_id, step_order);
CREATE INDEX idx_processing_metrics_created_at ON processing_metrics(created_at);
CREATE INDEX idx_processing_metrics_duration ON processing_metrics(duration_ms) WHERE duration_ms IS NOT NULL;

-- Job Queue Indexes
CREATE INDEX idx_job_queue_job_id ON job_queue(job_id);
CREATE INDEX idx_job_queue_position ON job_queue(queue_position) WHERE queue_position IS NOT NULL;
CREATE INDEX idx_job_queue_estimated_start ON job_queue(estimated_start_time) WHERE estimated_start_time IS NOT NULL;
CREATE INDEX idx_job_queue_worker ON job_queue(worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX idx_job_queue_created_at ON job_queue(created_at);

-- User Sessions Indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, expires_at) WHERE expires_at > NOW();

-- System Settings Indexes
CREATE INDEX idx_system_settings_public ON system_settings(is_public);
CREATE INDEX idx_system_settings_updated_at ON system_settings(updated_at);

-- Full-text search indexes for job titles and descriptions
CREATE INDEX idx_dubbing_jobs_title_search ON dubbing_jobs USING gin(to_tsvector('english', title));
CREATE INDEX idx_dubbing_jobs_description_search ON dubbing_jobs USING gin(to_tsvector('english', description)) WHERE description IS NOT NULL;

-- Partial indexes for active/recent data
CREATE INDEX idx_dubbing_jobs_recent_active ON dubbing_jobs(user_id, updated_at DESC) 
  WHERE status NOT IN ('completed', 'failed', 'cancelled') OR updated_at > NOW() - INTERVAL '7 days';

CREATE INDEX idx_storage_files_recent ON storage_files(user_id, created_at DESC) 
  WHERE created_at > NOW() - INTERVAL '30 days';

-- Indexes for cost and usage analytics
CREATE INDEX idx_processing_metrics_cost ON processing_metrics(service_used, cost_estimate) 
  WHERE cost_estimate > 0;

CREATE INDEX idx_dubbing_jobs_monthly_usage ON dubbing_jobs(user_id, created_at) 
  WHERE created_at >= date_trunc('month', CURRENT_DATE);

-- Cleanup indexes for maintenance operations
CREATE INDEX idx_storage_files_cleanup ON storage_files(is_temporary, expires_at) 
  WHERE is_temporary = true AND expires_at < NOW();

CREATE INDEX idx_user_sessions_cleanup ON user_sessions(expires_at) 
  WHERE expires_at < NOW();
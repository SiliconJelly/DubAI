-- Real-time Triggers and Functions for Live Updates
-- Functions and triggers to support real-time job status updates

-- Function to notify job status changes
CREATE OR REPLACE FUNCTION notify_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_payload JSONB;
BEGIN
  -- Create notification payload
  notification_payload := jsonb_build_object(
    'job_id', NEW.id,
    'user_id', NEW.user_id,
    'status', NEW.status,
    'progress', NEW.progress,
    'updated_at', NEW.updated_at,
    'error_message', NEW.error_message
  );
  
  -- Send notification to specific user channel
  PERFORM pg_notify(
    'job_status_' || NEW.user_id::text,
    notification_payload::text
  );
  
  -- Send notification to general job updates channel
  PERFORM pg_notify(
    'job_updates',
    notification_payload::text
  );
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for job status changes
CREATE TRIGGER job_status_change_trigger
  AFTER UPDATE OF status, progress, error_message ON dubbing_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR 
        OLD.progress IS DISTINCT FROM NEW.progress OR 
        OLD.error_message IS DISTINCT FROM NEW.error_message)
  EXECUTE FUNCTION notify_job_status_change();

-- Function to notify processing metrics updates
CREATE OR REPLACE FUNCTION notify_processing_metrics_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_payload JSONB;
  job_user_id UUID;
BEGIN
  -- Get the user_id from the associated job
  SELECT user_id INTO job_user_id
  FROM dubbing_jobs
  WHERE id = NEW.job_id;
  
  -- Create notification payload
  notification_payload := jsonb_build_object(
    'job_id', NEW.job_id,
    'user_id', job_user_id,
    'step_name', NEW.step_name,
    'step_order', NEW.step_order,
    'status', NEW.status,
    'duration_ms', NEW.duration_ms,
    'service_used', NEW.service_used,
    'cost_estimate', NEW.cost_estimate
  );
  
  -- Send notification to user-specific channel
  IF job_user_id IS NOT NULL THEN
    PERFORM pg_notify(
      'processing_metrics_' || job_user_id::text,
      notification_payload::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for processing metrics changes
CREATE TRIGGER processing_metrics_change_trigger
  AFTER INSERT OR UPDATE ON processing_metrics
  FOR EACH ROW
  EXECUTE FUNCTION notify_processing_metrics_change();

-- Function to notify queue position changes
CREATE OR REPLACE FUNCTION notify_queue_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_payload JSONB;
  job_user_id UUID;
BEGIN
  -- Get the user_id from the associated job
  SELECT user_id INTO job_user_id
  FROM dubbing_jobs
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  -- Create notification payload for INSERT/UPDATE
  IF TG_OP = 'DELETE' THEN
    notification_payload := jsonb_build_object(
      'job_id', OLD.job_id,
      'user_id', job_user_id,
      'action', 'removed_from_queue'
    );
  ELSE
    notification_payload := jsonb_build_object(
      'job_id', NEW.job_id,
      'user_id', job_user_id,
      'queue_position', NEW.queue_position,
      'estimated_start_time', NEW.estimated_start_time,
      'estimated_duration_minutes', NEW.estimated_duration_minutes,
      'action', CASE WHEN TG_OP = 'INSERT' THEN 'added_to_queue' ELSE 'queue_updated' END
    );
  END IF;
  
  -- Send notification to user-specific channel
  IF job_user_id IS NOT NULL THEN
    PERFORM pg_notify(
      'queue_updates_' || job_user_id::text,
      notification_payload::text
    );
  END IF;
  
  -- Send to general queue updates channel
  PERFORM pg_notify(
    'queue_updates',
    notification_payload::text
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger for queue changes
CREATE TRIGGER queue_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON job_queue
  FOR EACH ROW
  EXECUTE FUNCTION notify_queue_change();

-- Function to automatically update user statistics when jobs complete
CREATE OR REPLACE FUNCTION auto_update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stats when job status changes to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    PERFORM update_user_stats(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update user stats on job completion
CREATE TRIGGER auto_update_user_stats_trigger
  AFTER UPDATE OF status ON dubbing_jobs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION auto_update_user_stats();

-- Function to clean up job queue when job completes or fails
CREATE OR REPLACE FUNCTION cleanup_job_queue()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove job from queue when it completes, fails, or is cancelled
  IF NEW.status IN ('completed', 'failed', 'cancelled') AND 
     OLD.status NOT IN ('completed', 'failed', 'cancelled') THEN
    DELETE FROM job_queue WHERE job_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to cleanup job queue
CREATE TRIGGER cleanup_job_queue_trigger
  AFTER UPDATE OF status ON dubbing_jobs
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'failed', 'cancelled') AND 
        OLD.status NOT IN ('completed', 'failed', 'cancelled'))
  EXECUTE FUNCTION cleanup_job_queue();

-- Function to validate job status transitions
CREATE OR REPLACE FUNCTION validate_job_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB;
BEGIN
  -- Define valid status transitions
  valid_transitions := '{
    "uploaded": ["extracting_audio", "failed", "cancelled"],
    "extracting_audio": ["transcribing", "failed", "cancelled"],
    "transcribing": ["translating", "failed", "cancelled"],
    "translating": ["generating_speech", "failed", "cancelled"],
    "generating_speech": ["assembling_audio", "failed", "cancelled"],
    "assembling_audio": ["completed", "failed", "cancelled"],
    "completed": [],
    "failed": ["uploaded"],
    "cancelled": ["uploaded"]
  }'::jsonb;
  
  -- Allow initial status setting
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if transition is valid
  IF NOT (valid_transitions->OLD.status ? NEW.status) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;
  
  -- Ensure progress is consistent with status
  IF NEW.status = 'completed' AND NEW.progress != 100 THEN
    NEW.progress := 100;
  ELSIF NEW.status IN ('failed', 'cancelled') AND NEW.progress = 100 THEN
    NEW.progress := GREATEST(OLD.progress, 0);
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to validate status transitions
CREATE TRIGGER validate_job_status_transition_trigger
  BEFORE UPDATE OF status ON dubbing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION validate_job_status_transition();

-- Function to automatically set file expiration for temporary files
CREATE OR REPLACE FUNCTION set_temp_file_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Set expiration for temporary files (24 hours for processing files, 7 days for outputs)
  IF NEW.is_temporary = true AND NEW.expires_at IS NULL THEN
    NEW.expires_at := CASE 
      WHEN NEW.file_category = 'processing' THEN NOW() + INTERVAL '24 hours'
      WHEN NEW.file_category = 'output' THEN NOW() + INTERVAL '7 days'
      ELSE NOW() + INTERVAL '1 hour'
    END;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to set temp file expiration
CREATE TRIGGER set_temp_file_expiration_trigger
  BEFORE INSERT OR UPDATE ON storage_files
  FOR EACH ROW
  WHEN (NEW.is_temporary = true)
  EXECUTE FUNCTION set_temp_file_expiration();

-- Function to log system events
CREATE OR REPLACE FUNCTION log_system_event(
  event_type TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  event_id := gen_random_uuid();
  
  -- Insert into system_events table (we'll create this if needed)
  INSERT INTO system_events (id, event_type, event_data, user_id, created_at)
  VALUES (event_id, event_type, event_data, user_id, NOW())
  ON CONFLICT DO NOTHING;
  
  RETURN event_id;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist, create it
    CREATE TABLE IF NOT EXISTS system_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type TEXT NOT NULL,
      event_data JSONB DEFAULT '{}',
      user_id UUID REFERENCES auth.users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Retry the insert
    INSERT INTO system_events (id, event_type, event_data, user_id, created_at)
    VALUES (event_id, event_type, event_data, user_id, NOW());
    
    RETURN event_id;
END;
$$ language 'plpgsql' SECURITY DEFINER;
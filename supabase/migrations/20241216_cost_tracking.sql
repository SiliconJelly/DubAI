-- Cost Tracking and Service Optimization Tables

-- Service usage tracking table
CREATE TABLE IF NOT EXISTS service_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  job_id UUID REFERENCES dubbing_jobs(id),
  service_type TEXT NOT NULL CHECK (service_type IN ('google_cloud', 'coqui_local')),
  characters_processed INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cost optimization recommendations table
CREATE TABLE IF NOT EXISTS cost_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('service_switch', 'quota_management', 'batch_processing', 'quality_adjustment')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  potential_savings DECIMAL(10,6) NOT NULL DEFAULT 0,
  impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high')),
  action_required TEXT NOT NULL,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quota alerts table
CREATE TABLE IF NOT EXISTS quota_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('google_cloud', 'coqui_local', 'monthly_budget')),
  current_usage DECIMAL(12,2) NOT NULL,
  usage_limit DECIMAL(12,2) NOT NULL,
  threshold_percentage INTEGER NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User cost preferences table
CREATE TABLE IF NOT EXISTS user_cost_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  monthly_budget DECIMAL(10,2),
  auto_service_selection BOOLEAN DEFAULT TRUE,
  quality_preference TEXT DEFAULT 'medium' CHECK (quality_preference IN ('low', 'medium', 'high')),
  cost_optimization_enabled BOOLEAN DEFAULT TRUE,
  quota_alert_threshold INTEGER DEFAULT 75 CHECK (quota_alert_threshold BETWEEN 50 AND 95),
  preferred_service TEXT DEFAULT 'auto' CHECK (preferred_service IN ('auto', 'google_cloud', 'coqui_local')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add cost tracking fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS total_characters_processed BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_budget DECIMAL(10,2);

-- Add cost tracking fields to dubbing_jobs table
ALTER TABLE dubbing_jobs 
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(10,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS selected_tts_service TEXT CHECK (selected_tts_service IN ('google_cloud', 'coqui_local', 'auto'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_usage_user_id ON service_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_service_usage_created_at ON service_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_service_usage_service_type ON service_usage(service_type);
CREATE INDEX IF NOT EXISTS idx_service_usage_user_date ON service_usage(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_cost_recommendations_user_id ON cost_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_recommendations_dismissed ON cost_recommendations(user_id, is_dismissed);

CREATE INDEX IF NOT EXISTS idx_quota_alerts_user_id ON quota_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_acknowledged ON quota_alerts(user_id, is_acknowledged);

-- Row Level Security Policies
ALTER TABLE service_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cost_preferences ENABLE ROW LEVEL SECURITY;

-- Service usage policies
CREATE POLICY "Users can view own service usage" ON service_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert service usage" ON service_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Cost recommendations policies
CREATE POLICY "Users can view own cost recommendations" ON cost_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own cost recommendations" ON cost_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert cost recommendations" ON cost_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Quota alerts policies
CREATE POLICY "Users can view own quota alerts" ON quota_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quota alerts" ON quota_alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert quota alerts" ON quota_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User cost preferences policies
CREATE POLICY "Users can view own cost preferences" ON user_cost_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own cost preferences" ON user_cost_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cost preferences" ON user_cost_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Functions for cost calculations
CREATE OR REPLACE FUNCTION calculate_monthly_usage(user_uuid UUID)
RETURNS TABLE (
  service_type TEXT,
  total_characters BIGINT,
  total_cost DECIMAL(10,6),
  total_api_calls BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.service_type,
    SUM(su.characters_processed)::BIGINT as total_characters,
    SUM(su.cost) as total_cost,
    SUM(su.api_calls)::BIGINT as total_api_calls
  FROM service_usage su
  WHERE su.user_id = user_uuid
    AND su.created_at >= date_trunc('month', CURRENT_DATE)
  GROUP BY su.service_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cost trends
CREATE OR REPLACE FUNCTION get_cost_trends(user_uuid UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  service_type TEXT,
  daily_cost DECIMAL(10,6),
  daily_characters BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.created_at::DATE as date,
    su.service_type,
    SUM(su.cost) as daily_cost,
    SUM(su.characters_processed)::BIGINT as daily_characters
  FROM service_usage su
  WHERE su.user_id = user_uuid
    AND su.created_at >= CURRENT_DATE - INTERVAL '1 day' * days
  GROUP BY su.created_at::DATE, su.service_type
  ORDER BY date DESC, service_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update user totals when service usage is inserted
CREATE OR REPLACE FUNCTION update_user_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles 
  SET 
    total_characters_processed = COALESCE(total_characters_processed, 0) + NEW.characters_processed,
    total_cost = COALESCE(total_cost, 0) + NEW.cost,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_totals
  AFTER INSERT ON service_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_user_totals();

-- Insert default cost preferences for existing users
INSERT INTO user_cost_preferences (user_id)
SELECT id FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM user_cost_preferences)
ON CONFLICT (user_id) DO NOTHING;
-- DubAI Database Schema Migration
-- Initial schema for user profiles, jobs, and file storage

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User profiles table (extends Supabase Auth users)
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
  total_processing_time INTEGER DEFAULT 0,
  total_jobs_completed INTEGER DEFAULT 0,
  monthly_usage_minutes INTEGER DEFAULT 0,
  monthly_usage_reset_date DATE DEFAULT CURRENT_DATE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage files table for tracking all uploaded and generated files
CREATE TABLE storage_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL CHECK (file_type IN ('video', 'audio', 'srt', 'image', 'document')),
  file_category TEXT DEFAULT 'upload' CHECK (file_category IN ('upload', 'processing', 'output')),
  metadata JSONB DEFAULT '{}',
  is_temporary BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dubbing jobs table for tracking processing jobs
CREATE TABLE dubbing_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'extracting_audio', 'transcribing', 'translating', 
    'generating_speech', 'assembling_audio', 'completed', 'failed', 'cancelled'
  )),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  
  -- Input file references
  input_video_file_id UUID REFERENCES storage_files(id) ON DELETE SET NULL,
  input_srt_file_id UUID REFERENCES storage_files(id) ON DELETE SET NULL,
  
  -- Output file references
  output_audio_file_id UUID REFERENCES storage_files(id) ON DELETE SET NULL,
  output_srt_file_id UUID REFERENCES storage_files(id) ON DELETE SET NULL,
  output_video_file_id UUID REFERENCES storage_files(id) ON DELETE SET NULL,
  
  -- Processing configuration
  target_language TEXT DEFAULT 'bn',
  tts_service_preference TEXT CHECK (tts_service_preference IN ('auto', 'google', 'coqui')),
  quality_preset TEXT DEFAULT 'balanced' CHECK (quality_preset IN ('fast', 'balanced', 'high')),
  
  -- Processing metrics and results
  processing_metrics JSONB DEFAULT '{}',
  cost_breakdown JSONB DEFAULT '{}',
  error_message TEXT,
  error_details JSONB,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing metrics table for detailed step tracking
CREATE TABLE processing_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES dubbing_jobs(id) ON DELETE CASCADE NOT NULL,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  
  -- Timing information
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Service and cost information
  service_used TEXT,
  cost_estimate DECIMAL(10,4) DEFAULT 0,
  
  -- Additional metadata
  input_size BIGINT,
  output_size BIGINT,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(job_id, step_name)
);

-- Job queue table for managing processing queue
CREATE TABLE job_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES dubbing_jobs(id) ON DELETE CASCADE NOT NULL UNIQUE,
  queue_position INTEGER,
  estimated_start_time TIMESTAMP WITH TIME ZONE,
  estimated_duration_minutes INTEGER,
  worker_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System settings table for application configuration
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- User sessions table for tracking active sessions and usage
CREATE TABLE user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token TEXT UNIQUE,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
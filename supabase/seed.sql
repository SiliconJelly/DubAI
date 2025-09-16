-- Seed Data for DubAI Development and Testing
-- This file contains sample data for development and testing purposes

-- Insert system settings
INSERT INTO system_settings (key, value, description, is_public) VALUES
('app_version', '"1.0.0"', 'Current application version', true),
('maintenance_mode', 'false', 'Whether the app is in maintenance mode', true),
('max_file_size_mb', '500', 'Maximum file size in MB', true),
('supported_video_formats', '["mp4", "mov", "avi", "mkv"]', 'Supported video file formats', true),
('supported_subtitle_formats', '["srt", "vtt"]', 'Supported subtitle file formats', true),
('default_target_language', '"bn"', 'Default target language for dubbing', true),
('tts_services', '{"google": {"enabled": true, "cost_per_char": 0.000016}, "coqui": {"enabled": true, "cost_per_char": 0.0}}', 'Available TTS services and pricing', false),
('processing_queue_limit', '10', 'Maximum number of concurrent processing jobs', false),
('free_tier_limits', '{"jobs_per_month": 5, "minutes_per_month": 60}', 'Free tier usage limits', false),
('basic_tier_limits', '{"jobs_per_month": 50, "minutes_per_month": 600}', 'Basic tier usage limits', false),
('pro_tier_limits', '{"jobs_per_month": 200, "minutes_per_month": 2400}', 'Pro tier usage limits', false)
ON CONFLICT (key) DO NOTHING;

-- Create test users (these would normally be created through Supabase Auth)
-- Note: In a real environment, these would be created through the auth system
-- This is just for development/testing purposes

-- Insert sample user profiles (assuming auth users exist)
-- You would need to create actual auth users first in your development environment

-- Sample storage files (for testing file references)
-- These represent files that would be uploaded to Supabase Storage
INSERT INTO storage_files (id, user_id, filename, file_size, mime_type, storage_path, file_type, file_category, metadata) VALUES
-- Sample video files
('550e8400-e29b-41d4-a716-446655440001', '00000000-0000-0000-0000-000000000001', 'sample_movie.mp4', 52428800, 'video/mp4', 'uploads/00000000-0000-0000-0000-000000000001/videos/sample_movie.mp4', 'video', 'upload', '{"duration": 300, "resolution": "1920x1080", "fps": 24}'),
('550e8400-e29b-41d4-a716-446655440002', '00000000-0000-0000-0000-000000000001', 'sample_subtitles.srt', 2048, 'text/plain', 'uploads/00000000-0000-0000-0000-000000000001/srt/sample_subtitles.srt', 'srt', 'upload', '{"line_count": 45, "language": "en"}'),
('550e8400-e29b-41d4-a716-446655440003', '00000000-0000-0000-0000-000000000002', 'demo_video.mp4', 31457280, 'video/mp4', 'uploads/00000000-0000-0000-0000-000000000002/videos/demo_video.mp4', 'video', 'upload', '{"duration": 180, "resolution": "1280x720", "fps": 30}'),

-- Sample output files
('550e8400-e29b-41d4-a716-446655440004', '00000000-0000-0000-0000-000000000001', 'dubbed_audio.wav', 15728640, 'audio/wav', 'outputs/00000000-0000-0000-0000-000000000001/job1/dubbed_audio.wav', 'audio', 'output', '{"duration": 300, "sample_rate": 44100, "channels": 2}'),
('550e8400-e29b-41d4-a716-446655440005', '00000000-0000-0000-0000-000000000001', 'translated_subtitles.srt', 2560, 'text/plain', 'outputs/00000000-0000-0000-0000-000000000001/job1/translated_subtitles.srt', 'srt', 'output', '{"line_count": 45, "language": "bn"}')
ON CONFLICT (id) DO NOTHING;

-- Sample dubbing jobs
INSERT INTO dubbing_jobs (id, user_id, title, description, status, progress, input_video_file_id, input_srt_file_id, output_audio_file_id, output_srt_file_id, target_language, tts_service_preference, quality_preset, processing_metrics, cost_breakdown, started_at, completed_at) VALUES
-- Completed job
('660e8400-e29b-41d4-a716-446655440001', '00000000-0000-0000-0000-000000000001', 'Sample Movie Dubbing', 'Test dubbing of a sample movie from English to Bengali', 'completed', 100, '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440005', 'bn', 'auto', 'balanced', 
'{"audio_extraction_time": 15000, "transcription_time": 45000, "translation_time": 12000, "tts_generation_time": 120000, "audio_assembly_time": 30000, "total_processing_time": 222000, "tts_service": "google", "quality_score": 0.92}',
'{"google_tts": 2.45, "processing": 0.15, "storage": 0.05, "total": 2.65}',
NOW() - INTERVAL '2 hours', NOW() - INTERVAL '30 minutes'),

-- In-progress job
('660e8400-e29b-41d4-a716-446655440002', '00000000-0000-0000-0000-000000000002', 'Demo Video Dubbing', 'Quick demo of the dubbing process', 'generating_speech', 65, '550e8400-e29b-41d4-a716-446655440003', NULL, NULL, NULL, 'bn', 'coqui', 'fast',
'{"audio_extraction_time": 8000, "transcription_time": 25000, "translation_time": 7000, "tts_service": "coqui"}',
'{"processing": 0.08, "storage": 0.02}',
NOW() - INTERVAL '15 minutes', NULL),

-- Failed job
('660e8400-e29b-41d4-a716-446655440003', '00000000-0000-0000-0000-000000000001', 'Failed Processing Test', 'Test case for error handling', 'failed', 25, '550e8400-e29b-41d4-a716-446655440001', NULL, NULL, NULL, 'bn', 'auto', 'balanced',
'{"audio_extraction_time": 12000}',
'{"processing": 0.05}',
NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes')
ON CONFLICT (id) DO NOTHING;

-- Sample processing metrics
INSERT INTO processing_metrics (job_id, step_name, step_order, status, start_time, end_time, duration_ms, service_used, cost_estimate, input_size, output_size, metadata) VALUES
-- Metrics for completed job
('660e8400-e29b-41d4-a716-446655440001', 'audio_extraction', 1, 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '15 seconds', 15000, 'ffmpeg', 0.05, 52428800, 15728640, '{"codec": "wav", "sample_rate": 44100}'),
('660e8400-e29b-41d4-a716-446655440001', 'transcription', 2, 'completed', NOW() - INTERVAL '2 hours' + INTERVAL '15 seconds', NOW() - INTERVAL '2 hours' + INTERVAL '1 minute', 45000, 'whisper', 0.10, 15728640, 2048, '{"model": "base", "language": "en", "confidence": 0.95}'),
('660e8400-e29b-41d4-a716-446655440001', 'translation', 3, 'completed', NOW() - INTERVAL '2 hours' + INTERVAL '1 minute', NOW() - INTERVAL '2 hours' + INTERVAL '1 minute 12 seconds', 12000, 'google_translate', 0.02, 2048, 2560, '{"source_lang": "en", "target_lang": "bn", "confidence": 0.88}'),
('660e8400-e29b-41d4-a716-446655440001', 'tts_generation', 4, 'completed', NOW() - INTERVAL '2 hours' + INTERVAL '1 minute 12 seconds', NOW() - INTERVAL '2 hours' + INTERVAL '3 minutes 12 seconds', 120000, 'google_tts', 2.45, 2560, 15728640, '{"voice": "bn-IN-Standard-A", "characters": 1532, "audio_format": "wav"}'),
('660e8400-e29b-41d4-a716-446655440001', 'audio_assembly', 5, 'completed', NOW() - INTERVAL '2 hours' + INTERVAL '3 minutes 12 seconds', NOW() - INTERVAL '30 minutes', 30000, 'ffmpeg', 0.03, 15728640, 15728640, '{"format": "wav", "channels": 2, "sample_rate": 44100}'),

-- Metrics for in-progress job
('660e8400-e29b-41d4-a716-446655440002', 'audio_extraction', 1, 'completed', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes' + INTERVAL '8 seconds', 8000, 'ffmpeg', 0.03, 31457280, 9437184, '{"codec": "wav", "sample_rate": 44100}'),
('660e8400-e29b-41d4-a716-446655440002', 'transcription', 2, 'completed', NOW() - INTERVAL '15 minutes' + INTERVAL '8 seconds', NOW() - INTERVAL '15 minutes' + INTERVAL '33 seconds', 25000, 'whisper', 0.05, 9437184, 1024, '{"model": "base", "language": "en", "confidence": 0.92}'),
('660e8400-e29b-41d4-a716-446655440002', 'translation', 3, 'completed', NOW() - INTERVAL '15 minutes' + INTERVAL '33 seconds', NOW() - INTERVAL '15 minutes' + INTERVAL '40 seconds', 7000, 'google_translate', 0.01, 1024, 1280, '{"source_lang": "en", "target_lang": "bn", "confidence": 0.85}'),
('660e8400-e29b-41d4-a716-446655440002', 'tts_generation', 4, 'running', NOW() - INTERVAL '15 minutes' + INTERVAL '40 seconds', NULL, NULL, 'coqui_tts', 0.00, 1280, NULL, '{"voice": "bengali_female", "characters": 800}'),

-- Metrics for failed job
('660e8400-e29b-41d4-a716-446655440003', 'audio_extraction', 1, 'completed', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '12 seconds', 12000, 'ffmpeg', 0.05, 52428800, 15728640, '{"codec": "wav", "sample_rate": 44100}'),
('660e8400-e29b-41d4-a716-446655440003', 'transcription', 2, 'failed', NOW() - INTERVAL '1 hour' + INTERVAL '12 seconds', NOW() - INTERVAL '45 minutes', NULL, 'whisper', 0.00, 15728640, NULL, '{"error": "Audio file corrupted", "error_code": "AUDIO_DECODE_ERROR"}')
ON CONFLICT (job_id, step_name) DO NOTHING;

-- Sample job queue entries
INSERT INTO job_queue (job_id, queue_position, estimated_start_time, estimated_duration_minutes) VALUES
('660e8400-e29b-41d4-a716-446655440002', 1, NOW() + INTERVAL '5 minutes', 8)
ON CONFLICT (job_id) DO NOTHING;

-- Sample user sessions (for testing session management)
INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at) VALUES
('00000000-0000-0000-0000-000000000001', 'session_token_123456789', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', NOW() + INTERVAL '7 days'),
('00000000-0000-0000-0000-000000000002', 'session_token_987654321', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', NOW() + INTERVAL '7 days')
ON CONFLICT (session_token) DO NOTHING;

-- Update user profiles with calculated statistics
-- Note: In production, this would be handled by triggers and functions
UPDATE user_profiles SET
  total_jobs_completed = (
    SELECT COUNT(*) FROM dubbing_jobs 
    WHERE user_id = user_profiles.id AND status = 'completed'
  ),
  total_processing_time = (
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at))), 0)
    FROM dubbing_jobs 
    WHERE user_id = user_profiles.id AND status = 'completed'
  ),
  monthly_usage_minutes = (
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at))/60), 0)
    FROM dubbing_jobs 
    WHERE user_id = user_profiles.id 
      AND status = 'completed'
      AND created_at >= date_trunc('month', CURRENT_DATE)
  )
WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
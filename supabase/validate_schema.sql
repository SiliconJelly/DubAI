-- Schema Validation Script for DubAI Database
-- Run this script to validate that all tables, indexes, and functions are properly created

-- Check if all required tables exist
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
    required_tables TEXT[] := ARRAY[
        'user_profiles',
        'storage_files', 
        'dubbing_jobs',
        'processing_metrics',
        'job_queue',
        'system_settings',
        'user_sessions'
    ];
BEGIN
    FOREACH table_name IN ARRAY required_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = table_name
        ) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing required tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All required tables exist ✓';
    END IF;
END $$;

-- Check if RLS is enabled on all tables
DO $$
DECLARE
    table_name TEXT;
    rls_enabled BOOLEAN;
    tables_without_rls TEXT[] := ARRAY[]::TEXT[];
    required_tables TEXT[] := ARRAY[
        'user_profiles',
        'storage_files', 
        'dubbing_jobs',
        'processing_metrics',
        'job_queue',
        'user_sessions',
        'system_settings'
    ];
BEGIN
    FOREACH table_name IN ARRAY required_tables
    LOOP
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = table_name;
        
        IF NOT COALESCE(rls_enabled, false) THEN
            tables_without_rls := array_append(tables_without_rls, table_name);
        END IF;
    END LOOP;
    
    IF array_length(tables_without_rls, 1) > 0 THEN
        RAISE EXCEPTION 'RLS not enabled on tables: %', array_to_string(tables_without_rls, ', ');
    ELSE
        RAISE NOTICE 'RLS enabled on all required tables ✓';
    END IF;
END $$;

-- Check if required functions exist
DO $$
DECLARE
    missing_functions TEXT[] := ARRAY[]::TEXT[];
    function_name TEXT;
    required_functions TEXT[] := ARRAY[
        'update_updated_at_column',
        'handle_new_user',
        'update_job_progress',
        'get_user_monthly_usage',
        'enqueue_job',
        'cleanup_expired_files',
        'get_processing_costs',
        'update_user_stats',
        'get_system_health'
    ];
BEGIN
    FOREACH function_name IN ARRAY required_functions
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' AND routine_name = function_name
        ) THEN
            missing_functions := array_append(missing_functions, function_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_functions, 1) > 0 THEN
        RAISE EXCEPTION 'Missing required functions: %', array_to_string(missing_functions, ', ');
    ELSE
        RAISE NOTICE 'All required functions exist ✓';
    END IF;
END $$;

-- Check if required indexes exist
DO $$
DECLARE
    missing_indexes TEXT[] := ARRAY[]::TEXT[];
    index_name TEXT;
    critical_indexes TEXT[] := ARRAY[
        'idx_dubbing_jobs_user_id',
        'idx_dubbing_jobs_status',
        'idx_storage_files_user_id',
        'idx_processing_metrics_job_id',
        'idx_job_queue_job_id',
        'idx_user_sessions_user_id'
    ];
BEGIN
    FOREACH index_name IN ARRAY critical_indexes
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' AND indexname = index_name
        ) THEN
            missing_indexes := array_append(missing_indexes, index_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE EXCEPTION 'Missing critical indexes: %', array_to_string(missing_indexes, ', ');
    ELSE
        RAISE NOTICE 'All critical indexes exist ✓';
    END IF;
END $$;

-- Check if required triggers exist
DO $$
DECLARE
    missing_triggers TEXT[] := ARRAY[]::TEXT[];
    trigger_info RECORD;
    required_triggers TEXT[] := ARRAY[
        'update_user_profiles_updated_at',
        'update_dubbing_jobs_updated_at',
        'on_auth_user_created',
        'job_status_change_trigger',
        'processing_metrics_change_trigger'
    ];
BEGIN
    FOR trigger_info IN 
        SELECT unnest(required_triggers) as trigger_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_schema = 'public' AND trigger_name = trigger_info.trigger_name
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_schema = 'auth' AND trigger_name = trigger_info.trigger_name
        ) THEN
            missing_triggers := array_append(missing_triggers, trigger_info.trigger_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_triggers, 1) > 0 THEN
        RAISE WARNING 'Missing triggers (may be expected): %', array_to_string(missing_triggers, ', ');
    ELSE
        RAISE NOTICE 'All expected triggers exist ✓';
    END IF;
END $$;

-- Test basic functionality
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Test system health function
    SELECT * INTO test_result FROM get_system_health() LIMIT 1;
    RAISE NOTICE 'System health function working ✓';
    
    -- Test cleanup function
    PERFORM cleanup_expired_files();
    RAISE NOTICE 'Cleanup function working ✓';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Function test failed: %', SQLERRM;
END $$;

-- Display schema summary
SELECT 
    'Tables' as object_type,
    count(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public'

UNION ALL

SELECT 
    'Functions' as object_type,
    count(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public'

UNION ALL

SELECT 
    'Indexes' as object_type,
    count(*) as count
FROM pg_indexes 
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'Triggers' as object_type,
    count(*) as count
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Final validation message
DO $$
BEGIN
    RAISE NOTICE '=== DubAI Database Schema Validation Complete ===';
    RAISE NOTICE 'Schema is ready for use! 🚀';
END $$;
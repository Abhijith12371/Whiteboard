-- ============================================================================
-- DIAGNOSTIC: Check what tables and policies exist
-- Run this to see what's currently in your database
-- ============================================================================

-- List all tables in the public schema
SELECT 
    table_name,
    table_type
FROM 
    information_schema.tables
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name;

-- List all custom types
SELECT 
    typname as type_name,
    typtype as type
FROM 
    pg_type
WHERE 
    typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND typtype = 'e'  -- enum types
ORDER BY 
    typname;

-- List all policies (if any tables exist)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM 
    pg_policies
WHERE 
    schemaname = 'public'
ORDER BY 
    tablename, policyname;

-- List all triggers
SELECT 
    trigger_name,
    event_object_table as table_name,
    event_manipulation as event
FROM 
    information_schema.triggers
WHERE 
    trigger_schema = 'public'
ORDER BY 
    event_object_table, trigger_name;

-- List all functions in public schema
SELECT 
    routine_name as function_name,
    routine_type as type
FROM 
    information_schema.routines
WHERE 
    routine_schema = 'public'
ORDER BY 
    routine_name;

-- ============================================================================
-- SIMPLE CLEANUP: Remove only what exists
-- Based on diagnostic results: only functions exist
-- ============================================================================

-- Drop the existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_board_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_board_owner(uuid, uuid) CASCADE;

-- That's it! No tables or policies exist yet.
-- Now you can run supabase-schema-clean.sql

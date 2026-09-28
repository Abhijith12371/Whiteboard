-- ============================================================================
-- STEP 1: CLEANUP SCRIPT
-- Run this FIRST to remove any existing DigiBoard tables and policies
-- ============================================================================

-- Drop all policies first
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view their own boards" ON boards;
DROP POLICY IF EXISTS "Users can view their own boards or shared boards" ON boards;
DROP POLICY IF EXISTS "Users can insert their own boards" ON boards;
DROP POLICY IF EXISTS "Users can update their own boards" ON boards;
DROP POLICY IF EXISTS "Users can update their own boards or shared boards with edit permission" ON boards;
DROP POLICY IF EXISTS "Users can delete their own boards" ON boards;
DROP POLICY IF EXISTS "Users can view shared boards" ON boards;
DROP POLICY IF EXISTS "Users can edit shared boards with edit permission" ON boards;

DROP POLICY IF EXISTS "Users can view board members for boards they own or are members of" ON board_members;
DROP POLICY IF EXISTS "Board owners can manage board members" ON board_members;

DROP POLICY IF EXISTS "Board owners can manage shared links" ON shared_links;

DROP POLICY IF EXISTS "Users can view files for their boards" ON file_references;
DROP POLICY IF EXISTS "Users can insert files for their boards" ON file_references;
DROP POLICY IF EXISTS "Users can delete their own files" ON file_references;

-- Drop triggers
DROP TRIGGER IF EXISTS update_boards_updated_at ON boards;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop tables in reverse order (respect foreign keys)
DROP TABLE IF EXISTS file_references CASCADE;
DROP TABLE IF EXISTS shared_links CASCADE;
DROP TABLE IF EXISTS board_members CASCADE;
DROP TABLE IF EXISTS boards CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS permission_level CASCADE;

-- Note: We keep the uuid-ossp extension as it's commonly used

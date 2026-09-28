-- ============================================================================
-- COMPLETE POLICY RESET FOR BOARDS TABLE
-- This removes ALL policies and creates only the essential ones
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Drop ALL policies on boards (including any we might have missed)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'boards' AND schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON boards', r.policyname);
    END LOOP;
END $$;

-- Step 2: Verify RLS is enabled
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Step 3: Create ONLY basic ownership policies (no sharing for now)
CREATE POLICY "boards_select_own"
    ON boards FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "boards_insert_own"
    ON boards FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "boards_update_own"
    ON boards FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "boards_delete_own"
    ON boards FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- Step 4: Verify policies were created
SELECT 
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename = 'boards' 
ORDER BY policyname;

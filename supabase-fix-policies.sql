-- ============================================================================
-- FIX: Remove circular RLS policies and create clean ones
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Drop ALL existing policies on boards table
DROP POLICY IF EXISTS "Users can view their own boards" ON boards;
DROP POLICY IF EXISTS "Users can view their own boards or shared boards" ON boards;
DROP POLICY IF EXISTS "Users can insert their own boards" ON boards;
DROP POLICY IF EXISTS "Users can update their own boards" ON boards;
DROP POLICY IF EXISTS "Users can update their own boards or shared boards with edit permission" ON boards;
DROP POLICY IF EXISTS "Users can delete their own boards" ON boards;
DROP POLICY IF EXISTS "Users can view shared boards" ON boards;
DROP POLICY IF EXISTS "Users can edit shared boards with edit permission" ON boards;

-- Create clean, non-recursive policies
CREATE POLICY "Users can view own boards"
    ON boards FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own boards"
    ON boards FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own boards"
    ON boards FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own boards"
    ON boards FOR DELETE
    USING (auth.uid() = owner_id);

-- Simple policy for viewing shared boards (without recursion)
CREATE POLICY "Users can view shared boards"
    ON boards FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM board_members 
            WHERE board_members.board_id = boards.id 
            AND board_members.user_id = auth.uid()
        )
    );

-- Simple policy for editing shared boards (without recursion)
CREATE POLICY "Users can update shared boards"
    ON boards FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM board_members 
            WHERE board_members.board_id = boards.id 
            AND board_members.user_id = auth.uid()
            AND board_members.permission IN ('edit', 'admin')
        )
    );

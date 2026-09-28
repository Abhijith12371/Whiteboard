-- DigiBoard Supabase Database Schema
-- Run these SQL commands in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- BOARDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_synced BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS boards_owner_id_idx ON boards(owner_id);
CREATE INDEX IF NOT EXISTS boards_updated_at_idx ON boards(updated_at DESC);

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Basic policies for boards (will add more after board_members table)
CREATE POLICY "Users can view their own boards"
    ON boards FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own boards"
    ON boards FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own boards"
    ON boards FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own boards"
    ON boards FOR DELETE
    USING (auth.uid() = owner_id);

-- ============================================================================
-- BOARD_MEMBERS TABLE (for sharing)
-- ============================================================================
CREATE TYPE permission_level AS ENUM ('view', 'edit', 'admin');

CREATE TABLE IF NOT EXISTS board_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    permission permission_level NOT NULL DEFAULT 'view',
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(board_id, user_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS board_members_board_id_idx ON board_members(board_id);
CREATE INDEX IF NOT EXISTS board_members_user_id_idx ON board_members(user_id);

-- Enable RLS
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

-- Policies for board_members
CREATE POLICY "Users can view board members for boards they own or are members of"
    ON board_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM boards WHERE boards.id = board_members.board_id AND boards.owner_id = auth.uid()
        ) OR user_id = auth.uid()
    );

CREATE POLICY "Board owners can manage board members"
    ON board_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM boards WHERE boards.id = board_members.board_id AND boards.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- ADDITIONAL BOARD POLICIES (for sharing)
-- ============================================================================
-- Drop the basic update policy and recreate with sharing support
DROP POLICY IF EXISTS "Users can update their own boards" ON boards;
DROP POLICY IF EXISTS "Users can view their own boards" ON boards;

-- Recreate with sharing support
CREATE POLICY "Users can view their own boards or shared boards"
    ON boards FOR SELECT
    USING (
        auth.uid() = owner_id OR
        EXISTS (
            SELECT 1 FROM board_members 
            WHERE board_members.board_id = boards.id 
            AND board_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own boards or shared boards with edit permission"
    ON boards FOR UPDATE
    USING (
        auth.uid() = owner_id OR
        EXISTS (
            SELECT 1 FROM board_members 
            WHERE board_members.board_id = boards.id 
            AND board_members.user_id = auth.uid()
            AND board_members.permission IN ('edit', 'admin')
        )
    );

-- ============================================================================
-- SHARED_LINKS TABLE (for public sharing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shared_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    permission permission_level NOT NULL DEFAULT 'view',
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0
);

-- Create index
CREATE INDEX IF NOT EXISTS shared_links_token_idx ON shared_links(token);
CREATE INDEX IF NOT EXISTS shared_links_board_id_idx ON shared_links(board_id);

-- Enable RLS
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

-- Policies for shared_links
CREATE POLICY "Board owners can manage shared links"
    ON shared_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM boards WHERE boards.id = shared_links.board_id AND boards.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- FILE_REFERENCES TABLE (for R2 storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    file_key TEXT NOT NULL, -- R2 object key
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_url TEXT, -- R2 public URL or signed URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS file_references_board_id_idx ON file_references(board_id);
CREATE INDEX IF NOT EXISTS file_references_owner_id_idx ON file_references(owner_id);

-- Enable RLS
ALTER TABLE file_references ENABLE ROW LEVEL SECURITY;

-- Policies for file_references
CREATE POLICY "Users can view files for their boards"
    ON file_references FOR SELECT
    USING (
        auth.uid() = owner_id OR
        EXISTS (
            SELECT 1 FROM boards WHERE boards.id = file_references.board_id AND boards.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM board_members 
            WHERE board_members.board_id = file_references.board_id 
            AND board_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert files for their boards"
    ON file_references FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own files"
    ON file_references FOR DELETE
    USING (auth.uid() = owner_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for boards table
DROP TRIGGER IF EXISTS update_boards_updated_at ON boards;
CREATE TRIGGER update_boards_updated_at
    BEFORE UPDATE ON boards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STORAGE BUCKET (for Supabase Storage alternative to R2)
-- ============================================================================
-- If using Supabase Storage instead of Cloudflare R2, uncomment below:

-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('board-assets', 'board-assets', false)
-- ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY "Users can upload files to their own folder"
--     ON storage.objects FOR INSERT
--     WITH CHECK (
--         bucket_id = 'board-assets' AND
--         (storage.foldername(name))[1] = auth.uid()::text
--     );

-- CREATE POLICY "Users can view their own files"
--     ON storage.objects FOR SELECT
--     USING (
--         bucket_id = 'board-assets' AND
--         (storage.foldername(name))[1] = auth.uid()::text
--     );

-- CREATE POLICY "Users can delete their own files"
--     ON storage.objects FOR DELETE
--     USING (
--         bucket_id = 'board-assets' AND
--         (storage.foldername(name))[1] = auth.uid()::text
--     );


-- ============================================================================
-- SHARED_LINKS TABLE (for public sharing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shared_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    permission permission_level NOT NULL DEFAULT 'view',
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0
);

-- Create index
CREATE INDEX IF NOT EXISTS shared_links_token_idx ON shared_links(token);
CREATE INDEX IF NOT EXISTS shared_links_board_id_idx ON shared_links(board_id);

-- Enable RLS
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

-- Policies for shared_links
CREATE POLICY "Board owners can manage shared links"
    ON shared_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM boards WHERE boards.id = shared_links.board_id AND boards.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- FILE_REFERENCES TABLE (for R2 storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    file_key TEXT NOT NULL, -- R2 object key
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_url TEXT, -- R2 public URL or signed URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS file_references_board_id_idx ON file_references(board_id);
CREATE INDEX IF NOT EXISTS file_references_owner_id_idx ON file_references(owner_id);

-- Enable RLS
ALTER TABLE file_references ENABLE ROW LEVEL SECURITY;

-- Policies for file_references
CREATE POLICY "Users can view files for their boards"
    ON file_references FOR SELECT
    USING (
        auth.uid() = owner_id OR
        EXISTS (
            SELECT 1 FROM boards WHERE boards.id = file_references.board_id AND boards.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM board_members 
            WHERE board_members.board_id = file_references.board_id 
            AND board_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert files for their boards"
    ON file_references FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own files"
    ON file_references FOR DELETE
    USING (auth.uid() = owner_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for boards table
CREATE TRIGGER update_boards_updated_at
    BEFORE UPDATE ON boards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for profiles table
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STORAGE BUCKET (for Supabase Storage alternative to R2)
-- ============================================================================
-- If using Supabase Storage instead of Cloudflare R2:

-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('board-assets', 'board-assets', false);

-- CREATE POLICY "Users can upload files to their own folder"
--     ON storage.objects FOR INSERT
--     WITH CHECK (
--         bucket_id = 'board-assets' AND
--         (storage.foldername(name))[1] = auth.uid()::text
--     );

-- CREATE POLICY "Users can view their own files"
--     ON storage.objects FOR SELECT
--     USING (
--         bucket_id = 'board-assets' AND
--         (storage.foldername(name))[1] = auth.uid()::text
--     );

-- CREATE POLICY "Users can delete their own files"
--     ON storage.objects FOR DELETE
--     USING (
--         bucket_id = 'board-assets' AND
--         (storage.foldername(name))[1] = auth.uid()::text
--     );

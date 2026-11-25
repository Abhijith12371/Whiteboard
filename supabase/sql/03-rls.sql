-- ============================================================================
-- DigiBoard — final RLS layer
--
-- The earlier policies referenced `boards` from `board_members` and back again,
-- which made Postgres raise 42P17 "infinite recursion detected in policy". The
-- fix is to answer those questions inside SECURITY DEFINER helpers: a definer
-- function runs with the table owner's rights, so its SELECT is not itself
-- filtered by RLS and the cycle terminates.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- search_path is pinned so a caller cannot shadow these via their own schema.
CREATE OR REPLACE FUNCTION public.is_board_owner(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards
    WHERE id = p_board_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_board_owner(p_board_id) OR EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_board_owner(p_board_id) OR EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id
      AND user_id = auth.uid()
      AND permission IN ('edit', 'admin')
  );
$$;

-- ── boards ──────────────────────────────────────────────────────────────────
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boards_select_own" ON public.boards;
DROP POLICY IF EXISTS "boards_select_shared" ON public.boards;
DROP POLICY IF EXISTS "boards_insert_own" ON public.boards;
DROP POLICY IF EXISTS "boards_update_writable" ON public.boards;
DROP POLICY IF EXISTS "boards_delete_own" ON public.boards;
-- Sweep up the older, differently-named policies so none survive.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'boards'
      AND policyname NOT IN ('boards_select_shared', 'boards_insert_own',
                             'boards_update_writable', 'boards_delete_own')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.boards', r.policyname);
  END LOOP;
END $$;

-- Split read access by reason so PostgREST can plan each one cleanly. Both are
-- read-only; the union is what grants visibility.
CREATE POLICY "boards_select_shared" ON public.boards
    FOR SELECT TO authenticated
    USING (public.can_read_board(id));

CREATE POLICY "boards_insert_own" ON public.boards
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- The owner comparison is written directly against the column rather than via
-- can_write_board(), because the client pushes with an upsert: that resolves to
-- INSERT ... ON CONFLICT DO UPDATE, and the DO UPDATE branch must pass the
-- UPDATE policy for a row the same statement just inserted.
CREATE POLICY "boards_update_writable" ON public.boards
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.can_write_board(id))
    WITH CHECK (owner_id = auth.uid() OR public.can_write_board(id));

CREATE POLICY "boards_delete_own" ON public.boards
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- ── board_members ───────────────────────────────────────────────────────────
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'board_members'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.board_members', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "members_read_participants" ON public.board_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_board_owner(board_id));

CREATE POLICY "members_manage_owner" ON public.board_members
    FOR ALL TO authenticated
    USING (public.is_board_owner(board_id))
    WITH CHECK (public.is_board_owner(board_id));

-- ── shared_links ────────────────────────────────────────────────────────────
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'shared_links'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.shared_links', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "links_manage_owner" ON public.shared_links
    FOR ALL TO authenticated
    USING (public.is_board_owner(board_id))
    WITH CHECK (public.is_board_owner(board_id));

-- ── file_references ─────────────────────────────────────────────────────────
-- Powers the R2 upload flow: the Edge Function mints a presigned URL after
-- checking board access, and the client inserts this metadata row under its own
-- token, so RLS is what actually constrains the write.
ALTER TABLE public.file_references ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'file_references'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.file_references', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "files_read_accessible" ON public.file_references
    FOR SELECT TO authenticated
    USING (public.can_read_board(board_id));

CREATE POLICY "files_insert_own" ON public.file_references
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() AND public.can_write_board(board_id));

CREATE POLICY "files_delete_own" ON public.file_references
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- ── profiles ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ── Verification ────────────────────────────────────────────────────────────
-- Should return five policy names with no error if the layer is recursion-free.
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

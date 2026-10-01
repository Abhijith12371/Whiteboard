-- ============================================================================
-- DigiBoard — board sharing
--
-- Applies only the sharing surface, on top of supabase-schema-clean.sql.
-- Idempotent: safe to re-run.
--
-- The whole point of the SECURITY DEFINER helpers is to answer "can this user
-- read/write this board?" outside RLS's view. A policy that asked that question
-- by selecting from `boards` would recurse — Postgres raises 42P17, which is what
-- bit us earlier. A definer function runs with the owner's rights, so its own
-- SELECT is not RLS-filtered and the cycle terminates.
--
-- NOTE: this script assumes the service-role key is used to redeem a share link
-- (see supabase/functions/share-redeem). A recipient cannot insert their own
-- board_members row, because doing so would let any signed-in user grant
-- themselves access to any board id they could guess.
-- ============================================================================

-- ── Types ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_level') THEN
    CREATE TYPE permission_level AS ENUM ('view', 'edit', 'admin');
  END IF;
END $$;

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.board_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission permission_level NOT NULL DEFAULT 'view',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.shared_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  permission permission_level NOT NULL DEFAULT 'view',
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_count INTEGER NOT NULL DEFAULT 0
);

-- The token is a bearer credential, so it must be unique and cheap to look up.
CREATE UNIQUE INDEX IF NOT EXISTS shared_links_token_key ON public.shared_links (token);
CREATE INDEX IF NOT EXISTS shared_links_board_idx ON public.shared_links (board_id);
CREATE INDEX IF NOT EXISTS board_members_board_idx ON public.board_members (board_id);
CREATE INDEX IF NOT EXISTS board_members_user_idx ON public.board_members (user_id);

-- uuid-ossp is used by the DEFAULT above; Supabase usually has it already.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- search_path is pinned so a caller cannot shadow these via their own schema.
CREATE OR REPLACE FUNCTION public.is_board_owner(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards WHERE id = p_board_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_board_owner(p_board_id) OR EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_board_owner(p_board_id) OR EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id
      AND user_id = auth.uid()
      AND permission IN ('edit', 'admin')
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- Clear any older policies on these three tables, whatever they were named.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('boards', 'board_members', 'shared_links')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Owner writes the board. A member never may, so ownership cannot be edited.
CREATE POLICY boards_insert_own ON public.boards
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Read: the owner, or anyone with a member row. Shared boards have to be
-- readable, which is what the old ownership-only policy blocked.
--
-- The owner test is written directly against the column rather than folded into
-- can_read_board(), and that ordering matters. The client pushes with
-- `upsert()`, which sends `Prefer: resolution=merge-duplicates`; PostgREST then
-- returns the affected row, and that RETURNING clause is checked against this
-- SELECT policy. A SECURITY DEFINER helper cannot see the row being inserted in
-- the same statement, so an owner-only check written that way returns 403 for
-- the user's own board. Comparing owner_id directly evaluates against the new
-- row, so it passes, and the helper is consulted only for genuinely shared
-- boards.
CREATE POLICY boards_read_shared ON public.boards
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_read_board(id));

-- Update: owner, or a member with edit/admin.
CREATE POLICY boards_update_shared ON public.boards
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.can_write_board(id))
  WITH CHECK (owner_id = auth.uid() OR public.can_write_board(id));

CREATE POLICY boards_delete_own ON public.boards
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Members can see their own membership and the owner's list of who has access,
-- so the Share dialog can render. Nothing else is readable.
CREATE POLICY members_read_participants ON public.board_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_board_owner(board_id));

-- Only the owner curates membership. Redemption goes through the Edge Function,
-- which uses the service role and therefore bypasses this on purpose.
CREATE POLICY members_manage_owner ON public.board_members
  FOR ALL TO authenticated
  USING (public.is_board_owner(board_id))
  WITH CHECK (public.is_board_owner(board_id));

-- A link's token is a secret: only the owner may list or read them. There is
-- deliberately no policy letting anyone read a shared_links row by token — the
-- Edge Function validates the token with the service role instead.
CREATE POLICY links_manage_owner ON public.shared_links
  FOR ALL TO authenticated
  USING (public.is_board_owner(board_id))
  WITH CHECK (public.is_board_owner(board_id));

-- ── Ownership guard ─────────────────────────────────────────────────────────
-- Without this, an editor's UPDATE could set owner_id to themselves and take
-- ownership of someone else's board. The WITH CHECK above would still pass,
-- because the editor is allowed to write the row. This trigger makes owner_id
-- immutable once set.
CREATE OR REPLACE FUNCTION public.freeze_board_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'board owner cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boards_freeze_owner ON public.boards;
CREATE TRIGGER boards_freeze_owner
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.freeze_board_owner();

-- ── Verification ────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('boards', 'board_members', 'shared_links')
ORDER BY tablename, policyname;

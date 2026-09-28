-- Drop the recursive policies
drop policy if exists "Users can view members of boards they have access to." on board_members;
drop policy if exists "Board owners can manage members." on board_members;

-- Create a helper function that bypasses RLS to check if a user is the owner of a board
create or replace function public.is_board_owner(board_uuid uuid, user_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from boards where id = board_uuid and user_id = user_uuid
  );
$$;

-- Create a helper function that bypasses RLS to check if a user is a member of a board
create or replace function public.is_board_member(board_uuid uuid, user_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from board_members where board_id = board_uuid and user_id = user_uuid
  );
$$;

-- Recreate policies using the helper functions to completely avoid RLS recursion
create policy "Users can view members of boards they have access to." on board_members
  for select using (
    user_id = auth.uid() 
    or public.is_board_owner(board_id, auth.uid())
    or public.is_board_member(board_id, auth.uid())
  );

create policy "Board owners can manage members." on board_members
  for all using (
    public.is_board_owner(board_id, auth.uid())
  );

-- We also need to fix the boards table policies to use the helper to be safe
drop policy if exists "Users can read boards they are members of." on boards;
drop policy if exists "Editors can update boards." on boards;

create policy "Users can read boards they are members of." on boards 
  for select using (
    public.is_board_member(id, auth.uid())
  );

create policy "Editors can update boards." on boards 
  for update using (
    exists (
      select 1 from board_members 
      where board_members.board_id = boards.id 
      and board_members.user_id = auth.uid()
      and board_members.permission = 'editor'
    )
  );

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles enable row level security;
create policy "Users can view their own profile." on profiles for select using (auth.uid() = id);
create policy "Users can update their own profile." on profiles for update using (auth.uid() = id);

-- Subjects table
create table subjects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table subjects enable row level security;
create policy "Users can manage their own subjects." on subjects for all using (auth.uid() = user_id);

-- Folders table
create table folders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  subject_id uuid references subjects(id) on delete cascade,
  parent_folder_id uuid references folders(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table folders enable row level security;
create policy "Users can manage their own folders." on folders for all using (auth.uid() = user_id);

-- Boards table
create table boards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  subject_id uuid references subjects(id) on delete set null,
  folder_id uuid references folders(id) on delete set null,
  name text not null,
  description text,
  canvas_data jsonb default '{}'::jsonb not null,
  thumbnail_url text,
  version integer default 1 not null,
  last_synced_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table boards enable row level security;

-- Board members table for sharing
create table board_members (
  id uuid default uuid_generate_v4() primary key,
  board_id uuid references boards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  permission text not null check (permission in ('viewer', 'editor')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(board_id, user_id)
);

alter table board_members enable row level security;

-- Shared links table
create table shared_links (
  id uuid default uuid_generate_v4() primary key,
  board_id uuid references boards(id) on delete cascade not null,
  token text unique not null,
  permission text not null check (permission in ('viewer', 'editor')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone
);

alter table shared_links enable row level security;

-- Board RLS Policies
create policy "Users can manage their own boards." on boards 
  for all using (auth.uid() = user_id);

create policy "Users can read boards they are members of." on boards 
  for select using (
    exists (
      select 1 from board_members 
      where board_members.board_id = boards.id 
      and board_members.user_id = auth.uid()
    )
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

-- Board Members RLS Policies
create policy "Users can view members of boards they have access to." on board_members
  for select using (
    exists (
      select 1 from boards 
      where boards.id = board_members.board_id 
      and (boards.user_id = auth.uid() or exists (
        select 1 from board_members bm where bm.board_id = boards.id and bm.user_id = auth.uid()
      ))
    )
  );

create policy "Board owners can manage members." on board_members
  for all using (
    exists (
      select 1 from boards 
      where boards.id = board_members.board_id 
      and boards.user_id = auth.uid()
    )
  );

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Supabase Storage bucket for assets
insert into storage.buckets (id, name, public) values ('board-assets', 'board-assets', false);

create policy "Users can upload their own assets." on storage.objects
  for insert with check (bucket_id = 'board-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read their own assets." on storage.objects
  for select using (bucket_id = 'board-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own assets." on storage.objects
  for delete using (bucket_id = 'board-assets' and (storage.foldername(name))[1] = auth.uid()::text);

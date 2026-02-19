-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends auth.users)
create table public.users (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notes table
create table public.notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text,
  content text,
  summary text,
  image_url text,
  is_pinned boolean default false,
  is_archived boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tags table
create table public.tags (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(name)
);

-- Note Tags junction table
create table public.note_tags (
  note_id uuid references public.notes(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (note_id, tag_id)
);

-- Row Level Security (RLS)

-- 1. Enable RLS
alter table public.users enable row level security;
alter table public.notes enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;

-- 2. Policies

-- Users: Can view and update their own profile
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on public.users
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Notes: CRUD own notes
create policy "Users can view own notes" on public.notes
  for select using (auth.uid() = user_id);

create policy "Users can insert own notes" on public.notes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own notes" on public.notes
  for update using (auth.uid() = user_id);

create policy "Users can delete own notes" on public.notes
  for delete using (auth.uid() = user_id);

-- Tags: Everyone can view tags (shared taxonomy or per user? Assuming shared for now for simplicity, but usually per user)
-- Let's make tags per user for privacy? Or global?
-- Re-reading prompt: "users only see their own notes".
-- It doesn't strictly say tags are private, but it's safer.
-- Actually, let's keep tags simple: if a note has a tag, the user can see it.

create policy "Users can view tags linked to their notes" on public.tags
  for select using (
    exists (
      select 1 from public.note_tags nt
      join public.notes n on nt.note_id = n.id
      where nt.tag_id = tags.id and n.user_id = auth.uid()
    )
  );
  
create policy "Users can insert tags" on public.tags
  for insert with check (true); -- Allow anyone to create tags for now

-- Note Tags: Access via Note ownership
create policy "Users can view note_tags for their notes" on public.note_tags
  for select using (
    exists (
      select 1 from public.notes n
      where n.id = note_tags.note_id and n.user_id = auth.uid()
    )
  );

create policy "Users can insert note_tags for their notes" on public.note_tags
  for insert with check (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.user_id = auth.uid()
    )
  );

-- Realtime
alter publication supabase_realtime add table public.notes;

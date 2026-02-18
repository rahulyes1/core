-- Add table for bi-directional links
create table if not exists public.note_links (
  source_id uuid references public.notes(id) on delete cascade,
  target_id uuid references public.notes(id) on delete cascade,
  primary key (source_id, target_id)
);

-- Add new columns for unique features
alter table public.notes add column if not exists title text;
alter table public.notes add column if not exists image_url text;
alter table public.notes add column if not exists mood text;
alter table public.notes add column if not exists expires_at timestamp with time zone;
alter table public.notes add column if not exists locked_until timestamp with time zone;

-- Update RLS if needed (already covers update/insert for owner)

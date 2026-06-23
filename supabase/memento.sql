-- Run in Supabase → SQL Editor after creating a project.
-- Then create a Storage bucket named "memento-drawings" (private is fine).

create table if not exists public.memento_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  social_type text not null check (social_type in ('twitter', 'linkedin')),
  social_handle text not null,
  message text,
  drawing_path text not null,
  submitted_at timestamptz not null default now()
);

alter table public.memento_entries enable row level security;

-- Server-only access via service_role (used by /api/memento/submit).
revoke all on public.memento_entries from anon, authenticated;
grant all on public.memento_entries to service_role;

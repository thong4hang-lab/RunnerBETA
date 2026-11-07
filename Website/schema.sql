-- NQ Inducement database
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- ---------- Admins (who can upload videos) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

drop policy if exists "Users can see if they are admin" on public.admins;
create policy "Users can see if they are admin" on public.admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Videos ----------
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 120),
  description text check (char_length(description) <= 600),
  category text,
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table public.videos enable row level security;

drop policy if exists "Signed-in members can view videos" on public.videos;
create policy "Signed-in members can view videos" on public.videos
  for select to authenticated using (true);

drop policy if exists "Admins manage videos" on public.videos;
create policy "Admins manage videos" on public.videos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Private storage bucket for the video files
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

drop policy if exists "Members can watch videos" on storage.objects;
create policy "Members can watch videos" on storage.objects
  for select to authenticated using (bucket_id = 'videos');

drop policy if exists "Admins upload videos" on storage.objects;
create policy "Admins upload videos" on storage.objects
  for insert to authenticated with check (bucket_id = 'videos' and public.is_admin());

drop policy if exists "Admins delete videos" on storage.objects;
create policy "Admins delete videos" on storage.objects
  for delete to authenticated using (bucket_id = 'videos' and public.is_admin());

-- ---------- Trade journal (each member sees only their own) ----------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trade_date date not null,
  instrument text not null,
  direction text not null check (direction in ('long', 'short')),
  contracts integer not null default 1 check (contracts > 0),
  entry numeric not null,
  stop numeric not null,
  target numeric,
  exit_price numeric,
  setup text,
  chart_url text,
  reason text,
  emotion_before text,
  emotion_after text,
  followed_plan text check (followed_plan in ('yes', 'partly', 'no')),
  psychology text,
  lesson text,
  created_at timestamptz not null default now()
);
create index if not exists journal_entries_user_date on public.journal_entries (user_id, trade_date desc);
alter table public.journal_entries enable row level security;

drop policy if exists "Members manage their own journal" on public.journal_entries;
create policy "Members manage their own journal" on public.journal_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

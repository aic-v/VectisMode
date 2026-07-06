-- Vectis Law Command Center — initial schema
--
-- Apply via the Supabase SQL editor (paste the whole file) or `supabase db push`.
--
-- Model notes:
-- * `boards` holds the whole board as one JSONB document per workspace. Cards
--   are heavily interlinked (column order arrays, previous-column stashes), so
--   document sync is the pragmatic first step; splitting cards into rows can
--   come later without touching the ledger.
-- * `time_entries` is relational because it is the sensitive, reportable data
--   — per-row security and SQL aggregation are the point of the ledger.
-- * RLS is ENABLED on every table, with TEMPORARY permissive policies for the
--   pre-auth phase (the app connects with the publishable key only). When
--   Supabase Auth lands, replace the permissive policies with the auth-based
--   ones sketched at the bottom so sharing levels are enforced by the
--   database, not the client.

create extension if not exists moddatetime with schema extensions;

-- ── Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.boards (
  id         text primary key,
  state      jsonb not null,
  client_id  text,
  updated_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id           uuid primary key,
  member_id    text not null,
  card_id      text,
  matter_title text,
  client       text,
  category     text not null default 'client',
  date         date not null,
  hours        numeric(5, 2) not null check (hours > 0 and hours <= 24),
  narrative    text not null default '',
  billable     boolean not null default true,
  logged_at    timestamptz,
  billed_at    timestamptz,
  client_id    text,
  updated_at   timestamptz not null default now()
);

create index if not exists time_entries_member_date on public.time_entries (member_id, date);
create index if not exists time_entries_card on public.time_entries (card_id);

create table if not exists public.rates (
  id         text primary key,
  currency   text not null default '£',
  members    jsonb not null default '{}'::jsonb,
  clients    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.sharing_levels (
  member_id  text primary key,
  level      text not null check (level in ('full', 'totals', 'private')),
  updated_at timestamptz not null default now()
);

-- ── updated_at triggers ─────────────────────────────────────────────────────

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row execute procedure extensions.moddatetime(updated_at);

drop trigger if exists time_entries_set_updated_at on public.time_entries;
create trigger time_entries_set_updated_at
  before update on public.time_entries
  for each row execute procedure extensions.moddatetime(updated_at);

drop trigger if exists rates_set_updated_at on public.rates;
create trigger rates_set_updated_at
  before update on public.rates
  for each row execute procedure extensions.moddatetime(updated_at);

drop trigger if exists sharing_levels_set_updated_at on public.sharing_levels;
create trigger sharing_levels_set_updated_at
  before update on public.sharing_levels
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── Row-Level Security ──────────────────────────────────────────────────────
-- TEMPORARY pre-auth policies: the app has no user accounts yet, so the
-- publishable (anon) role gets full access. Sharing levels remain a client-side
-- contract until auth ships. Do NOT keep these once Auth is enabled.

alter table public.boards         enable row level security;
alter table public.time_entries   enable row level security;
alter table public.rates          enable row level security;
alter table public.sharing_levels enable row level security;

drop policy if exists "pre-auth full access" on public.boards;
create policy "pre-auth full access" on public.boards
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "pre-auth full access" on public.time_entries;
create policy "pre-auth full access" on public.time_entries
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "pre-auth full access" on public.rates;
create policy "pre-auth full access" on public.rates
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "pre-auth full access" on public.sharing_levels;
create policy "pre-auth full access" on public.sharing_levels
  for all to anon, authenticated using (true) with check (true);

-- ── Realtime ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.boards;
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.rates;
alter publication supabase_realtime add table public.sharing_levels;

-- ── Auth-phase policy sketch (do not run yet) ───────────────────────────────
-- Once members map to auth users (add `user_id uuid references auth.users` to
-- a members table), the consent model becomes database-enforced, e.g.:
--
--   create policy "read own entries" on public.time_entries
--     for select to authenticated
--     using (member_user_id() = user_id_of(member_id));
--
--   create policy "read shared entries" on public.time_entries
--     for select to authenticated
--     using (
--       coalesce((select level from public.sharing_levels s
--                  where s.member_id = time_entries.member_id), 'full') = 'full'
--     );
--
-- plus a security-definer view exposing daily totals for 'totals' members,
-- and write policies restricted to the entry's owner.

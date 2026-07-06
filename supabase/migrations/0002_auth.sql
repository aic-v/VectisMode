-- Vectis Law Command Center — auth phase
--
-- Apply AFTER 0001_init.sql, via the Supabase SQL editor (paste the whole
-- file) or `supabase db push`. This migration:
--   1. adds a `members` table mapping Google Workspace emails to board slots,
--   2. adds SECURITY DEFINER helpers that resolve the caller's member/role,
--   3. replaces the temporary "pre-auth full access" policies from 0001 with
--      real, auth-based Row-Level Security so the sharing tiers
--      (full / totals / private) are enforced by the database, not the client.
--
-- After this runs, the publishable (anon) role can no longer read or write any
-- table — every request must carry a logged-in Supabase Auth session.

-- ── Members roster ───────────────────────────────────────────────────────
-- One row per board slot. `id` matches the board column keys the app already
-- uses (user-1 .. user-4 — see board.js, TEAM_MEMBERS). A login is authorised
-- only if its email appears here; unknown emails resolve to no member and are
-- denied by every policy below.
--
-- >>> EDIT THE EMAILS before running: put each person's real Google Workspace
-- >>> address in. Exactly one row should have role 'manager' (the Founder, who
-- >>> may view-as other members); the rest are 'member'.

create table if not exists public.members (
  id         text primary key,
  email      text not null,
  name       text not null,
  role       text not null default 'member' check (role in ('manager', 'member')),
  user_id    uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness on email so lookups by the JWT email are exact.
create unique index if not exists members_email_lower on public.members (lower(email));

insert into public.members (id, email, name, role) values
  ('user-1', 'aadil@vectis.law',   'Partner A',   'manager'),
  ('user-2', 'member2@vectis.law', 'Partner B',   'member'),
  ('user-3', 'member3@vectis.law', 'Associate 1', 'member'),
  ('user-4', 'member4@vectis.law', 'Associate 2', 'member')
on conflict (id) do update
  set email = excluded.email,
      name  = excluded.name,
      role  = excluded.role;

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── Caller-identity helpers ──────────────────────────────────────────────
-- SECURITY DEFINER so they read `members` without triggering that table's own
-- RLS — this is what keeps the members policies below from recursing.

create or replace function public.current_member_id()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select id
  from public.members
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1
$$;

create or replace function public.is_manager()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where lower(email) = lower(auth.jwt() ->> 'email')
      and role = 'manager'
  )
$$;

-- Sharing level for a member, defaulting to 'full' (the firm's transparency
-- default) when none has been set. SECURITY DEFINER so the time_entries read
-- policy can consult it without a separate grant.
create or replace function public.share_level_for(target_member text)
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(
    (select level from public.sharing_levels where member_id = target_member),
    'full'
  )
$$;

-- ── Replace the pre-auth policies ────────────────────────────────────────
-- Drop the permissive 0001 policies; nothing is readable without a session
-- from here on.

drop policy if exists "pre-auth full access" on public.boards;
drop policy if exists "pre-auth full access" on public.time_entries;
drop policy if exists "pre-auth full access" on public.rates;
drop policy if exists "pre-auth full access" on public.sharing_levels;

alter table public.members enable row level security;

-- Members: you can always read your own row; a manager can read the whole
-- roster (needed to populate the view-as picker). Writes are manager-only.
drop policy if exists "read self or roster as manager" on public.members;
create policy "read self or roster as manager" on public.members
  for select to authenticated
  using (id = public.current_member_id() or public.is_manager());

drop policy if exists "manager manages roster" on public.members;
create policy "manager manages roster" on public.members
  for all to authenticated
  using (public.is_manager())
  with check (public.is_manager());

-- Board: a single shared firm document. Every authenticated member reads and
-- writes it (matter cards are firm-wide; personal privacy lives in the ledger).
drop policy if exists "authenticated read board" on public.boards;
create policy "authenticated read board" on public.boards
  for select to authenticated using (true);

drop policy if exists "authenticated write board" on public.boards;
create policy "authenticated write board" on public.boards
  for all to authenticated using (true) with check (true);

-- Time entries — the consent model, database-enforced:
--   * you always see your own entries;
--   * you see another member's detail only if their sharing level is 'full';
--   * 'totals' and 'private' members' rows are invisible at the detail level
--     (managers included — consent binds the org, not just peers).
-- Aggregate visibility for 'totals' members comes from the view at the bottom.
drop policy if exists "read own or full-shared entries" on public.time_entries;
create policy "read own or full-shared entries" on public.time_entries
  for select to authenticated
  using (
    member_id = public.current_member_id()
    or public.share_level_for(member_id) = 'full'
  );

-- Writes: you can always create/change/delete your own entries, whoever you
-- happen to be "viewing as" in the UI. A MANAGER may additionally administer
-- any entry — e.g. mark another member's billable time as billed for invoicing.
-- This does not widen what a manager can see: the read policy above still
-- bounds them to their own + 'full'-shared rows, so a manager can never reach a
-- 'private' or 'totals' member's detail entries to write them.
-- (`is_manager()` must appear in the INSERT check too, because an upsert of an
-- existing row is evaluated as INSERT ... ON CONFLICT DO UPDATE.)
drop policy if exists "insert own entries" on public.time_entries;
drop policy if exists "insert own or managed entries" on public.time_entries;
create policy "insert own or managed entries" on public.time_entries
  for insert to authenticated
  with check (member_id = public.current_member_id() or public.is_manager());

drop policy if exists "update own entries" on public.time_entries;
drop policy if exists "update own or managed entries" on public.time_entries;
create policy "update own or managed entries" on public.time_entries
  for update to authenticated
  using (member_id = public.current_member_id() or public.is_manager())
  with check (member_id = public.current_member_id() or public.is_manager());

drop policy if exists "delete own entries" on public.time_entries;
drop policy if exists "delete own or managed entries" on public.time_entries;
create policy "delete own or managed entries" on public.time_entries
  for delete to authenticated
  using (member_id = public.current_member_id() or public.is_manager());

-- Rates: readable by all (needed to price timesheets); writable by managers
-- only, since a rate change is a firm-level decision.
drop policy if exists "authenticated read rates" on public.rates;
create policy "authenticated read rates" on public.rates
  for select to authenticated using (true);

drop policy if exists "manager writes rates" on public.rates;
create policy "manager writes rates" on public.rates
  for all to authenticated
  using (public.is_manager())
  with check (public.is_manager());

-- Sharing levels: everyone can read (the UI needs to know each member's tier),
-- but you may only set your own — the tier is member-controlled by design.
drop policy if exists "authenticated read sharing" on public.sharing_levels;
create policy "authenticated read sharing" on public.sharing_levels
  for select to authenticated using (true);

drop policy if exists "write own sharing" on public.sharing_levels;
create policy "write own sharing" on public.sharing_levels
  for all to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

-- ── Totals view for 'totals'-tier members ────────────────────────────────
-- Detail rows for 'totals' members are hidden by the policy above, so expose
-- per-member / per-day aggregates through a SECURITY DEFINER view. This lets
-- the firm-wide timesheet show a totals-only member's hours without leaking
-- their narratives, clients, or matters. 'private' members are excluded
-- entirely; 'full' members are already visible in detail.
create or replace view public.time_entry_totals
  with (security_invoker = false) as
  select
    member_id,
    date,
    sum(hours)                                   as total_hours,
    sum(hours) filter (where billable)           as billable_hours
  from public.time_entries
  where public.share_level_for(member_id) = 'totals'
  group by member_id, date;

grant select on public.time_entry_totals to authenticated;

-- Realtime for the new table (0001 already published the others).
alter publication supabase_realtime add table public.members;

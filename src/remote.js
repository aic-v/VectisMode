// Supabase remote persistence. Entirely env-gated: without
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app runs in local-only mode
// (localStorage), which is also what every test environment uses.
//
// Sync model (v1, last-write-wins):
// * The board is one JSONB document per workspace (`boards.state`).
// * Time entries, rates, and sharing levels are relational rows.
// * Every write stamps CLIENT_ID so realtime echoes of our own board pushes
//   can be ignored; entry echoes are idempotent by id.
// All IO helpers swallow errors with a console.warn — remote failure must
// never break the local experience.

import { normalizeRates, normalizeTimeEntry } from './time.js';
import { isValidBoard } from './storage.js';
import { supabase, remoteEnabled } from './supabaseClient.js';

export { remoteEnabled };

export const WORKSPACE_ID = 'vectis';

export const CLIENT_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'local';

// ── Row mapping (pure, unit-tested) ─────────────────────────────────────────

export function entryToRow(entry) {
  return {
    id: entry.id,
    member_id: entry.memberId,
    card_id: entry.cardId,
    matter_title: entry.matterTitle,
    client: entry.client,
    category: entry.category,
    date: entry.date,
    hours: entry.hours,
    narrative: entry.narrative,
    billable: entry.billable,
    logged_at: entry.loggedAt,
    billed_at: entry.billedAt,
    client_id: CLIENT_ID,
  };
}

export function rowToEntry(row) {
  if (!row) return null;
  return normalizeTimeEntry({
    id: row.id,
    memberId: row.member_id,
    cardId: row.card_id,
    matterTitle: row.matter_title,
    client: row.client,
    category: row.category,
    date: row.date,
    hours: Number(row.hours),
    narrative: row.narrative,
    billable: row.billable,
    loggedAt: row.logged_at,
    billedAt: row.billed_at,
  });
}

// Minimal change-set between two ledger snapshots, so push effects only write
// what actually changed.
export function diffEntries(prev, next) {
  const prevById = new Map(prev.map((entry) => [entry.id, entry]));
  const nextIds = new Set(next.map((entry) => entry.id));
  const upserts = next.filter((entry) => {
    const before = prevById.get(entry.id);
    return !before || JSON.stringify(before) !== JSON.stringify(entry);
  });
  const deletes = prev.filter((entry) => !nextIds.has(entry.id)).map((entry) => entry.id);
  return { upserts, deletes };
}

// ── IO ──────────────────────────────────────────────────────────────────────

function warn(action, error) {
  console.warn(`[remote] ${action} failed:`, error?.message ?? error);
}

export async function fetchRemoteState() {
  if (!supabase) return null;
  try {
    const [board, entries, rates, sharing] = await Promise.all([
      supabase.from('boards').select('state').eq('id', WORKSPACE_ID).maybeSingle(),
      supabase.from('time_entries').select('*'),
      supabase.from('rates').select('*').eq('id', WORKSPACE_ID).maybeSingle(),
      supabase.from('sharing_levels').select('*'),
    ]);
    const firstError = board.error ?? entries.error ?? rates.error ?? sharing.error;
    if (firstError) throw firstError;
    return {
      board: board.data && isValidBoard(board.data.state) ? board.data.state : null,
      timeEntries: entries.data
        ? entries.data.map((row) => rowToEntry(row)).filter(Boolean)
        : null,
      rates: rates.data ? normalizeRates(rates.data) : null,
      sharing: sharing.data
        ? Object.fromEntries(sharing.data.map((row) => [row.member_id, row.level]))
        : null,
    };
  } catch (error) {
    warn('fetch', error);
    return null;
  }
}

export async function pushBoard(items) {
  if (!supabase) return;
  const { error } = await supabase
    .from('boards')
    .upsert({ id: WORKSPACE_ID, state: items, client_id: CLIENT_ID });
  if (error) warn('board push', error);
}

export async function pushTimeEntries(entries) {
  if (!supabase || entries.length === 0) return;
  const { error } = await supabase.from('time_entries').upsert(entries.map(entryToRow));
  if (error) warn('time-entry push', error);
}

export async function deleteTimeEntries(ids) {
  if (!supabase || ids.length === 0) return;
  const { error } = await supabase.from('time_entries').delete().in('id', ids);
  if (error) warn('time-entry delete', error);
}

export async function pushRates(rates) {
  if (!supabase) return;
  const { error } = await supabase.from('rates').upsert({
    id: WORKSPACE_ID,
    currency: rates.currency,
    members: rates.members,
    clients: rates.clients,
  });
  if (error) warn('rates push', error);
}

export async function pushSharing(sharing) {
  if (!supabase) return;
  const rows = Object.entries(sharing).map(([member_id, level]) => ({ member_id, level }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('sharing_levels').upsert(rows);
  if (error) warn('sharing push', error);
}

export function subscribeRemote({ onBoard, onEntryUpsert, onEntryDelete, onRates, onSharing }) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('vectis-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'boards' },
      (payload) => {
        const row = payload.new;
        if (
          row &&
          row.id === WORKSPACE_ID &&
          row.client_id !== CLIENT_ID &&
          isValidBoard(row.state)
        ) {
          onBoard(row.state);
        }
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'time_entries' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          if (payload.old?.id) onEntryDelete(payload.old.id);
          return;
        }
        const row = payload.new;
        if (row && row.client_id !== CLIENT_ID) {
          const entry = rowToEntry(row);
          if (entry) onEntryUpsert(entry);
        }
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rates' },
      (payload) => {
        if (payload.new?.id === WORKSPACE_ID) onRates(normalizeRates(payload.new));
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sharing_levels' },
      (payload) => {
        if (payload.new?.member_id) onSharing(payload.new.member_id, payload.new.level);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

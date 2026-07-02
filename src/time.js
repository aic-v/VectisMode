// Time ledger: the source of truth for logged time.
//
// Entries live in a flat, global list — not on cards — because a good chunk
// of firm time (business development, training, product work) has no matter
// card. Card work-logs feed this ledger; the ledger feeds productivity views
// and timesheets. Everything here is pure so it can be unit-tested and later
// moved server-side unchanged.

export const WORK_CATEGORIES = [
  { key: 'client', label: 'Client Work', billable: true },
  { key: 'bd', label: 'Business Development', billable: false },
  { key: 'research', label: 'Research & Writing', billable: false },
  { key: 'product', label: 'Product & Tech', billable: false },
  { key: 'training', label: 'Training', billable: false },
  { key: 'admin', label: 'Firm Administration', billable: false },
];

export const DEFAULT_CATEGORY = 'client';

export const SHARE_LEVELS = [
  { key: 'full', label: 'Full detail' },
  { key: 'totals', label: 'Totals only' },
  { key: 'private', label: 'Private' },
];

// Org-wide default agreed July 2026: transparent unless the member opts down.
export const DEFAULT_SHARE_LEVEL = 'full';

export function categoryMeta(key) {
  return WORK_CATEGORIES.find((c) => c.key === key) ?? null;
}

export function categoryLabel(key) {
  return categoryMeta(key)?.label ?? key ?? 'Uncategorised';
}

export function isoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns a validated entry or null. `id` and `loggedAt` are caller-supplied
// so this stays pure (the UI uses crypto.randomUUID / new Date, tests use
// fixed values).
export function normalizeTimeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const hours = Number(raw.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return null;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.memberId !== 'string' || !raw.memberId) return null;

  const date = typeof raw.date === 'string' && ISO_DATE_RE.test(raw.date) ? raw.date : null;
  if (!date) return null;

  const category = categoryMeta(raw.category) ? raw.category : DEFAULT_CATEGORY;
  const billable =
    typeof raw.billable === 'boolean' ? raw.billable : categoryMeta(category).billable;

  return {
    id: raw.id,
    memberId: raw.memberId,
    cardId: typeof raw.cardId === 'string' ? raw.cardId : null,
    matterTitle: typeof raw.matterTitle === 'string' ? raw.matterTitle : null,
    client: typeof raw.client === 'string' ? raw.client : null,
    category,
    date,
    hours: Math.round(hours * 100) / 100,
    narrative: typeof raw.narrative === 'string' ? raw.narrative.trim() : '',
    billable,
    loggedAt: typeof raw.loggedAt === 'string' ? raw.loggedAt : null,
  };
}

export function addTimeEntry(entries, entry) {
  const normalized = normalizeTimeEntry(entry);
  if (!normalized) return entries;
  return [...entries, normalized];
}

export function updateTimeEntry(entries, id, patch) {
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) return entries;
  const merged = normalizeTimeEntry({ ...entries[index], ...patch, id });
  if (!merged) return entries;
  const next = entries.slice();
  next[index] = merged;
  return next;
}

export function removeTimeEntry(entries, id) {
  const next = entries.filter((e) => e.id !== id);
  return next.length === entries.length ? entries : next;
}

export function filterEntries(entries, { memberId, cardId, client, from, to } = {}) {
  return entries.filter((entry) => {
    if (memberId && entry.memberId !== memberId) return false;
    if (cardId && entry.cardId !== cardId) return false;
    if (client && entry.client !== client) return false;
    if (from && entry.date < from) return false;
    if (to && entry.date > to) return false;
    return true;
  });
}

export function sumHours(entries) {
  return Math.round(entries.reduce((sum, e) => sum + e.hours, 0) * 100) / 100;
}

export function totalsBy(entries, keyFn) {
  const map = new Map();
  for (const entry of entries) {
    const key = keyFn(entry);
    map.set(key, Math.round(((map.get(key) ?? 0) + entry.hours) * 100) / 100);
  }
  return map;
}

export function billableSplit(entries) {
  const billable = sumHours(entries.filter((e) => e.billable));
  const total = sumHours(entries);
  return {
    billable,
    nonBillable: Math.round((total - billable) * 100) / 100,
    total,
    billablePct: total > 0 ? Math.round((billable / total) * 100) : 0,
  };
}

// Monday-first start of the week containing `date`.
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Seven day buckets for a member's week: [{ iso, total, byCategory }].
export function weekOverview(entries, { memberId, weekStart }) {
  const start = startOfWeek(weekStart);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const iso = isoDate(day);
    const dayEntries = filterEntries(entries, { memberId, from: iso, to: iso });
    const byCategory = {};
    for (const entry of dayEntries) {
      byCategory[entry.category] =
        Math.round(((byCategory[entry.category] ?? 0) + entry.hours) * 100) / 100;
    }
    days.push({ iso, total: sumHours(dayEntries), byCategory });
  }
  return days;
}

// Firm-level visibility: each member's share level decides what the rest of
// the organisation sees. 'full' exposes entries; 'totals' exposes only an
// aggregate line; 'private' exposes nothing but is counted so the UI can say
// "1 member private" rather than silently under-reporting.
export function applyShareLevels(entries, shareLevelFor) {
  const visible = [];
  const totalsOnly = new Map();
  let privateMembers = new Set();

  for (const entry of entries) {
    const level = shareLevelFor(entry.memberId) ?? DEFAULT_SHARE_LEVEL;
    if (level === 'full') {
      visible.push(entry);
    } else if (level === 'totals') {
      totalsOnly.set(
        entry.memberId,
        Math.round(((totalsOnly.get(entry.memberId) ?? 0) + entry.hours) * 100) / 100,
      );
    } else {
      privateMembers.add(entry.memberId);
    }
  }

  return {
    visible,
    totalsOnly: [...totalsOnly.entries()].map(([memberId, hours]) => ({ memberId, hours })),
    privateMemberCount: privateMembers.size,
  };
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Column names chosen to map 1:1 onto a Zoho Books timesheet/invoice import
// (Date, User, Client, Project/Matter, Notes, Hours, Billable Status) while
// staying a plain, neutral CSV.
export function entriesToCsv(entries, { memberName = (id) => id } = {}) {
  const header = ['Date', 'User', 'Client', 'Matter', 'Category', 'Notes', 'Hours', 'Billable Status'];
  const rows = [...entries]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((entry) => [
      entry.date,
      memberName(entry.memberId),
      entry.client ?? '',
      entry.matterTitle ?? '',
      categoryLabel(entry.category),
      entry.narrative,
      entry.hours.toFixed(2),
      entry.billable ? 'Billable' : 'Non-Billable',
    ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

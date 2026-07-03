import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CATEGORY,
  addTimeEntry,
  applyShareLevels,
  billableSplit,
  entriesToCsv,
  filterEntries,
  formatMoney,
  isoDate,
  markEntriesBilled,
  normalizeRates,
  normalizeTimeEntry,
  rateFor,
  removeTimeEntry,
  startOfWeek,
  sumHours,
  totalsBy,
  unloggedWeekdays,
  updateTimeEntry,
  valueOfEntries,
  weekOverview,
} from './time.js';

const base = {
  id: 't1',
  memberId: 'user-1',
  date: '2026-07-01',
  hours: 1.5,
  category: 'client',
  narrative: 'Reviewed cap',
  loggedAt: '2026-07-01T10:00:00.000Z',
};

const entry = (overrides) => normalizeTimeEntry({ ...base, ...overrides });

describe('normalizeTimeEntry', () => {
  it('accepts a valid entry and fills derived fields', () => {
    const e = normalizeTimeEntry(base);
    expect(e).toMatchObject({
      id: 't1',
      memberId: 'user-1',
      hours: 1.5,
      billable: true,
      cardId: null,
    });
  });

  it('defaults billable from the category', () => {
    expect(entry({ id: 'a', category: 'bd' }).billable).toBe(false);
    expect(entry({ id: 'b', category: 'client' }).billable).toBe(true);
    expect(entry({ id: 'c', category: 'bd', billable: true }).billable).toBe(true);
  });

  it('falls back to the default category for unknown keys', () => {
    expect(entry({ category: 'squash' }).category).toBe(DEFAULT_CATEGORY);
  });

  it('rejects missing or invalid hours, dates, ids, and members', () => {
    expect(normalizeTimeEntry({ ...base, hours: 0 })).toBeNull();
    expect(normalizeTimeEntry({ ...base, hours: 25 })).toBeNull();
    expect(normalizeTimeEntry({ ...base, hours: 'lots' })).toBeNull();
    expect(normalizeTimeEntry({ ...base, date: 'July 1' })).toBeNull();
    expect(normalizeTimeEntry({ ...base, id: undefined })).toBeNull();
    expect(normalizeTimeEntry({ ...base, memberId: undefined })).toBeNull();
    expect(normalizeTimeEntry(null)).toBeNull();
  });
});

describe('ledger operations', () => {
  it('addTimeEntry appends normalized entries and ignores invalid ones', () => {
    const list = addTimeEntry([], base);
    expect(list).toHaveLength(1);
    expect(addTimeEntry(list, { ...base, hours: -1 })).toBe(list);
  });

  it('updateTimeEntry merges a patch and re-validates', () => {
    const list = addTimeEntry([], base);
    const updated = updateTimeEntry(list, 't1', { hours: 2, billable: false });
    expect(updated[0]).toMatchObject({ hours: 2, billable: false });
    // An invalid patch leaves the ledger untouched.
    expect(updateTimeEntry(list, 't1', { hours: 0 })).toBe(list);
    expect(updateTimeEntry(list, 'missing', { hours: 2 })).toBe(list);
  });

  it('removeTimeEntry drops by id', () => {
    const list = addTimeEntry([], base);
    expect(removeTimeEntry(list, 't1')).toEqual([]);
    expect(removeTimeEntry(list, 'nope')).toBe(list);
  });
});

describe('selectors', () => {
  const ledger = [
    entry({ id: 'a', memberId: 'user-1', date: '2026-06-29', hours: 2, category: 'client', cardId: 'c1' }),
    entry({ id: 'b', memberId: 'user-1', date: '2026-06-30', hours: 1, category: 'bd' }),
    entry({ id: 'c', memberId: 'user-2', date: '2026-06-30', hours: 3, category: 'client', client: 'Acme Corp' }),
    entry({ id: 'd', memberId: 'user-1', date: '2026-07-06', hours: 4, category: 'research' }),
  ];

  it('filters by member, card, client, and range', () => {
    expect(filterEntries(ledger, { memberId: 'user-1' })).toHaveLength(3);
    expect(filterEntries(ledger, { cardId: 'c1' }).map((e) => e.id)).toEqual(['a']);
    expect(filterEntries(ledger, { client: 'Acme Corp' }).map((e) => e.id)).toEqual(['c']);
    expect(filterEntries(ledger, { from: '2026-06-30', to: '2026-06-30' })).toHaveLength(2);
  });

  it('sums and groups hours', () => {
    expect(sumHours(ledger)).toBe(10);
    const byCat = totalsBy(ledger, (e) => e.category);
    expect(byCat.get('client')).toBe(5);
    expect(byCat.get('bd')).toBe(1);
  });

  it('computes the billable split', () => {
    const split = billableSplit(ledger);
    expect(split).toMatchObject({ billable: 5, nonBillable: 5, total: 10, billablePct: 50 });
  });

  it('weekOverview buckets a member week from Monday', () => {
    // Week of Mon 2026-06-29 … Sun 2026-07-05: entries a (Mon) and b (Tue).
    const days = weekOverview(ledger, { memberId: 'user-1', weekStart: new Date('2026-07-01T12:00:00') });
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ iso: '2026-06-29', total: 2 });
    expect(days[1].byCategory).toEqual({ bd: 1 });
    expect(days[6].total).toBe(0);
  });

  it('startOfWeek is Monday-first', () => {
    expect(isoDate(startOfWeek(new Date('2026-07-05T09:00:00')))).toBe('2026-06-29'); // Sunday → prior Monday
    expect(isoDate(startOfWeek(new Date('2026-06-29T09:00:00')))).toBe('2026-06-29'); // Monday → itself
  });
});

describe('applyShareLevels', () => {
  const ledger = [
    entry({ id: 'a', memberId: 'user-1', hours: 2 }),
    entry({ id: 'b', memberId: 'user-2', hours: 3 }),
    entry({ id: 'c', memberId: 'user-2', hours: 1 }),
    entry({ id: 'd', memberId: 'user-3', hours: 5 }),
  ];
  const levels = { 'user-1': 'full', 'user-2': 'totals', 'user-3': 'private' };
  const shareLevelFor = (id) => levels[id];

  it('splits entries into visible, totals-only, and private', () => {
    const result = applyShareLevels(ledger, shareLevelFor);
    expect(result.visible.map((e) => e.id)).toEqual(['a']);
    expect(result.totalsOnly).toEqual([{ memberId: 'user-2', hours: 4 }]);
    expect(result.privateMemberCount).toBe(1);
  });

  it('treats unknown members as the default (full)', () => {
    const result = applyShareLevels(ledger, () => undefined);
    expect(result.visible).toHaveLength(4);
  });
});

describe('entriesToCsv', () => {
  it('produces Zoho-mappable columns sorted by date, with escaping', () => {
    const csv = entriesToCsv(
      [
        entry({ id: 'b', date: '2026-07-02', narrative: 'Call re: caps, "final"', client: 'Acme Corp', matterTitle: 'MSA' }),
        entry({ id: 'a', date: '2026-07-01', category: 'bd', narrative: 'Pitch deck' }),
      ],
      { memberName: () => 'Partner A' },
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Date,User,Client,Matter,Category,Notes,Hours,Billable Status,Rate,Amount,Billed At');
    expect(lines[1]).toBe('2026-07-01,Partner A,,,Business Development,Pitch deck,1.50,Non-Billable,,,');
    expect(lines[2]).toBe('2026-07-02,Partner A,Acme Corp,MSA,Client Work,"Call re: caps, ""final""",1.50,Billable,,,');
  });

  it('prices billable entries when rates are supplied and stamps billed dates', () => {
    const rates = normalizeRates({ currency: '£', members: { 'user-1': 200 }, clients: { 'Acme Corp': 300 } });
    const csv = entriesToCsv(
      [
        entry({ id: 'a', date: '2026-07-01', client: 'Acme Corp', hours: 2, billedAt: '2026-07-03T09:00:00.000Z' }),
        entry({ id: 'b', date: '2026-07-02', hours: 1 }),
        entry({ id: 'c', date: '2026-07-02', category: 'bd', hours: 1 }),
      ],
      { memberName: () => 'Partner A', rates },
    );
    const lines = csv.split('\n');
    expect(lines[1]).toContain('300.00,600.00,2026-07-03'); // client override wins
    expect(lines[2]).toContain('200.00,200.00,');           // member rate
    expect(lines[3]).toMatch(/Non-Billable,,,$/);           // non-billable never priced
  });
});

describe('billed state', () => {
  it('normalizeTimeEntry carries billedAt through', () => {
    expect(entry({ billedAt: '2026-07-03T09:00:00.000Z' }).billedAt).toBe('2026-07-03T09:00:00.000Z');
    expect(entry({}).billedAt).toBeNull();
  });

  it('markEntriesBilled stamps only the given unbilled entries', () => {
    const list = [
      entry({ id: 'a' }),
      entry({ id: 'b', billedAt: '2026-06-01T00:00:00.000Z' }),
      entry({ id: 'c' }),
    ];
    const next = markEntriesBilled(list, ['a', 'b'], { now: '2026-07-03T09:00:00.000Z' });
    expect(next[0].billedAt).toBe('2026-07-03T09:00:00.000Z');
    expect(next[1].billedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(next[2].billedAt).toBeNull();
    expect(markEntriesBilled(next, ['b'], { now: 'later' })).toBe(next);
  });

  it('updateTimeEntry can unmark a billed entry', () => {
    const list = [entry({ id: 'a', billedAt: '2026-06-01T00:00:00.000Z' })];
    expect(updateTimeEntry(list, 'a', { billedAt: null })[0].billedAt).toBeNull();
  });
});

describe('rates and value', () => {
  const rates = normalizeRates({ members: { 'user-1': 200 }, clients: { 'Acme Corp': 300 } });

  it('normalizeRates cleans junk and keeps positive numbers', () => {
    const cleaned = normalizeRates({ currency: '', members: { 'user-1': 200, 'user-2': -5, 'user-3': 'x' } });
    expect(cleaned.currency).toBe('£');
    expect(cleaned.members).toEqual({ 'user-1': 200 });
    expect(normalizeRates(null)).toEqual({ currency: '£', members: {}, clients: {} });
  });

  it('rateFor prefers the client override, then the member rate', () => {
    expect(rateFor(entry({ client: 'Acme Corp' }), rates)).toBe(300);
    expect(rateFor(entry({}), rates)).toBe(200);
    expect(rateFor(entry({ memberId: 'user-9' }), rates)).toBeNull();
  });

  it('valueOfEntries prices billable rated hours and surfaces unrated ones', () => {
    const value = valueOfEntries(
      [
        entry({ id: 'a', hours: 2, client: 'Acme Corp' }),          // 600
        entry({ id: 'b', hours: 1 }),                               // 200
        entry({ id: 'c', hours: 3, memberId: 'user-9' }),           // unrated
        entry({ id: 'd', hours: 4, category: 'bd' }),               // non-billable
      ],
      rates,
    );
    expect(value).toEqual({ amount: 800, ratedHours: 3, unratedHours: 3 });
  });

  it('formatMoney renders with thousands separators', () => {
    expect(formatMoney(1234.5)).toBe('£1,234.50');
    expect(formatMoney(800, '€')).toBe('€800.00');
  });
});

describe('unloggedWeekdays', () => {
  // Friday 2026-07-03; week is Mon 2026-06-29 … Fri 2026-07-03.
  const now = new Date('2026-07-03T10:00:00');

  it('lists weekdays before today with nothing logged', () => {
    const ledger = [
      entry({ id: 'a', date: '2026-06-29', memberId: 'user-1' }),
      entry({ id: 'b', date: '2026-07-01', memberId: 'user-1' }),
    ];
    expect(unloggedWeekdays(ledger, { memberId: 'user-1', now })).toEqual(['2026-06-30', '2026-07-02']);
  });

  it('is empty when every prior weekday has time', () => {
    const monday = new Date('2026-06-29T10:00:00');
    expect(unloggedWeekdays([], { memberId: 'user-1', now: monday })).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { CLIENT_ID, diffEntries, entryToRow, remoteEnabled, rowToEntry } from './remote.js';
import { normalizeTimeEntry } from './time.js';

const entry = (overrides = {}) =>
  normalizeTimeEntry({
    id: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    memberId: 'user-1',
    cardId: 'c1',
    matterTitle: 'MSA review',
    client: 'Acme Corp',
    category: 'client',
    date: '2026-07-01',
    hours: 1.5,
    narrative: 'Reviewed cap',
    loggedAt: '2026-07-01T10:00:00.000Z',
    billedAt: null,
    ...overrides,
  });

describe('remote module', () => {
  it('is disabled without env configuration', () => {
    expect(remoteEnabled).toBe(false);
  });

  it('round-trips an entry through row mapping', () => {
    const original = entry();
    const row = entryToRow(original);
    expect(row).toMatchObject({
      member_id: 'user-1',
      card_id: 'c1',
      matter_title: 'MSA review',
      billable: true,
      client_id: CLIENT_ID,
    });
    expect(rowToEntry(row)).toEqual(original);
  });

  it('rowToEntry coerces numeric strings and rejects junk rows', () => {
    const row = { ...entryToRow(entry()), hours: '2.50' };
    expect(rowToEntry(row).hours).toBe(2.5);
    expect(rowToEntry(null)).toBeNull();
    expect(rowToEntry({ id: 'x' })).toBeNull();
  });
});

describe('diffEntries', () => {
  const a = entry({ id: 'a3bb189e-8bf9-3888-9912-ace4e6543002' });
  const b = entry({ id: 'b4cc189e-8bf9-3888-9912-ace4e6543003', hours: 2 });

  it('reports nothing for identical snapshots', () => {
    const { upserts, deletes } = diffEntries([a, b], [a, b]);
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
  });

  it('reports additions, changes, and removals', () => {
    const changed = { ...b, hours: 3 };
    const c = entry({ id: 'c5dd189e-8bf9-3888-9912-ace4e6543004' });
    const { upserts, deletes } = diffEntries([a, b], [changed, c]);
    expect(upserts.map((e) => e.id)).toEqual([changed.id, c.id]);
    expect(deletes).toEqual([a.id]);
  });
});

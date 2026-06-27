import { describe, it, expect } from 'vitest';
import {
  appendWorkLogEntry,
  findCard,
  findContainer,
  moveCardAcross,
  reorderWithin,
  updateCard,
} from './board.js';

const makeBoard = () => ({
  'user-1': [
    { id: 'c1', title: 'A', status: 'Reviewing' },
    { id: 'c2', title: 'B', status: 'Drafting' },
  ],
  'user-2': [
    { id: 'c3', title: 'C', status: 'Research and Planning' },
  ],
  'user-3': [],
  available: [
    { id: 'c5', title: 'E', status: 'Not Started' },
  ],
  waiting: [],
});

describe('findContainer', () => {
  it('returns the column id when passed a column id', () => {
    expect(findContainer(makeBoard(), 'user-1')).toBe('user-1');
  });

  it('finds the column that holds a card', () => {
    expect(findContainer(makeBoard(), 'c3')).toBe('user-2');
  });

  it('returns undefined for an unknown id', () => {
    expect(findContainer(makeBoard(), 'nope')).toBeUndefined();
  });
});

describe('findCard', () => {
  it('returns the card object', () => {
    expect(findCard(makeBoard(), 'c2')).toMatchObject({ id: 'c2', title: 'B' });
  });

  it('returns null when missing', () => {
    expect(findCard(makeBoard(), 'missing')).toBeNull();
  });
});

describe('moveCardAcross', () => {
  it('moves a card to a different column', () => {
    const next = moveCardAcross(makeBoard(), { activeId: 'c1', overId: 'user-2' });
    expect(next['user-1'].map((c) => c.id)).toEqual(['c2']);
    expect(next['user-2'].map((c) => c.id)).toContain('c1');
  });

  it('drops a card into an empty column', () => {
    const next = moveCardAcross(makeBoard(), { activeId: 'c5', overId: 'user-3' });
    expect(next['available']).toEqual([]);
    expect(next['user-3'].map((c) => c.id)).toEqual(['c5']);
  });

  it('places below the over item when isBelowOverItem is true', () => {
    const next = moveCardAcross(makeBoard(), { activeId: 'c5', overId: 'c1', isBelowOverItem: true });
    expect(next['user-1'].map((c) => c.id)).toEqual(['c1', 'c5', 'c2']);
  });

  it('places above the over item when isBelowOverItem is false', () => {
    const next = moveCardAcross(makeBoard(), { activeId: 'c5', overId: 'c2', isBelowOverItem: false });
    expect(next['user-1'].map((c) => c.id)).toEqual(['c1', 'c5', 'c2']);
  });

  it('returns the same board when the source column equals the destination', () => {
    const board = makeBoard();
    const next = moveCardAcross(board, { activeId: 'c1', overId: 'c2' });
    expect(next).toBe(board);
  });

  it('returns the same board when the active id is unknown', () => {
    const board = makeBoard();
    expect(moveCardAcross(board, { activeId: 'ghost', overId: 'user-2' })).toBe(board);
  });
});

describe('reorderWithin', () => {
  it('reorders within a single column', () => {
    const next = reorderWithin(makeBoard(), { activeId: 'c1', overId: 'c2' });
    expect(next['user-1'].map((c) => c.id)).toEqual(['c2', 'c1']);
  });

  it('returns the same board when the cards are in different columns', () => {
    const board = makeBoard();
    expect(reorderWithin(board, { activeId: 'c1', overId: 'c3' })).toBe(board);
  });

  it('returns the same board when the over id is missing', () => {
    const board = makeBoard();
    expect(reorderWithin(board, { activeId: 'c1', overId: undefined })).toBe(board);
  });
});

describe('updateCard', () => {
  it('merges a patch into the matching card', () => {
    const next = updateCard(makeBoard(), 'c1', { status: 'Done', title: 'Renamed' });
    const card = next['user-1'].find((c) => c.id === 'c1');
    expect(card).toMatchObject({ id: 'c1', status: 'Done', title: 'Renamed' });
  });

  it('returns the same board when the card does not exist', () => {
    const board = makeBoard();
    expect(updateCard(board, 'missing', { status: 'Done' })).toBe(board);
  });

  it('does not mutate the input board', () => {
    const board = makeBoard();
    updateCard(board, 'c1', { status: 'Done' });
    expect(board['user-1'][0].status).toBe('Reviewing');
  });
});

describe('appendWorkLogEntry', () => {
  it('appends an entry to a card with no prior log', () => {
    const entry = { description: 'Reviewed', loggedAt: '2026-06-27T10:00:00.000Z' };
    const next = appendWorkLogEntry(makeBoard(), 'c1', entry);
    const card = next['user-1'].find((c) => c.id === 'c1');
    expect(card.workLog).toEqual([entry]);
  });

  it('appends to an existing log without dropping prior entries', () => {
    const board = makeBoard();
    board['user-1'][0].workLog = [{ description: 'first', loggedAt: 'a' }];
    const entry = { description: 'second', loggedAt: 'b' };
    const next = appendWorkLogEntry(board, 'c1', entry);
    expect(next['user-1'][0].workLog).toEqual([
      { description: 'first', loggedAt: 'a' },
      entry,
    ]);
  });
});

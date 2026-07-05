import { describe, it, expect } from 'vitest';
import {
  appendHistoryEvent,
  appendWorkLogEntry,
  applyDragLanding,
  applyStatusChecks,
  findCard,
  findContainer,
  getArchivedCards,
  getStatusCheckCards,
  getStatusCheckDueCards,
  moveCardAcross,
  reorderWithin,
  requiredColumnFor,
  resolveStatusCheck,
  setCardStatus,
  updateCard,
} from './board.js';

const NOW = '2026-06-27T10:00:00.000Z';

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
  waiting: [
    { id: 'c6', title: 'F', status: 'Waiting', previousColumn: 'user-1', previousStatus: 'Drafting' },
  ],
  archive: [
    { id: 'c7', title: 'G', status: 'Done', previousColumn: 'user-2', previousStatus: 'Reviewing' },
  ],
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

describe('requiredColumnFor', () => {
  it('maps Waiting to waiting', () => {
    expect(requiredColumnFor('Waiting')).toBe('waiting');
  });
  it('maps Done to archive', () => {
    expect(requiredColumnFor('Done')).toBe('archive');
  });
  it('returns null for statuses with no required column', () => {
    expect(requiredColumnFor('Drafting')).toBeNull();
    expect(requiredColumnFor('Reviewing')).toBeNull();
    expect(requiredColumnFor(null)).toBeNull();
  });
});

describe('moveCardAcross', () => {
  it('refuses to drop into the archive container', () => {
    const board = makeBoard();
    const next = moveCardAcross(board, { activeId: 'c1', overId: 'archive' });
    expect(next).toBe(board);
  });
});

describe('setCardStatus', () => {
  it('returns the same board with no change when the status is unchanged', () => {
    const board = makeBoard();
    const { items, requiresDestination } = setCardStatus(board, 'c1', 'Reviewing', { now: NOW });
    expect(requiresDestination).toBe(false);
    expect(items).toBe(board);
  });

  it('moves a card to waiting when status changes to Waiting and stashes the previous column', () => {
    const { items, requiresDestination } = setCardStatus(makeBoard(), 'c1', 'Waiting', { now: NOW });
    expect(requiresDestination).toBe(false);
    expect(items['user-1'].map((c) => c.id)).toEqual(['c2']);
    const moved = items.waiting.find((c) => c.id === 'c1');
    expect(moved).toMatchObject({ status: 'Waiting', previousColumn: 'user-1', previousStatus: 'Reviewing' });
  });

  it('moves a card to archive when status changes to Done and stashes the previous column', () => {
    const { items, requiresDestination } = setCardStatus(makeBoard(), 'c2', 'Done', { now: NOW });
    expect(requiresDestination).toBe(false);
    expect(items['user-1'].map((c) => c.id)).toEqual(['c1']);
    const moved = items.archive.find((c) => c.id === 'c2');
    expect(moved).toMatchObject({ status: 'Done', previousColumn: 'user-1', previousStatus: 'Drafting' });
  });

  it('refuses to move out of Done without a destination column', () => {
    const board = makeBoard();
    const { items, requiresDestination } = setCardStatus(board, 'c7', 'Drafting', { now: NOW });
    expect(requiresDestination).toBe(true);
    expect(items).toBe(board);
  });

  it('moves out of Done when an explicit destination is provided', () => {
    const { items, requiresDestination } = setCardStatus(
      makeBoard(),
      'c7',
      'Drafting',
      { now: NOW, destinationColumn: 'user-3' },
    );
    expect(requiresDestination).toBe(false);
    expect(items.archive.map((c) => c.id)).toEqual([]);
    const restored = items['user-3'].find((c) => c.id === 'c7');
    expect(restored).toMatchObject({ status: 'Drafting' });
    expect(restored.previousColumn).toBeNull();
    expect(restored.previousStatus).toBeNull();
  });

  it('moves out of Waiting back to the previous column when status changes to a non-coupled status', () => {
    const { items } = setCardStatus(makeBoard(), 'c6', 'Drafting', { now: NOW });
    expect(items.waiting).toEqual([]);
    const moved = items['user-1'].find((c) => c.id === 'c6');
    expect(moved).toMatchObject({ status: 'Drafting' });
    expect(moved.previousColumn).toBeNull();
    expect(moved.previousStatus).toBeNull();
  });

  it('appends a status history event', () => {
    const { items } = setCardStatus(makeBoard(), 'c1', 'Drafting', { now: NOW });
    const card = items['user-1'].find((c) => c.id === 'c1');
    expect(card.history).toEqual([
      { at: NOW, kind: 'status', from: 'Reviewing', to: 'Drafting' },
    ]);
  });

  it('appends both status and column history when the move is driven by status', () => {
    const { items } = setCardStatus(makeBoard(), 'c1', 'Waiting', { now: NOW });
    const card = items.waiting.find((c) => c.id === 'c1');
    expect(card.history).toEqual([
      { at: NOW, kind: 'status', from: 'Reviewing', to: 'Waiting' },
      { at: NOW, kind: 'column', from: 'user-1', to: 'waiting', reason: 'status' },
    ]);
  });

  it('stamps the actor on history events when one is supplied', () => {
    const { items } = setCardStatus(makeBoard(), 'c1', 'Waiting', { now: NOW, actor: 'user-3' });
    const card = items.waiting.find((c) => c.id === 'c1');
    expect(card.history).toEqual([
      { at: NOW, kind: 'status', from: 'Reviewing', to: 'Waiting', by: 'user-3' },
      { at: NOW, kind: 'column', from: 'user-1', to: 'waiting', reason: 'status', by: 'user-3' },
    ]);
  });

  it('omits the actor field entirely when none is supplied', () => {
    const { items } = setCardStatus(makeBoard(), 'c1', 'Drafting', { now: NOW });
    const [event] = items['user-1'].find((c) => c.id === 'c1').history;
    expect('by' in event).toBe(false);
  });
});

describe('applyDragLanding', () => {
  it('sets status to Waiting when a card is dragged into the waiting column', () => {
    const board = makeBoard();
    const moved = moveCardAcross(board, { activeId: 'c1', overId: 'waiting' });
    const next = applyDragLanding(moved, 'c1', { fromColumn: 'user-1', now: NOW });
    const landed = next.waiting.find((c) => c.id === 'c1');
    expect(landed).toMatchObject({
      status: 'Waiting',
      previousColumn: 'user-1',
      previousStatus: 'Reviewing',
    });
  });

  it('restores previousStatus when a card is dragged out of waiting', () => {
    const board = makeBoard();
    const moved = moveCardAcross(board, { activeId: 'c6', overId: 'user-2' });
    const next = applyDragLanding(moved, 'c6', { fromColumn: 'waiting', now: NOW });
    const landed = next['user-2'].find((c) => c.id === 'c6');
    expect(landed.status).toBe('Drafting');
    expect(landed.previousColumn).toBeNull();
    expect(landed.previousStatus).toBeNull();
  });

  it('defaults to Reviewing when dragged out of waiting with no previousStatus', () => {
    const board = makeBoard();
    board.waiting.push({ id: 'cFresh', title: 'fresh', status: 'Waiting' });
    const moved = moveCardAcross(board, { activeId: 'cFresh', overId: 'user-2' });
    const next = applyDragLanding(moved, 'cFresh', { fromColumn: 'waiting', now: NOW });
    const landed = next['user-2'].find((c) => c.id === 'cFresh');
    expect(landed.status).toBe('Reviewing');
  });

  it('records a drag column-change history event', () => {
    const board = makeBoard();
    const moved = moveCardAcross(board, { activeId: 'c1', overId: 'user-2' });
    const next = applyDragLanding(moved, 'c1', { fromColumn: 'user-1', now: NOW });
    const landed = next['user-2'].find((c) => c.id === 'c1');
    expect(landed.history).toEqual([
      { at: NOW, kind: 'column', from: 'user-1', to: 'user-2', reason: 'drag' },
    ]);
  });

  it('stamps the actor on the drag history event when supplied', () => {
    const board = makeBoard();
    const moved = moveCardAcross(board, { activeId: 'c1', overId: 'user-2' });
    const next = applyDragLanding(moved, 'c1', { fromColumn: 'user-1', now: NOW, actor: 'user-2' });
    const landed = next['user-2'].find((c) => c.id === 'c1');
    expect(landed.history).toEqual([
      { at: NOW, kind: 'column', from: 'user-1', to: 'user-2', reason: 'drag', by: 'user-2' },
    ]);
  });

  it('does nothing when fromColumn equals toColumn', () => {
    const board = makeBoard();
    const next = applyDragLanding(board, 'c1', { fromColumn: 'user-1', now: NOW });
    expect(next).toBe(board);
  });
});

describe('appendHistoryEvent', () => {
  it('appends to a card with no prior history', () => {
    const event = { at: NOW, kind: 'status', from: 'A', to: 'B' };
    const next = appendHistoryEvent(makeBoard(), 'c1', event);
    expect(next['user-1'][0].history).toEqual([event]);
  });

  it('appends to existing history', () => {
    const board = makeBoard();
    board['user-1'][0].history = [{ at: 'earlier', kind: 'status', from: 'X', to: 'Y' }];
    const event = { at: NOW, kind: 'status', from: 'Y', to: 'Z' };
    const next = appendHistoryEvent(board, 'c1', event);
    expect(next['user-1'][0].history).toHaveLength(2);
  });
});

describe('getArchivedCards', () => {
  it('returns the archive container contents', () => {
    expect(getArchivedCards(makeBoard()).map((c) => c.id)).toEqual(['c7']);
  });

  it('returns an empty array when archive is missing', () => {
    expect(getArchivedCards({})).toEqual([]);
  });
});

describe('setCardStatus — Done restoration edge cases', () => {
  it('requires a destination when the provided destination column is unknown', () => {
    const board = makeBoard();
    const { items, requiresDestination } = setCardStatus(board, 'c7', 'Drafting', {
      now: NOW,
      destinationColumn: 'user-99',
    });
    expect(requiresDestination).toBe(true);
    expect(items).toBe(board);
  });

  it('requires a destination when the provided destination is the archive itself', () => {
    const board = makeBoard();
    const { items, requiresDestination } = setCardStatus(board, 'c7', 'Drafting', {
      now: NOW,
      destinationColumn: 'archive',
    });
    expect(requiresDestination).toBe(true);
    expect(items).toBe(board);
  });
});

describe('work log ordering', () => {
  it('appends multiple entries in call order', () => {
    let board = makeBoard();
    board = appendWorkLogEntry(board, 'c1', { description: 'first', loggedAt: 'a' });
    board = appendWorkLogEntry(board, 'c1', { description: 'second', loggedAt: 'b' });
    board = appendWorkLogEntry(board, 'c1', { description: 'third', loggedAt: 'c' });
    expect(board['user-1'][0].workLog.map((e) => e.description)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });
});

describe('history ordering across mixed transitions', () => {
  it('interleaves status and column events in the order they happened', () => {
    let board = makeBoard();
    board = setCardStatus(board, 'c1', 'Drafting', { now: '1' }).items;
    board = setCardStatus(board, 'c1', 'Waiting', { now: '2' }).items;
    const moved = moveCardAcross(board, { activeId: 'c1', overId: 'user-2' });
    board = applyDragLanding(moved, 'c1', { fromColumn: 'waiting', now: '3' });

    const card = findCard(board, 'c1');
    expect(card.history.map((e) => `${e.at}:${e.kind}:${e.to}`)).toEqual([
      '1:status:Drafting',
      '2:status:Waiting',
      '2:column:waiting',
      '3:column:user-2',
      '3:status:Drafting',
    ]);
  });
});

describe('waitingSince tracking', () => {
  it('stamps waitingSince when status moves a card into waiting', () => {
    const { items } = setCardStatus(makeBoard(), 'c1', 'Waiting', { now: NOW });
    expect(findCard(items, 'c1').waitingSince).toBe(NOW);
  });

  it('clears waitingSince when status moves a card out of waiting', () => {
    const board = makeBoard();
    board.waiting[0].waitingSince = '2026-06-01T00:00:00.000Z';
    const { items } = setCardStatus(board, 'c6', 'Drafting', { now: NOW });
    expect(findCard(items, 'c6').waitingSince).toBeNull();
  });

  it('stamps waitingSince when a drag lands in waiting', () => {
    const moved = moveCardAcross(makeBoard(), { activeId: 'c1', overId: 'waiting' });
    const next = applyDragLanding(moved, 'c1', { fromColumn: 'user-1', now: NOW });
    expect(findCard(next, 'c1').waitingSince).toBe(NOW);
  });

  it('clears waitingSince and statusCheckAt when a drag leaves waiting', () => {
    const board = makeBoard();
    board.waiting[0].waitingSince = '2026-06-01T00:00:00.000Z';
    board.waiting[0].statusCheckAt = '2026-06-10T00:00:00.000Z';
    const moved = moveCardAcross(board, { activeId: 'c6', overId: 'user-2' });
    const next = applyDragLanding(moved, 'c6', { fromColumn: 'waiting', now: NOW });
    const card = findCard(next, 'c6');
    expect(card.waitingSince).toBeNull();
    expect(card.statusCheckAt).toBeNull();
  });
});

describe('status checks', () => {
  const NINE_DAYS_AGO = '2026-06-18T10:00:00.000Z';
  const TWO_DAYS_AGO = '2026-06-25T10:00:00.000Z';

  const makeWaitingBoard = () => {
    const board = makeBoard();
    board.waiting = [
      { id: 'w1', title: 'Old', status: 'Waiting', waitingSince: NINE_DAYS_AGO, previousColumn: 'user-1', previousStatus: 'Drafting' },
      { id: 'w2', title: 'Fresh', status: 'Waiting', waitingSince: TWO_DAYS_AGO },
      { id: 'w3', title: 'No stamp', status: 'Waiting' },
    ];
    return board;
  };

  it('getStatusCheckDueCards returns only Waiting cards past the threshold', () => {
    const due = getStatusCheckDueCards(makeWaitingBoard(), { now: NOW });
    expect(due.map((c) => c.id)).toEqual(['w1']);
  });

  it('getStatusCheckDueCards respects a custom threshold', () => {
    const due = getStatusCheckDueCards(makeWaitingBoard(), { now: NOW, thresholdDays: 1 });
    expect(due.map((c) => c.id)).toEqual(['w1', 'w2']);
  });

  it('getStatusCheckDueCards returns nothing for an invalid now', () => {
    expect(getStatusCheckDueCards(makeWaitingBoard(), { now: 'not-a-date' })).toEqual([]);
  });

  it('applyStatusChecks flags due cards with status, timestamp, and history', () => {
    const { items, flaggedIds } = applyStatusChecks(makeWaitingBoard(), { now: NOW });
    expect(flaggedIds).toEqual(['w1']);
    const flagged = findCard(items, 'w1');
    expect(flagged.status).toBe('Status Check');
    expect(flagged.statusCheckAt).toBe(NOW);
    expect(flagged.waitingSince).toBe(NINE_DAYS_AGO);
    expect(flagged.history.at(-1)).toMatchObject({ kind: 'status', from: 'Waiting', to: 'Status Check' });
    expect(findContainer(items, 'w1')).toBe('waiting');
  });

  it('applyStatusChecks is idempotent — already flagged cards are not reflagged', () => {
    const first = applyStatusChecks(makeWaitingBoard(), { now: NOW }).items;
    const second = applyStatusChecks(first, { now: NOW });
    expect(second.flaggedIds).toEqual([]);
    expect(second.items).toBe(first);
  });

  it('getStatusCheckCards returns flagged cards', () => {
    const { items } = applyStatusChecks(makeWaitingBoard(), { now: NOW });
    expect(getStatusCheckCards(items).map((c) => c.id)).toEqual(['w1']);
  });

  it('resolveStatusCheck archive sends the card to the archive as Done', () => {
    const flagged = applyStatusChecks(makeWaitingBoard(), { now: NOW }).items;
    const next = resolveStatusCheck(flagged, 'w1', { action: 'archive', now: NOW });
    const card = findCard(next, 'w1');
    expect(findContainer(next, 'w1')).toBe('archive');
    expect(card.status).toBe('Done');
    expect(card.waitingSince).toBeNull();
    expect(card.statusCheckAt).toBeNull();
  });

  it('resolveStatusCheck keep-waiting restarts the clock in place', () => {
    const flagged = applyStatusChecks(makeWaitingBoard(), { now: NOW }).items;
    const later = '2026-06-28T10:00:00.000Z';
    const next = resolveStatusCheck(flagged, 'w1', { action: 'keep-waiting', now: later });
    const card = findCard(next, 'w1');
    expect(findContainer(next, 'w1')).toBe('waiting');
    expect(card.status).toBe('Waiting');
    expect(card.waitingSince).toBe(later);
    expect(card.statusCheckAt).toBeNull();
  });

  it('resolveStatusCheck assign moves the card to the chosen column with its prior status', () => {
    const flagged = applyStatusChecks(makeWaitingBoard(), { now: NOW }).items;
    const next = resolveStatusCheck(flagged, 'w1', { action: 'assign', destinationColumn: 'user-2', now: NOW });
    const card = findCard(next, 'w1');
    expect(findContainer(next, 'w1')).toBe('user-2');
    expect(card.status).toBe('Drafting');
    expect(card.waitingSince).toBeNull();
    expect(card.statusCheckAt).toBeNull();
  });

  it('resolveStatusCheck assign falls back to the stashed previous column when no destination is given', () => {
    const flagged = applyStatusChecks(makeWaitingBoard(), { now: NOW }).items;
    const next = resolveStatusCheck(flagged, 'w1', { action: 'assign', now: NOW });
    expect(findContainer(next, 'w1')).toBe('user-1');
  });

  it('resolveStatusCheck ignores cards that are not flagged', () => {
    const board = makeWaitingBoard();
    expect(resolveStatusCheck(board, 'w2', { action: 'archive', now: NOW })).toBe(board);
  });
});

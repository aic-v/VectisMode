import { arrayMove } from '@dnd-kit/sortable';

export const STATUS_KEYS = [
  'Not Started',
  'Research and Planning',
  'Drafting',
  'Reviewing',
  'Waiting',
  'Done',
];

export const CLIENTS = [
  'Acme Corp',
  'EuroTech Ltd',
  'Initech LLC',
  'Globex Industries',
  'Vandelay Imports',
  'Internal',
];

export const COLUMN_TITLES = {
  'user-1': 'Partner A',
  'user-2': 'Partner B',
  'user-3': 'Associate 1',
  'user-4': 'Associate 2',
  waiting: 'Waiting Response',
  available: 'Available',
  archive: 'Archive',
};

export const RESTORE_COLUMNS = ['user-1', 'user-2', 'user-3', 'user-4', 'available', 'waiting'];

export const STATUS_TO_COLUMN = {
  Waiting: 'waiting',
  Done: 'archive',
};

export const DEFAULT_RESTORED_STATUS = 'Reviewing';

export const INITIAL_ITEMS = {
  'user-1': [
    { id: 'c1', title: 'Review MSA for Acme Corp', status: 'Reviewing', dueDate: 'May 25, 2026', client: 'Acme Corp', owner: 'Partner A', team: 'Commercial', aiContext: 'Draft contains standard indemnity clauses. Requires specific review of liability cap.', workLog: [], history: [] },
    { id: 'c2', title: 'Draft Employee Handbook', status: 'Drafting', dueDate: 'Jun 04, 2026', client: 'Internal', owner: 'Partner A', team: 'Employment', aiContext: 'Needs alignment with new remote work policies.', workLog: [], history: [] },
  ],
  'user-2': [
    { id: 'c3', title: 'Data Privacy Addendum', status: 'Research and Planning', dueDate: 'May 22, 2026', client: 'EuroTech Ltd', owner: 'Partner B', team: 'Privacy', aiContext: 'Standard DPA. Matches previous templates used for EU clients.', workLog: [], history: [] },
  ],
  'user-3': [],
  'user-4': [],
  waiting: [
    { id: 'c4', title: 'Response from Opposing Counsel', status: 'Waiting', dueDate: 'May 19, 2026', client: 'Initech LLC', owner: 'Partner A', team: 'IP & Licensing', aiContext: 'Pending their markups on the IP licensing agreement.', workLog: [], history: [] },
  ],
  available: [
    { id: 'c5', title: 'Draft standard Terms of Service', status: 'Not Started', dueDate: null, client: null, owner: null, team: null, aiContext: 'Requested by new startup client.', workLog: [], history: [] },
  ],
  archive: [],
};

export function findContainer(items, id) {
  if (id in items) return id;
  return Object.keys(items).find((key) => items[key].some((item) => item.id === id));
}

export function findCard(items, cardId) {
  for (const key of Object.keys(items)) {
    const card = items[key].find((c) => c.id === cardId);
    if (card) return card;
  }
  return null;
}

export function requiredColumnFor(status) {
  return STATUS_TO_COLUMN[status] ?? null;
}

function isCoupledColumn(column) {
  return column === 'waiting' || column === 'archive';
}

export function moveCardAcross(items, { activeId, overId, isBelowOverItem = false }) {
  const activeContainer = findContainer(items, activeId);
  const overContainer = findContainer(items, overId);

  if (!activeContainer || !overContainer || activeContainer === overContainer) {
    return items;
  }

  if (overContainer === 'archive') {
    return items;
  }

  const activeItems = items[activeContainer];
  const overItems = items[overContainer];
  const activeIndex = activeItems.findIndex((i) => i.id === activeId);
  if (activeIndex === -1) return items;

  let newIndex;
  if (overId in items) {
    newIndex = overItems.length + 1;
  } else {
    const overIndex = overItems.findIndex((i) => i.id === overId);
    const modifier = isBelowOverItem ? 1 : 0;
    newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
  }

  const movingCard = activeItems[activeIndex];

  return {
    ...items,
    [activeContainer]: activeItems.filter((item) => item.id !== activeId),
    [overContainer]: [
      ...overItems.slice(0, newIndex),
      movingCard,
      ...overItems.slice(newIndex),
    ],
  };
}

export function reorderWithin(items, { activeId, overId }) {
  const container = findContainer(items, activeId);
  if (!container || container !== findContainer(items, overId)) {
    return items;
  }

  const activeIndex = items[container].findIndex((i) => i.id === activeId);
  const overIndex = items[container].findIndex((i) => i.id === overId);

  if (activeIndex === overIndex || overIndex === -1) {
    return items;
  }

  return {
    ...items,
    [container]: arrayMove(items[container], activeIndex, overIndex),
  };
}

export function updateCard(items, cardId, patch) {
  const container = findContainer(items, cardId);
  if (!container) return items;

  return {
    ...items,
    [container]: items[container].map((c) =>
      c.id === cardId ? { ...c, ...patch } : c,
    ),
  };
}

export function appendWorkLogEntry(items, cardId, entry) {
  const card = findCard(items, cardId);
  if (!card) return items;

  const existing = Array.isArray(card.workLog) ? card.workLog : [];
  return updateCard(items, cardId, { workLog: [...existing, entry] });
}

export function appendHistoryEvent(items, cardId, event) {
  const card = findCard(items, cardId);
  if (!card) return items;

  const existing = Array.isArray(card.history) ? card.history : [];
  return updateCard(items, cardId, { history: [...existing, event] });
}

function moveToContainer(items, cardId, toColumn) {
  const fromColumn = findContainer(items, cardId);
  if (!fromColumn || fromColumn === toColumn || !(toColumn in items)) {
    return items;
  }
  const card = items[fromColumn].find((c) => c.id === cardId);
  if (!card) return items;
  return {
    ...items,
    [fromColumn]: items[fromColumn].filter((c) => c.id !== cardId),
    [toColumn]: [...items[toColumn], card],
  };
}

export function setCardStatus(items, cardId, newStatus, { now, destinationColumn } = {}) {
  const card = findCard(items, cardId);
  if (!card) return { items, requiresDestination: false };

  const currentColumn = findContainer(items, cardId);
  const currentStatus = card.status ?? null;

  if (newStatus === currentStatus && !destinationColumn) {
    return { items, requiresDestination: false };
  }

  if (currentStatus === 'Done' && newStatus !== 'Done' && !destinationColumn) {
    return { items, requiresDestination: true };
  }

  const required = requiredColumnFor(newStatus);
  const wasCoupled = isCoupledColumn(currentColumn);
  let targetColumn = currentColumn;
  const patch = { status: newStatus };

  if (required) {
    if (currentColumn !== required) {
      patch.previousColumn = wasCoupled ? card.previousColumn ?? null : currentColumn;
      patch.previousStatus = wasCoupled ? card.previousStatus ?? null : currentStatus;
      targetColumn = required;
    }
  } else if (wasCoupled) {
    targetColumn =
      destinationColumn ?? card.previousColumn ?? 'available';
    patch.previousColumn = null;
    patch.previousStatus = null;
  }

  let next = updateCard(items, cardId, patch);

  if (targetColumn !== currentColumn) {
    next = moveToContainer(next, cardId, targetColumn);
  }

  next = appendHistoryEvent(next, cardId, {
    at: now,
    kind: 'status',
    from: currentStatus,
    to: newStatus,
  });

  if (targetColumn !== currentColumn) {
    next = appendHistoryEvent(next, cardId, {
      at: now,
      kind: 'column',
      from: currentColumn,
      to: targetColumn,
      reason: 'status',
    });
  }

  return { items: next, requiresDestination: false };
}

export function applyDragLanding(items, cardId, { fromColumn, now }) {
  const toColumn = findContainer(items, cardId);
  if (!toColumn || toColumn === fromColumn) return items;

  const card = findCard(items, cardId);
  if (!card) return items;

  const currentStatus = card.status ?? null;
  let newStatus = currentStatus;
  const patch = {};

  if (toColumn === 'waiting') {
    if (currentStatus !== 'Waiting') {
      newStatus = 'Waiting';
      patch.previousColumn = isCoupledColumn(fromColumn) ? null : fromColumn;
      patch.previousStatus = isCoupledColumn(fromColumn) ? null : currentStatus;
    }
  } else if (fromColumn === 'waiting') {
    newStatus = card.previousStatus ?? DEFAULT_RESTORED_STATUS;
    patch.previousColumn = null;
    patch.previousStatus = null;
  }

  if (newStatus !== currentStatus) {
    patch.status = newStatus;
  }

  let next = items;
  if (Object.keys(patch).length > 0) {
    next = updateCard(next, cardId, patch);
  }

  next = appendHistoryEvent(next, cardId, {
    at: now,
    kind: 'column',
    from: fromColumn,
    to: toColumn,
    reason: 'drag',
  });

  if (newStatus !== currentStatus) {
    next = appendHistoryEvent(next, cardId, {
      at: now,
      kind: 'status',
      from: currentStatus,
      to: newStatus,
      reason: 'column',
    });
  }

  return next;
}

export function getArchivedCards(items) {
  return items.archive ?? [];
}

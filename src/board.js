import { arrayMove } from '@dnd-kit/sortable';

export const STATUS_KEYS = [
  'Not Started',
  'Research and Planning',
  'Drafting',
  'Reviewing',
  'Waiting',
  'Status Check',
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

export const TEAM_MEMBERS = [
  { id: 'user-1', name: 'Partner A' },
  { id: 'user-2', name: 'Partner B' },
  { id: 'user-3', name: 'Associate 1' },
  { id: 'user-4', name: 'Associate 2' },
];

export const STATUS_TO_COLUMN = {
  Waiting: 'waiting',
  'Status Check': 'waiting',
  Done: 'archive',
};

export const DEFAULT_RESTORED_STATUS = 'Reviewing';

export const STATUS_CHECK_THRESHOLD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// Sample data only: give the seeded Waiting card a real waitingSince so the
// 7-day status check is demonstrable on first load.
const SAMPLE_WAITING_SINCE = new Date(Date.now() - 9 * DAY_MS).toISOString();

export const INITIAL_ITEMS = {
  'user-1': [
    { id: 'c1', title: 'Review MSA for Acme Corp', status: 'Reviewing', dueDate: 'May 25, 2026', client: 'Acme Corp', owner: 'Partner A', team: 'Commercial', aiContext: 'Draft contains standard indemnity clauses. Requires specific review of liability cap.', description: 'Review the master services agreement returned by Acme Corp. Their markups touch the indemnity clauses and the liability cap; confirm the cap still protects us at 12 months of fees and that the carve-outs match our standard position.', tasksUrl: 'https://tasks.vectis.law/matters/c1', timeEntriesUrl: 'https://time.vectis.law/matters/c1', taskFolderUrl: 'https://files.vectis.law/matters/c1', workLog: [], history: [] },
    { id: 'c2', title: 'Draft Employee Handbook', status: 'Drafting', dueDate: 'Jun 04, 2026', client: 'Internal', owner: 'Partner A', team: 'Employment', aiContext: 'Needs alignment with new remote work policies.', description: 'Produce the first full draft of the firm employee handbook. The remote-work and equipment sections need to reflect the policy agreed in April; everything else can follow last year\'s template.', tasksUrl: 'https://tasks.vectis.law/matters/c2', timeEntriesUrl: 'https://time.vectis.law/matters/c2', taskFolderUrl: 'https://files.vectis.law/matters/c2', workLog: [], history: [] },
  ],
  'user-2': [
    { id: 'c3', title: 'Data Privacy Addendum', status: 'Research and Planning', dueDate: 'May 22, 2026', client: 'EuroTech Ltd', owner: 'Partner B', team: 'Privacy', aiContext: 'Standard DPA. Matches previous templates used for EU clients.', description: 'Prepare a data privacy addendum for EuroTech Ltd based on our standard EU DPA template. Check the sub-processor list and the international transfer mechanism before circulating.', tasksUrl: 'https://tasks.vectis.law/matters/c3', timeEntriesUrl: 'https://time.vectis.law/matters/c3', taskFolderUrl: 'https://files.vectis.law/matters/c3', workLog: [], history: [] },
  ],
  'user-3': [],
  'user-4': [],
  waiting: [
    { id: 'c4', title: 'Response from Opposing Counsel', status: 'Waiting', dueDate: 'May 19, 2026', client: 'Initech LLC', owner: 'Partner A', team: 'IP & Licensing', aiContext: 'Pending their markups on the IP licensing agreement.', description: 'Awaiting opposing counsel\'s markups on the IP licensing agreement for Initech LLC. Chase if nothing arrives; the licence needs to be signed before their product launch.', tasksUrl: 'https://tasks.vectis.law/matters/c4', timeEntriesUrl: 'https://time.vectis.law/matters/c4', taskFolderUrl: 'https://files.vectis.law/matters/c4', waitingSince: SAMPLE_WAITING_SINCE, previousColumn: 'user-1', previousStatus: 'Reviewing', workLog: [], history: [] },
  ],
  available: [
    { id: 'c5', title: 'Draft standard Terms of Service', status: 'Not Started', dueDate: null, client: null, owner: null, team: null, aiContext: 'Requested by new startup client.', description: 'Draft a reusable set of standard terms of service for SaaS clients. Start from the Vandelay engagement and generalise the payment and acceptable-use sections.', tasksUrl: 'https://tasks.vectis.law/matters/c5', timeEntriesUrl: 'https://time.vectis.law/matters/c5', taskFolderUrl: 'https://files.vectis.law/matters/c5', workLog: [], history: [] },
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

export function setCardStatus(items, cardId, newStatus, { now, destinationColumn, actor } = {}) {
  const card = findCard(items, cardId);
  if (!card) return { items, requiresDestination: false };

  const currentColumn = findContainer(items, cardId);
  const currentStatus = card.status ?? null;

  const destination =
    destinationColumn && destinationColumn in items && destinationColumn !== 'archive'
      ? destinationColumn
      : null;

  if (newStatus === currentStatus && !destination) {
    return { items, requiresDestination: false };
  }

  if (currentStatus === 'Done' && newStatus !== 'Done' && !destination) {
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
      destination ?? card.previousColumn ?? 'available';
    patch.previousColumn = null;
    patch.previousStatus = null;
  }

  if (targetColumn === 'waiting' && currentColumn !== 'waiting') {
    patch.waitingSince = now ?? null;
  } else if (currentColumn === 'waiting' && targetColumn !== 'waiting') {
    patch.waitingSince = null;
  } else if (currentColumn === 'waiting' && newStatus === 'Waiting' && currentStatus === 'Status Check') {
    // A manager keeping the matter in Waiting restarts the 7-day clock.
    patch.waitingSince = now ?? null;
  }

  if (newStatus === 'Status Check') {
    patch.statusCheckAt = now ?? null;
  } else if (currentStatus === 'Status Check') {
    patch.statusCheckAt = null;
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
    ...(actor ? { by: actor } : {}),
  });

  if (targetColumn !== currentColumn) {
    next = appendHistoryEvent(next, cardId, {
      at: now,
      kind: 'column',
      from: currentColumn,
      to: targetColumn,
      reason: 'status',
      ...(actor ? { by: actor } : {}),
    });
  }

  return { items: next, requiresDestination: false };
}

export function applyDragLanding(items, cardId, { fromColumn, now, actor }) {
  const toColumn = findContainer(items, cardId);
  if (!toColumn || toColumn === fromColumn) return items;

  const card = findCard(items, cardId);
  if (!card) return items;

  const currentStatus = card.status ?? null;
  let newStatus = currentStatus;
  const patch = {};

  if (toColumn === 'waiting') {
    patch.waitingSince = now ?? null;
    if (currentStatus !== 'Waiting') {
      newStatus = 'Waiting';
      patch.previousColumn = isCoupledColumn(fromColumn) ? null : fromColumn;
      patch.previousStatus = isCoupledColumn(fromColumn) ? null : currentStatus;
    }
  } else if (fromColumn === 'waiting') {
    newStatus = card.previousStatus ?? DEFAULT_RESTORED_STATUS;
    patch.previousColumn = null;
    patch.previousStatus = null;
    patch.waitingSince = null;
    patch.statusCheckAt = null;
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
    ...(actor ? { by: actor } : {}),
  });

  if (newStatus !== currentStatus) {
    next = appendHistoryEvent(next, cardId, {
      at: now,
      kind: 'status',
      from: currentStatus,
      to: newStatus,
      reason: 'column',
      ...(actor ? { by: actor } : {}),
    });
  }

  return next;
}

export function getArchivedCards(items) {
  return items.archive ?? [];
}

export function getStatusCheckDueCards(items, { now, thresholdDays = STATUS_CHECK_THRESHOLD_DAYS } = {}) {
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return [];

  return (items.waiting ?? []).filter((card) => {
    if (card.status !== 'Waiting' || !card.waitingSince) return false;
    const sinceMs = new Date(card.waitingSince).getTime();
    return Number.isFinite(sinceMs) && nowMs - sinceMs >= thresholdDays * DAY_MS;
  });
}

export function getStatusCheckCards(items) {
  return (items.waiting ?? []).filter((card) => card.status === 'Status Check');
}

export function applyStatusChecks(items, { now, thresholdDays } = {}) {
  const due = getStatusCheckDueCards(items, { now, thresholdDays });
  let next = items;
  for (const card of due) {
    next = setCardStatus(next, card.id, 'Status Check', { now }).items;
  }
  return { items: next, flaggedIds: due.map((card) => card.id) };
}

export function resolveStatusCheck(items, cardId, { action, destinationColumn, now } = {}) {
  const card = findCard(items, cardId);
  if (!card || card.status !== 'Status Check') return items;

  if (action === 'archive') {
    return setCardStatus(items, cardId, 'Done', { now }).items;
  }

  if (action === 'keep-waiting') {
    return setCardStatus(items, cardId, 'Waiting', { now }).items;
  }

  if (action === 'assign') {
    const restoredStatus =
      card.previousStatus && !requiredColumnFor(card.previousStatus)
        ? card.previousStatus
        : DEFAULT_RESTORED_STATUS;
    return setCardStatus(items, cardId, restoredStatus, { now, destinationColumn }).items;
  }

  return items;
}

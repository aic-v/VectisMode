// Personal agent for My Command Centre.
//
// `getAgentReply` is the single integration seam: today it answers from a
// local, rules-based reading of the board; when a real agent endpoint exists,
// replace the body of `getAgentReply` with a network call and keep the
// signature. Everything the UI knows about the agent goes through here.

import { COLUMN_TITLES, TEAM_MEMBERS, getStatusCheckCards } from './board.js';
import {
  billableSplit,
  categoryLabel,
  filterEntries,
  isoDate,
  startOfWeek,
  totalsBy,
  unloggedWeekdays,
} from './time.js';

export function parseDueDate(dueDate) {
  if (!dueDate) return null;
  const parsed = new Date(dueDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function classifyDueDate(dueDate, now) {
  const due = parseDueDate(dueDate);
  if (!due) return 'none';
  const today = startOfDay(now);
  const dueDay = startOfDay(due);
  const diffDays = Math.round((dueDay - today) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'week';
  return 'later';
}

export function getCardsForMember(items, memberId) {
  const member = TEAM_MEMBERS.find((m) => m.id === memberId);
  const ownColumn = items[memberId] ?? [];
  const owned = ['waiting', 'available']
    .flatMap((column) => items[column] ?? [])
    .filter((card) => member && card.owner === member.name);
  const seen = new Set(ownColumn.map((card) => card.id));
  return [...ownColumn, ...owned.filter((card) => !seen.has(card.id))];
}

function listCards(cards) {
  return cards.map((card) => `• ${card.title}${card.dueDate ? ` (due ${card.dueDate})` : ''}`).join('\n');
}

function summarise(items, memberId, now) {
  const mine = getCardsForMember(items, memberId);
  const grouped = { overdue: [], today: [], week: [], later: [], none: [] };
  for (const card of mine) {
    grouped[classifyDueDate(card.dueDate, now)].push(card);
  }
  return { mine, grouped };
}

const CATEGORY_KEYWORDS = [
  { key: 'bd', pattern: /\b(bd|business development|pitch|marketing|networking)\b/ },
  { key: 'research', pattern: /\b(research|writing|article|paper|know-?how)\b/ },
  { key: 'product', pattern: /\b(product|tech|tooling|dashboard|engineering)\b/ },
  { key: 'training', pattern: /\b(training|cle|workshop|mentoring|course)\b/ },
  { key: 'admin', pattern: /\b(admin|administration|ops|filing|billing)\b/ },
  { key: 'client', pattern: /\b(client|matter|drafting|reviewing|negotiation)\b/ },
];

function activeCards(items) {
  return Object.entries(items)
    .filter(([column]) => column !== 'archive')
    .flatMap(([, cards]) => cards);
}

function findMatterInText(text, items) {
  let best = null;
  let bestScore = 0;
  for (const card of activeCards(items)) {
    let score = 0;
    const words = (card.title ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    for (const word of words) {
      if (text.includes(word)) score += 1;
    }
    if (card.client && text.includes(card.client.toLowerCase())) score += 2;
    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

// Parses "log 1.5h on the Acme MSA for reviewing the cap yesterday" into
// time-entry fields (no id/loggedAt — the caller supplies those). Returns
// null when the message is not a log command; returns { error } when it is
// one but the hours are missing.
export function parseLogCommand(message, { items, memberId, now = new Date() }) {
  const text = (message ?? '').trim().toLowerCase();
  if (!/^log\b/.test(text)) return null;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const minutesMatch = text.match(/(\d+)\s*(?:m|min|mins|minutes)\b/);
  let hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  if (minutesMatch) hours += Number(minutesMatch[1]) / 60;
  hours = Math.round(hours * 100) / 100;
  if (!hours) {
    return { error: 'Tell me how long — e.g. “log 1.5h on the Acme MSA for reviewing the cap”.' };
  }

  const workDate = new Date(now);
  if (/\byesterday\b/.test(text)) workDate.setDate(workDate.getDate() - 1);

  const matter = findMatterInText(text, items);

  let category = CATEGORY_KEYWORDS.find(({ pattern }) => pattern.test(text))?.key ?? null;
  if (!category) category = matter ? 'client' : 'client';

  const narrativeMatch = message.match(/\bfor\s+(.+)$/i);
  let narrative = narrativeMatch ? narrativeMatch[1].trim() : '';
  narrative = narrative.replace(/\s+yesterday$/i, '').trim();

  return {
    memberId,
    cardId: matter?.id ?? null,
    matterTitle: matter?.title ?? null,
    client: matter?.client ?? null,
    category,
    date: isoDate(workDate),
    hours,
    narrative,
  };
}

function describeWeekTime(timeEntries, memberId, now) {
  const weekStart = isoDate(startOfWeek(now));
  const mine = filterEntries(timeEntries ?? [], { memberId, from: weekStart });
  if (mine.length === 0) {
    return 'You have no time logged this week yet. Say something like “log 1.5h on the Acme MSA for reviewing the cap” and I will record it.';
  }
  const split = billableSplit(mine);
  const byCategory = [...totalsBy(mine, (e) => e.category).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, hrs]) => `• ${categoryLabel(key)}: ${hrs}h`)
    .join('\n');
  const gaps = unloggedWeekdays(timeEntries ?? [], { memberId, now });
  const gapNote = gaps.length
    ? `\nNothing is logged for ${gaps.join(', ')} — say “log 2h on … yesterday” to backfill.`
    : '';
  return `This week you have logged ${split.total}h (${split.billablePct}% billable):\n${byCategory}${gapNote}`;
}

// Pure and synchronous so it is unit-testable; `getAgentReply` wraps it.
export function getAgentReplyText(message, { items, memberId, timeEntries = [], now = new Date() }) {
  const text = (message ?? '').toLowerCase();
  const member = TEAM_MEMBERS.find((m) => m.id === memberId);
  const { mine, grouped } = summarise(items, memberId, now);
  const statusChecks = getStatusCheckCards(items);

  if (/\b(hello|hi|hey|good (morning|afternoon|evening))\b/.test(text)) {
    return `Hello${member ? ` ${member.name}` : ''}. You have ${mine.length} matter${mine.length === 1 ? '' : 's'} on your plate${statusChecks.length ? ` and ${statusChecks.length} status check${statusChecks.length === 1 ? '' : 's'} pending` : ''}. Ask me about due dates, waiting matters, or your workload.`;
  }

  if (/\b(status check|flagged|stalled)/.test(text)) {
    if (statusChecks.length === 0) {
      return 'No matters are flagged for a status check right now.';
    }
    return `${statusChecks.length} matter${statusChecks.length === 1 ? ' needs' : 's need'} a status check:\n${listCards(statusChecks)}\nOpen a flagged matter to reassign it, keep it waiting, or archive it.`;
  }

  if (/\b(time|timesheet|hours|logged|billable|utilisation|utilization)\b/.test(text)) {
    return describeWeekTime(timeEntries, memberId, now);
  }

  if (/\b(waiting|blocked|response)\b/.test(text)) {
    const waiting = items.waiting ?? [];
    if (waiting.length === 0) return 'Nothing is sitting in Waiting Response.';
    return `${waiting.length} matter${waiting.length === 1 ? ' is' : 's are'} in Waiting Response:\n${listCards(waiting)}`;
  }

  if (/\b(overdue|late)\b/.test(text)) {
    if (grouped.overdue.length === 0) return 'Nothing of yours is overdue. Nice.';
    return `Overdue:\n${listCards(grouped.overdue)}`;
  }

  if (/\b(today|due|deadline|calendar|schedule|plan)\b/.test(text)) {
    const parts = [];
    if (grouped.overdue.length) parts.push(`Overdue:\n${listCards(grouped.overdue)}`);
    if (grouped.today.length) parts.push(`Due today:\n${listCards(grouped.today)}`);
    if (grouped.week.length) parts.push(`Due in the next 7 days:\n${listCards(grouped.week)}`);
    if (parts.length === 0) return 'Nothing is due today or in the next 7 days for you.';
    return parts.join('\n\n');
  }

  if (/\b(archive|done|completed|finished)\b/.test(text)) {
    const archived = items.archive ?? [];
    return archived.length === 0
      ? 'The archive is empty.'
      : `${archived.length} matter${archived.length === 1 ? '' : 's'} in the archive:\n${listCards(archived)}`;
  }

  if (/\b(my|mine|workload|matters|cards)\b/.test(text)) {
    if (mine.length === 0) return 'You have no matters assigned right now.';
    return `Your matters (${mine.length}):\n${listCards(mine)}`;
  }

  const total = activeCards(items).length;
  return `The board has ${total} active matter${total === 1 ? '' : 's'}${statusChecks.length ? `, ${statusChecks.length} of which need${statusChecks.length === 1 ? 's' : ''} a status check` : ''}. Try asking: “what's due this week?”, “how much time have I logged?”, or say “log 1.5h on the Acme MSA for reviewing the cap”.`;
}

// One agent turn: commands first (they have effects), then read-only Q&A.
// Returns { text, timeEntry } — `timeEntry` is set when the message logged
// time and the caller should append it to the ledger.
export function runAgentTurn(message, context) {
  const logResult = parseLogCommand(message, context);
  if (logResult?.error) {
    return { text: logResult.error, timeEntry: null };
  }
  if (logResult) {
    const where = logResult.matterTitle ? ` on “${logResult.matterTitle}”` : '';
    const note = logResult.narrative ? ` — ${logResult.narrative}` : '';
    return {
      text: `Logged ${logResult.hours}h of ${categoryLabel(logResult.category)}${where} for ${logResult.date}${note}. It's on your timesheet.`,
      timeEntry: logResult,
    };
  }
  return { text: getAgentReplyText(message, context), timeEntry: null };
}

export async function getAgentReply(message, context) {
  // Placeholder transport: local rules over the live board and ledger. Swap
  // this body for a call to the real agent endpoint when it exists.
  const result = runAgentTurn(message, context);
  await new Promise((resolve) => setTimeout(resolve, 350 + Math.random() * 400));
  return result;
}

export function getColumnTitle(columnId) {
  return COLUMN_TITLES[columnId] ?? columnId;
}

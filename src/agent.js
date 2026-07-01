// Personal agent for My Command Centre.
//
// `getAgentReply` is the single integration seam: today it answers from a
// local, rules-based reading of the board; when a real agent endpoint exists,
// replace the body of `getAgentReply` with a network call and keep the
// signature. Everything the UI knows about the agent goes through here.

import { COLUMN_TITLES, TEAM_MEMBERS, getStatusCheckCards } from './board.js';

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

// Pure and synchronous so it is unit-testable; `getAgentReply` wraps it.
export function getAgentReplyText(message, { items, memberId, now = new Date() }) {
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

  const total = Object.entries(items)
    .filter(([column]) => column !== 'archive')
    .reduce((sum, [, cards]) => sum + cards.length, 0);
  return `The board has ${total} active matter${total === 1 ? '' : 's'}${statusChecks.length ? `, ${statusChecks.length} of which need${statusChecks.length === 1 ? 's' : ''} a status check` : ''}. Try asking: “what's due this week?”, “what am I waiting on?”, or “show my matters”.`;
}

export async function getAgentReply(message, context) {
  // Placeholder transport: local rules over the live board. Swap this body
  // for a call to the real agent endpoint when it exists.
  const reply = getAgentReplyText(message, context);
  await new Promise((resolve) => setTimeout(resolve, 350 + Math.random() * 400));
  return reply;
}

export function getColumnTitle(columnId) {
  return COLUMN_TITLES[columnId] ?? columnId;
}

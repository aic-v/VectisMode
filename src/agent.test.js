import { describe, it, expect } from 'vitest';
import {
  classifyDueDate,
  getAgentReplyText,
  getCardsForMember,
  parseDueDate,
  parseLogCommand,
  runAgentTurn,
} from './agent.js';

const NOW = new Date('2026-06-27T10:00:00');

const makeBoard = () => ({
  'user-1': [
    { id: 'c1', title: 'MSA review', status: 'Reviewing', dueDate: 'Jun 27, 2026', owner: 'Partner A' },
    { id: 'c2', title: 'Handbook', status: 'Drafting', dueDate: 'Jul 20, 2026', owner: 'Partner A' },
  ],
  'user-2': [
    { id: 'c3', title: 'DPA', status: 'Research and Planning', dueDate: 'May 22, 2026', owner: 'Partner B' },
  ],
  'user-3': [],
  'user-4': [],
  waiting: [
    { id: 'c4', title: 'Counsel response', status: 'Status Check', dueDate: null, owner: 'Partner A' },
  ],
  available: [
    { id: 'c5', title: 'Terms of Service', status: 'Not Started', dueDate: null, owner: null },
  ],
  archive: [],
});

describe('parseDueDate', () => {
  it('parses the sample date format', () => {
    expect(parseDueDate('May 25, 2026')).toBeInstanceOf(Date);
  });

  it('returns null for empty or invalid input', () => {
    expect(parseDueDate(null)).toBeNull();
    expect(parseDueDate('not a date')).toBeNull();
  });
});

describe('classifyDueDate', () => {
  it('classifies relative to now', () => {
    expect(classifyDueDate('Jun 26, 2026', NOW)).toBe('overdue');
    expect(classifyDueDate('Jun 27, 2026', NOW)).toBe('today');
    expect(classifyDueDate('Jul 02, 2026', NOW)).toBe('week');
    expect(classifyDueDate('Aug 01, 2026', NOW)).toBe('later');
    expect(classifyDueDate(null, NOW)).toBe('none');
  });
});

describe('getCardsForMember', () => {
  it('includes the member column plus owned cards in waiting/available, deduped', () => {
    const cards = getCardsForMember(makeBoard(), 'user-1');
    expect(cards.map((c) => c.id)).toEqual(['c1', 'c2', 'c4']);
  });

  it('returns only the column for a member with no owned strays', () => {
    const cards = getCardsForMember(makeBoard(), 'user-2');
    expect(cards.map((c) => c.id)).toEqual(['c3']);
  });
});

describe('getAgentReplyText', () => {
  const context = { items: makeBoard(), memberId: 'user-1', now: NOW };

  it('greets by name with a workload summary', () => {
    const reply = getAgentReplyText('hello', context);
    expect(reply).toContain('Partner A');
    expect(reply).toContain('3 matters');
  });

  it('reports status checks', () => {
    const reply = getAgentReplyText('any status checks?', context);
    expect(reply).toContain('Counsel response');
  });

  it('reports what is due', () => {
    const reply = getAgentReplyText("what's due this week?", context);
    expect(reply).toContain('Due today');
    expect(reply).toContain('MSA review');
  });

  it('lists my matters', () => {
    const reply = getAgentReplyText('show my matters', context);
    expect(reply).toContain('MSA review');
    expect(reply).toContain('Handbook');
  });

  it('falls back to a board summary with suggestions', () => {
    const reply = getAgentReplyText('xyzzy', context);
    expect(reply).toContain('active matter');
    expect(reply).toContain('Try asking');
  });

  it('summarises the week when asked about time', () => {
    const timeEntries = [
      { id: 't1', memberId: 'user-1', date: '2026-06-25', hours: 2, category: 'client', narrative: '', billable: true, cardId: null, matterTitle: null, client: null, loggedAt: null },
      { id: 't2', memberId: 'user-1', date: '2026-06-26', hours: 1, category: 'bd', narrative: '', billable: false, cardId: null, matterTitle: null, client: null, loggedAt: null },
    ];
    const reply = getAgentReplyText('how much time have I logged?', { ...context, timeEntries });
    expect(reply).toContain('3h');
    expect(reply).toContain('Client Work');
    expect(reply).toContain('Business Development');
  });
});

describe('parseLogCommand', () => {
  const context = { items: makeBoard(), memberId: 'user-1', now: new Date('2026-06-27T10:00:00') };

  it('returns null for non-log messages', () => {
    expect(parseLogCommand('what is due today?', context)).toBeNull();
  });

  it('parses hours, matter, category, and narrative', () => {
    const entry = parseLogCommand('log 1.5h on the MSA review for checking the liability cap', context);
    expect(entry).toMatchObject({
      memberId: 'user-1',
      hours: 1.5,
      cardId: 'c1',
      matterTitle: 'MSA review',
      category: 'client',
      date: '2026-06-27',
      narrative: 'checking the liability cap',
    });
  });

  it('understands minutes, yesterday, and category keywords', () => {
    const entry = parseLogCommand('log 45m of business development yesterday', context);
    expect(entry).toMatchObject({
      hours: 0.75,
      category: 'bd',
      date: '2026-06-26',
      cardId: null,
    });
  });

  it('asks for a duration when none is given', () => {
    expect(parseLogCommand('log the acme call', context)).toHaveProperty('error');
  });
});

describe('runAgentTurn', () => {
  const context = { items: makeBoard(), memberId: 'user-1', timeEntries: [], now: new Date('2026-06-27T10:00:00') };

  it('returns a confirmation and the entry for a log command', () => {
    const result = runAgentTurn('log 2h on the Handbook for drafting the leave policy', context);
    expect(result.timeEntry).toMatchObject({ hours: 2, cardId: 'c2' });
    expect(result.text).toContain('Logged 2h');
    expect(result.text).toContain('Handbook');
  });

  it('returns plain text with no entry for questions', () => {
    const result = runAgentTurn('what am I waiting on?', context);
    expect(result.timeEntry).toBeNull();
    expect(typeof result.text).toBe('string');
  });
});

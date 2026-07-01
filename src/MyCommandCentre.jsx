import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  SendHorizontal,
  Sparkles,
} from 'lucide-react';
import { TEAM_MEMBERS, getStatusCheckCards } from './board.js';
import {
  classifyDueDate,
  getAgentReply,
  getCardsForMember,
  parseDueDate,
} from './agent.js';
import { CHAT_STORAGE_KEY, loadJSON, saveJSON } from './storage.js';

const AGENDA_GROUPS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No due date' },
];

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function buildMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  // Monday-first offset: JS getDay() is 0 = Sunday.
  const leading = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function MatterRow({ card, onCardOpen, alert }) {
  return (
    <button
      type="button"
      className={`agenda-item ${alert ? 'agenda-item--alert' : ''}`}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onCardOpen(card.id, {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }}
    >
      <span className="agenda-item-title">{card.title}</span>
      <span className="agenda-item-meta">
        {card.client ? <span>{card.client}</span> : null}
        {card.dueDate ? <span>Due {card.dueDate}</span> : null}
        {alert ? <span className="agenda-item-flag">Status check</span> : null}
      </span>
    </button>
  );
}

function DayPlanner({ items, memberId, onCardOpen }) {
  const now = new Date();
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );

  const myCards = useMemo(() => getCardsForMember(items, memberId), [items, memberId]);
  const statusChecks = useMemo(() => getStatusCheckCards(items), [items]);

  const grouped = { overdue: [], today: [], week: [], later: [], none: [] };
  for (const card of myCards) {
    // Flagged cards already surface in the alerts section above the agenda.
    if (card.status === 'Status Check') continue;
    grouped[classifyDueDate(card.dueDate, now)].push(card);
  }

  const dueByDay = useMemo(() => {
    const map = new Map();
    for (const card of myCards) {
      const due = parseDueDate(card.dueDate);
      if (!due) continue;
      const key = dayKey(due);
      map.set(key, [...(map.get(key) ?? []), card]);
    }
    return map;
  }, [myCards]);

  const cells = buildMonthGrid(monthCursor);
  const monthLabel = monthCursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const todayKey = dayKey(now);

  const shiftMonth = (delta) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="cutout-panel my-panel my-planner">
      <div className="panel-header">
        <div className="panel-icon"><CalendarDays size={18} /></div>
        <div className="panel-title">
          Your day
          <span className="panel-subtitle">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div className="panel-count">{myCards.length}</div>
      </div>

      <div className="my-planner-scroll">
        {statusChecks.length > 0 ? (
          <div className="planner-section planner-alerts">
            <div className="details-section-label planner-alert-label">
              <AlertTriangle size={13} />
              Status checks
            </div>
            {statusChecks.map((card) => (
              <MatterRow key={card.id} card={card} onCardOpen={onCardOpen} alert />
            ))}
          </div>
        ) : null}

        {AGENDA_GROUPS.map(({ key, label }) =>
          grouped[key].length > 0 ? (
            <div className="planner-section" key={key}>
              <div className="details-section-label">{label}</div>
              {grouped[key].map((card) => (
                <MatterRow key={card.id} card={card} onCardOpen={onCardOpen} />
              ))}
            </div>
          ) : null,
        )}

        {myCards.length === 0 ? (
          <p className="planner-empty">No matters assigned to you yet. Switch to the Team view to pick something up.</p>
        ) : null}

        <div className="planner-section">
          <div className="calendar-header">
            <div className="details-section-label">{monthLabel}</div>
            <div className="calendar-nav">
              <button type="button" className="icon-button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={15} />
              </button>
              <button type="button" className="icon-button" aria-label="Next month" onClick={() => shiftMonth(1)}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          <div className="calendar-grid" role="grid" aria-label={`Calendar for ${monthLabel}`}>
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="calendar-weekday">{label}</div>
            ))}
            {cells.map((date, idx) => {
              if (!date) return <div key={`pad-${idx}`} className="calendar-day calendar-day--pad" />;
              const key = dayKey(date);
              const due = dueByDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`calendar-day ${key === todayKey ? 'calendar-day--today' : ''} ${due.length ? 'calendar-day--due' : ''}`}
                  title={due.length ? due.map((card) => card.title).join('\n') : undefined}
                >
                  <span>{date.getDate()}</span>
                  {due.length ? <span className="calendar-dot" aria-label={`${due.length} matters due`} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentChat({ items, memberId }) {
  const [messages, setMessages] = useState(() => {
    const stored = loadJSON(CHAT_STORAGE_KEY);
    return Array.isArray(stored) ? stored : [];
  });
  const [draft, setDraft] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    saveJSON(CHAT_STORAGE_KEY, messages);
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isReplying]);

  const send = async () => {
    const text = draft.trim();
    if (!text || isReplying) return;
    setDraft('');
    setMessages((prev) => [...prev, { role: 'user', text, at: new Date().toISOString() }]);
    setIsReplying(true);
    try {
      const reply = await getAgentReply(text, { items, memberId, now: new Date() });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, at: new Date().toISOString() }]);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="cutout-panel my-panel agent-chat">
      <div className="panel-header">
        <div className="panel-icon"><Bot size={18} /></div>
        <div className="panel-title">
          Vectis Assistant
          <span className="panel-subtitle">Personal agent · preview</span>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <Sparkles size={16} />
            <p>
              Ask about your day — “what's due this week?”, “what am I waiting on?”,
              “any status checks?”. Replies are generated locally for now; the live
              agent integration is coming.
            </p>
          </div>
        ) : null}
        {messages.map((message, idx) => (
          <div
            key={`${message.at}-${idx}`}
            className={`chat-bubble ${message.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'}`}
          >
            {message.text}
          </div>
        ))}
        {isReplying ? (
          <div className="chat-bubble chat-bubble--assistant chat-bubble--typing" aria-label="Assistant is typing">
            <span /><span /><span />
          </div>
        ) : null}
      </div>

      <form
        className="chat-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          className="form-input chat-input"
          aria-label="Message the assistant"
          placeholder="Ask your assistant…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="chat-send" aria-label="Send message" disabled={!draft.trim() || isReplying}>
          <SendHorizontal size={16} />
        </button>
      </form>
    </div>
  );
}

export default function MyCommandCentre({ items, memberId, onMemberChange, onCardOpen }) {
  return (
    <div className="my-centre">
      <div className="my-centre-toolbar">
        <label className="identity-picker">
          <span className="details-section-label">Viewing as</span>
          <select
            className="form-input identity-select"
            value={memberId}
            onChange={(event) => onMemberChange(event.target.value)}
          >
            {TEAM_MEMBERS.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="my-centre-grid">
        <DayPlanner items={items} memberId={memberId} onCardOpen={onCardOpen} />
        <AgentChat items={items} memberId={memberId} />
      </div>
    </div>
  );
}

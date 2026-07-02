import { useCallback, useEffect, useState } from 'react';
import { Download, Timer, Users, User, X } from 'lucide-react';
import { TEAM_MEMBERS } from './board.js';
import {
  WORK_CATEGORIES,
  applyShareLevels,
  billableSplit,
  categoryLabel,
  entriesToCsv,
  filterEntries,
  isoDate,
  startOfWeek,
  sumHours,
} from './time.js';

const PERIODS = [
  { key: 'week', label: 'This week' },
  { key: 'lastweek', label: 'Last week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

const GROUPINGS = [
  { key: 'date', label: 'Date' },
  { key: 'matter', label: 'Matter' },
  { key: 'client', label: 'Client' },
  { key: 'category', label: 'Category' },
];

function memberName(memberId) {
  return TEAM_MEMBERS.find((m) => m.id === memberId)?.name ?? memberId;
}

function periodRange(period, now) {
  if (period === 'week') {
    return { from: isoDate(startOfWeek(now)) };
  }
  if (period === 'lastweek') {
    const start = startOfWeek(now);
    const lastStart = new Date(start);
    lastStart.setDate(start.getDate() - 7);
    const lastEnd = new Date(start);
    lastEnd.setDate(start.getDate() - 1);
    return { from: isoDate(lastStart), to: isoDate(lastEnd) };
  }
  if (period === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: isoDate(first) };
  }
  return {};
}

function groupKeyFor(entry, groupBy) {
  if (groupBy === 'matter') return entry.matterTitle ?? 'No matter';
  if (groupBy === 'client') return entry.client ?? 'No client';
  if (groupBy === 'category') return categoryLabel(entry.category);
  return entry.date;
}

function groupEntries(entries, groupBy) {
  const groups = new Map();
  const sorted = [...entries].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  for (const entry of sorted) {
    const key = groupKeyFor(entry, groupBy);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.entries()].map(([label, groupedEntries]) => ({
    label,
    entries: groupedEntries,
    subtotal: sumHours(groupedEntries),
  }));
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function EntryRow({ entry, onUpdateEntry, onRemoveEntry }) {
  return (
    <li className="time-entry-row">
      <span className="time-entry-date">{entry.date}</span>
      <span className="time-entry-member">{memberName(entry.memberId)}</span>
      <span className="time-entry-matter">
        {entry.matterTitle ?? '—'}
        {entry.client ? <span className="time-entry-client">{entry.client}</span> : null}
      </span>
      <span className="time-entry-category">
        <span className="category-dot" style={{ background: `var(--cat-${entry.category})` }} />
        {categoryLabel(entry.category)}
      </span>
      <input
        className="time-entry-narrative"
        aria-label="Narrative"
        value={entry.narrative}
        placeholder="Add narrative"
        onChange={(event) => onUpdateEntry(entry.id, { narrative: event.target.value })}
      />
      <input
        className="time-entry-hours"
        aria-label="Hours"
        type="number"
        min="0.1"
        step="0.1"
        value={entry.hours}
        onChange={(event) => onUpdateEntry(entry.id, { hours: Number(event.target.value) })}
      />
      <label className="time-entry-billable" title="Billable">
        <input
          type="checkbox"
          checked={entry.billable}
          onChange={(event) => onUpdateEntry(entry.id, { billable: event.target.checked })}
        />
        <span>Billable</span>
      </label>
      <button
        type="button"
        className="icon-button time-entry-delete"
        aria-label="Delete time entry"
        onClick={() => onRemoveEntry(entry.id)}
      >
        <X size={15} />
      </button>
    </li>
  );
}

function getTimesheetTarget() {
  const width = Math.min(1020, Math.max(340, window.innerWidth - 64));
  const height = Math.min(680, Math.max(440, window.innerHeight - 80));
  return {
    top: Math.max(32, (window.innerHeight - height) / 2),
    left: Math.max(32, (window.innerWidth - width) / 2),
    width,
    height,
  };
}

export default function TimesheetOverlay({
  entries,
  currentMemberId,
  shareLevelFor,
  initialCardId,
  cardTitle,
  onClose,
  onUpdateEntry,
  onRemoveEntry,
}) {
  const [expanded, setExpanded] = useState(false);
  const [target] = useState(getTimesheetTarget);
  const [scope, setScope] = useState('me');
  const [period, setPeriod] = useState('week');
  const [groupBy, setGroupBy] = useState('date');
  const [matterOnly, setMatterOnly] = useState(Boolean(initialCardId));

  const closeOverlay = useCallback(() => {
    setExpanded(false);
    window.setTimeout(onClose, 480);
  }, [onClose]);

  useEffect(() => {
    const expandFrame = window.requestAnimationFrame(() => setExpanded(true));
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !(event.target instanceof HTMLInputElement)) {
        closeOverlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(expandFrame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeOverlay]);

  const now = new Date();
  const range = periodRange(period, now);

  let base = filterEntries(entries, {
    ...range,
    cardId: matterOnly && initialCardId ? initialCardId : undefined,
  });

  let totalsOnly = [];
  let privateMemberCount = 0;
  if (scope === 'me') {
    base = filterEntries(base, { memberId: currentMemberId });
  } else {
    const shared = applyShareLevels(base, shareLevelFor);
    base = shared.visible;
    totalsOnly = shared.totalsOnly;
    privateMemberCount = shared.privateMemberCount;
  }

  const groups = groupEntries(base, groupBy);
  const split = billableSplit(base);
  const grandTotal =
    Math.round((split.total + totalsOnly.reduce((sum, t) => sum + t.hours, 0)) * 100) / 100;

  const exportCsv = () => {
    const csv = entriesToCsv(base, { memberName });
    const stamp = isoDate(now);
    downloadCsv(csv, `vectis-timesheet-${scope}-${period}-${stamp}.csv`);
  };

  const frame = expanded
    ? target
    : { top: window.innerHeight - 80, left: window.innerWidth - 200, width: 160, height: 40 };

  return (
    <div className={`projection-layer ${expanded ? 'is-open' : ''}`}>
      <button
        type="button"
        className="projection-backdrop"
        aria-label="Close timesheet"
        onClick={closeOverlay}
      />
      <section
        className="focused-card"
        aria-label="Timesheet"
        style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="focused-card-panel">
          <div className="details-header">
            <div>
              <div className="details-kicker">Timesheet</div>
              <h2>{scope === 'me' ? memberName(currentMemberId) : 'Firm'}</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close timesheet" onClick={closeOverlay}>
              <X size={18} />
            </button>
          </div>

          <div className="timesheet-toolbar">
            <div className="timesheet-scope" role="group" aria-label="Timesheet scope">
              <button
                type="button"
                className={scope === 'me' ? 'is-active' : ''}
                aria-pressed={scope === 'me'}
                onClick={() => setScope('me')}
              >
                <User size={13} /> Me
              </button>
              <button
                type="button"
                className={scope === 'firm' ? 'is-active' : ''}
                aria-pressed={scope === 'firm'}
                onClick={() => setScope('firm')}
              >
                <Users size={13} /> Firm
              </button>
            </div>

            <label className="timesheet-filter">
              <span>Period</span>
              <select className="form-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <label className="timesheet-filter">
              <span>Group by</span>
              <select className="form-input" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                {GROUPINGS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            {initialCardId ? (
              <label className="timesheet-filter timesheet-matter-filter">
                <input
                  type="checkbox"
                  checked={matterOnly}
                  onChange={(event) => setMatterOnly(event.target.checked)}
                />
                <span>Only “{cardTitle ?? 'this matter'}”</span>
              </label>
            ) : null}

            <button type="button" className="timesheet-export" onClick={exportCsv} disabled={base.length === 0}>
              <Download size={14} />
              Export CSV
            </button>
          </div>

          {groups.length === 0 && totalsOnly.length === 0 ? (
            <div className="details-section archive-empty">
              <div className="details-section-label">No time entries</div>
              <p>
                Log time from a matter's work-log form, the quick-add row in the Matter
                view, or by telling the assistant “log 1.5h on the Acme MSA”.
              </p>
            </div>
          ) : (
            <div className="details-section timesheet-groups">
              {groups.map((group) => (
                <div key={group.label} className="timesheet-group">
                  <div className="timesheet-group-header">
                    <span>{group.label}</span>
                    <span>{group.subtotal}h</span>
                  </div>
                  <ul className="time-entry-list">
                    {group.entries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        onUpdateEntry={onUpdateEntry}
                        onRemoveEntry={onRemoveEntry}
                      />
                    ))}
                  </ul>
                </div>
              ))}

              {totalsOnly.length > 0 ? (
                <div className="timesheet-group">
                  <div className="timesheet-group-header">
                    <span>Shared as totals only</span>
                  </div>
                  <ul className="time-entry-list">
                    {totalsOnly.map(({ memberId, hours }) => (
                      <li key={memberId} className="time-entry-row time-entry-row--totals">
                        <span className="time-entry-member">{memberName(memberId)}</span>
                        <span className="time-entry-totals-note">shares daily totals only</span>
                        <span className="time-entry-hours-static">{hours}h</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {privateMemberCount > 0 ? (
                <p className="timesheet-private-note">
                  {privateMemberCount} member{privateMemberCount === 1 ? ' keeps' : 's keep'} their
                  time private — not included above.
                </p>
              ) : null}
            </div>
          )}

          <div className="timesheet-footer">
            <span className="timesheet-total">
              <Timer size={14} />
              {grandTotal}h total
            </span>
            <span className="timesheet-billable">{split.billablePct}% billable</span>
            <span className="timesheet-legend">
              {WORK_CATEGORIES.map(({ key, label }) => (
                <span key={key} className="timesheet-legend-item">
                  <span className="category-dot" style={{ background: `var(--cat-${key})` }} />
                  {label}
                </span>
              ))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

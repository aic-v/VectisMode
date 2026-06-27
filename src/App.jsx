import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  User,
  Users,
  Clock,
  Inbox,
  GripVertical,
  CalendarDays,
  ExternalLink,
  FolderOpen,
  Timer,
  X,
  Archive,
  Circle,
  Compass,
  Pencil,
  Eye,
  CheckCircle2,
  Building2,
  UserCheck
} from 'lucide-react';
import './App.css';
import {
  CLIENTS,
  COLUMN_TITLES,
  INITIAL_ITEMS,
  RESTORE_COLUMNS,
  STATUS_KEYS,
  appendWorkLogEntry,
  applyDragLanding,
  findContainer as findContainerIn,
  getArchivedCards,
  moveCardAcross,
  reorderWithin,
  setCardStatus,
  updateCard as updateCardIn,
} from './board.js';

const STATUS_META = {
  'Not Started': { Icon: Circle },
  'Research and Planning': { Icon: Compass },
  'Drafting': { Icon: Pencil },
  'Reviewing': { Icon: Eye },
  'Waiting': { Icon: Clock },
  'Done': { Icon: CheckCircle2 },
};

function hasWorkLogContent(entry) {
  if (!entry) return false;
  return Boolean(
    entry.description ||
    entry.nextSteps ||
    entry.startDate ||
    entry.endDate ||
    (entry.hours !== null && entry.hours !== undefined && !Number.isNaN(entry.hours)),
  );
}

function formatLoggedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function describeHistoryEvent(event) {
  if (!event) return '';
  if (event.kind === 'status') {
    const from = event.from ?? 'Not set';
    const to = event.to ?? 'Not set';
    return `Status: ${from} → ${to}`;
  }
  if (event.kind === 'column') {
    const from = COLUMN_TITLES[event.from] ?? event.from ?? 'Unknown';
    const to = COLUMN_TITLES[event.to] ?? event.to ?? 'Unknown';
    return `Moved: ${from} → ${to}`;
  }
  return '';
}

function CardWidgets({ status, dueDate }) {
  const StatusIcon = (STATUS_META[status] ?? { Icon: Circle }).Icon;
  return (
    <div className="card-widgets">
      <div className="card-widget">
        <StatusIcon size={14} />
        <div>
          <span>Status</span>
          <strong>{status ?? 'Not set'}</strong>
        </div>
      </div>
      <div className="card-widget">
        <CalendarDays size={14} />
        <div>
          <span>Due date</span>
          <strong>{dueDate ?? 'No due date'}</strong>
        </div>
      </div>
    </div>
  );
}

// --- Sortable Card Component ---
function SortableCard({ id, card, isDraggingOverlay, isProjectingSource, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverlay = isDraggingOverlay;

  const dragListeners = isProjectingSource ? {} : listeners;

  const handleOpen = (event) => {
    if (isProjectingSource || isDraggingOverlay) {
      return;
    }

    const sourceCard = event.currentTarget.closest('.card-scene');
    const sourceRect = sourceCard?.getBoundingClientRect();

    onOpen?.(
      id,
      sourceRect
        ? {
            top: sourceRect.top,
            left: sourceRect.left,
            width: sourceRect.width,
            height: sourceRect.height,
          }
        : getDetailsProjectionTarget(),
    );
  };

  return (
    <div
      ref={setNodeRef}
      data-card-id={id}
      style={style}
      className={`card-scene ${isDragging && !isOverlay ? 'dragging-placeholder' : ''} ${isOverlay ? 'dragging' : ''} ${isProjectingSource ? 'projecting-source' : ''}`}
      {...attributes}
    >
      <div className="card-inner">
        <div className="card-front" {...dragListeners} onClick={handleOpen}>
          <div className="card-drag-handle">
            <GripVertical size={16} />
          </div>
          <div className="card-heading">
            <div className="card-title">{card.title}</div>
            {card.client ? <div className="card-subtitle">{card.client}</div> : null}
          </div>
          <CardWidgets status={card.status} dueDate={card.dueDate} />
        </div>
      </div>
    </div>
  );
}

function WorkLogForm({ cardId, cardTitle, cardStatus, onSave, onCancel }) {
  const [status, setStatus] = useState(cardStatus ?? '');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState('');
  const [nextSteps, setNextSteps] = useState('');

  const descriptionId = `worklog-description-${cardId}`;
  const startDateId = `worklog-start-${cardId}`;
  const endDateId = `worklog-end-${cardId}`;
  const hoursId = `worklog-hours-${cardId}`;
  const nextStepsId = `worklog-next-${cardId}`;
  const statusId = `worklog-status-${cardId}`;

  return (
    <div
      className="card-back work-log-form"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="work-log-header">
        <div className="work-log-header-text">
          <div className="details-kicker">Log work</div>
          {cardTitle ? <h2>{cardTitle}</h2> : null}
        </div>
        {onCancel ? (
          <button
            type="button"
            className="icon-button"
            aria-label="Discard and return card to its origin column"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="form-group">
        <label className="details-section-label" htmlFor={statusId}>Status</label>
        <select
          id={statusId}
          className="form-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Not set</option>
          {STATUS_KEYS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="details-section-label" htmlFor={descriptionId}>Description of work completed</label>
        <textarea
          id={descriptionId}
          className="form-textarea"
          placeholder="E.g., Reviewed standard MSA clauses..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="details-section-label" htmlFor={startDateId}>Start date</label>
          <input
            id={startDateId}
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="details-section-label" htmlFor={endDateId}>End date</label>
          <input
            id={endDateId}
            type="date"
            className="form-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="details-section-label" htmlFor={hoursId}>Est. time spent (hrs)</label>
        <input
          id={hoursId}
          type="number"
          step="0.5"
          className="form-input"
          placeholder="1.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="details-section-label" htmlFor={nextStepsId}>Next steps</label>
        <textarea
          id={nextStepsId}
          className="form-textarea"
          placeholder="1. Send revised draft to counterparty&#10;2. Follow up on liability cap..."
          style={{ minHeight: '80px' }}
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
        />
      </div>

      {onSave ? (
        <button
          className="btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            onSave({
              status,
              entry: {
                description: description.trim(),
                startDate: startDate || null,
                endDate: endDate || null,
                hours: hours === '' ? null : Number(hours),
                nextSteps: nextSteps.trim(),
                status,
                loggedAt: new Date().toISOString(),
              },
            });
          }}
        >
          Save &amp; Complete
        </button>
      ) : null}
    </div>
  );
}

function getProjectionTarget() {
  if (typeof window === 'undefined') {
    return { top: 48, left: 48, width: 520, height: 520 };
  }

  const width = Math.min(560, Math.max(320, window.innerWidth - 64));
  const height = Math.min(560, Math.max(420, window.innerHeight - 80));

  return {
    top: Math.max(32, (window.innerHeight - height) / 2),
    left: Math.max(32, (window.innerWidth - width) / 2),
    width,
    height,
  };
}

function getDetailsProjectionTarget() {
  if (typeof window === 'undefined') {
    return { top: 48, left: 48, width: 720, height: 560 };
  }

  const width = Math.min(760, Math.max(340, window.innerWidth - 64));
  const height = Math.min(620, Math.max(440, window.innerHeight - 80));

  return {
    top: Math.max(32, (window.innerHeight - height) / 2),
    left: Math.max(32, (window.innerWidth - width) / 2),
    width,
    height,
  };
}

function ProjectedCard({ card, originRect: initialOriginRect, cancelOriginRect, onSave, onCancel, onCancelStart }) {
  const [originRect, setOriginRect] = useState(initialOriginRect);
  const [expanded, setExpanded] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [target] = useState(getProjectionTarget);

  useEffect(() => {
    const expandFrame = window.requestAnimationFrame(() => {
      setExpanded(true);
    });
    const flipTimer = window.setTimeout(() => {
      setFlipped(true);
    }, 140);

    return () => {
      window.cancelAnimationFrame(expandFrame);
      window.clearTimeout(flipTimer);
    };
  }, [card.id]);

  const handleSave = (payload) => {
    setFlipped(false);
    setExpanded(false);
    window.setTimeout(() => onSave(payload), 700);
  };

  const handleCancel = () => {
    if (onCancelStart) onCancelStart();
    if (cancelOriginRect) setOriginRect(cancelOriginRect);
    setFlipped(false);
    setExpanded(false);
    window.setTimeout(onCancel, 700);
  };

  const frame = expanded ? target : originRect;

  return (
    <div className={`projection-layer ${expanded ? 'is-open' : ''}`}>
      <div className="projection-backdrop" />
      <div
        className="projected-card"
        style={{
          top: frame.top,
          left: frame.left,
          width: frame.width,
          height: frame.height,
        }}
      >
        <div className={`projected-card-inner ${flipped ? 'is-flipped' : ''}`}>
          <div className="projected-card-face projected-card-front">
            <div className="card-drag-handle">
              <GripVertical size={16} />
            </div>
            <div className="card-heading">
              <div className="card-title">{card.title}</div>
              {card.client ? <div className="card-subtitle">{card.client}</div> : null}
            </div>
            <CardWidgets status={card.status} dueDate={card.dueDate} />
          </div>

          <div className="projected-card-face projected-card-back">
            <WorkLogForm
              cardId={card.id}
              cardTitle={card.title}
              cardStatus={card.status}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FocusedCardDetails({
  card,
  originRect,
  onClose,
  onCardChange,
  onStatusChange,
  pendingStatusChange,
  onPickRestoreColumn,
  onCancelPendingStatus,
}) {
  const [expanded, setExpanded] = useState(false);
  const [target] = useState(getDetailsProjectionTarget);

  const closeDetails = useCallback(() => {
    setExpanded(false);
    window.setTimeout(onClose, 620);
  }, [onClose]);

  useEffect(() => {
    const expandFrame = window.requestAnimationFrame(() => {
      setExpanded(true);
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        const target = event.target;
        const isEditable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement;
        if (isEditable) {
          target.blur();
          return;
        }
        closeDetails();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(expandFrame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [card.id, closeDetails]);

  const frame = expanded ? target : originRect;
  const pendingTo = pendingStatusChange?.cardId === card.id ? pendingStatusChange.toStatus : null;
  const displayedStatus = pendingTo ?? card.status ?? '';
  const StatusIcon = (STATUS_META[displayedStatus] ?? { Icon: Inbox }).Icon;

  const handleField = (field) => (event) => {
    onCardChange(card.id, { [field]: event.target.value });
  };

  const handleStatusChange = (event) => {
    onStatusChange(card.id, event.target.value);
  };

  return (
    <div className={`projection-layer ${expanded ? 'is-open' : ''}`}>
      <button
        type="button"
        className="projection-backdrop"
        aria-label="Close card details"
        onClick={closeDetails}
      />
      <section
        className="focused-card"
        aria-label={`${card.title} details`}
        style={{
          top: frame.top,
          left: frame.left,
          width: frame.width,
          height: frame.height,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="focused-card-panel">
          <div className="details-header">
            <div className="details-header-text">
              <div className="details-kicker">Matter</div>
              <input
                className="details-title-input"
                aria-label="Matter title"
                value={card.title}
                onChange={handleField('title')}
                spellCheck={false}
              />
            </div>
            <button type="button" className="icon-button" aria-label="Close card details" onClick={closeDetails}>
              <X size={18} />
            </button>
          </div>

          <div className="details-meta-grid">
            <label className="details-meta-item">
              <CalendarDays size={16} />
              <div>
                <span>Due date</span>
                <input
                  type="text"
                  className="details-meta-input"
                  value={card.dueDate ?? ''}
                  placeholder="Add due date"
                  onChange={handleField('dueDate')}
                />
              </div>
            </label>
            <label className="details-meta-item">
              <StatusIcon size={16} />
              <div>
                <span>Status</span>
                <select
                  className="details-meta-input details-meta-select"
                  value={displayedStatus}
                  onChange={handleStatusChange}
                >
                  <option value="">Not set</option>
                  {STATUS_KEYS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="details-meta-item">
              <UserCheck size={16} />
              <div>
                <span>Owner</span>
                <input
                  type="text"
                  className="details-meta-input"
                  value={card.owner ?? ''}
                  placeholder="Add owner"
                  onChange={handleField('owner')}
                />
              </div>
            </label>
            <label className="details-meta-item">
              <Users size={16} />
              <div>
                <span>Team</span>
                <input
                  type="text"
                  className="details-meta-input"
                  value={card.team ?? ''}
                  placeholder="Add team"
                  onChange={handleField('team')}
                />
              </div>
            </label>
            <label className="details-meta-item details-meta-item--wide">
              <Building2 size={16} />
              <div>
                <span>Client</span>
                <select
                  className="details-meta-input details-meta-select"
                  value={card.client ?? ''}
                  onChange={handleField('client')}
                >
                  <option value="">Not set</option>
                  {CLIENTS.map((client) => (
                    <option key={client} value={client}>{client}</option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          {pendingTo ? (
            <div className="details-section restore-picker" role="group" aria-label="Choose a destination column">
              <div className="details-section-label">Move to…</div>
              <p className="restore-picker-hint">
                Change status to <strong>{pendingTo || 'Not set'}</strong>. Pick a column to send this matter back to the active board.
              </p>
              <div className="restore-picker-grid">
                {RESTORE_COLUMNS.map((columnKey) => (
                  <button
                    key={columnKey}
                    type="button"
                    className="restore-picker-option"
                    onClick={() => onPickRestoreColumn(card.id, columnKey)}
                  >
                    {COLUMN_TITLES[columnKey]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="restore-picker-cancel"
                onClick={() => onCancelPendingStatus(card.id)}
              >
                Cancel status change
              </button>
            </div>
          ) : null}

          <div className="details-section">
            <label className="details-section-label" htmlFor={`description-${card.id}`}>Task description</label>
            <textarea
              id={`description-${card.id}`}
              className="details-description-input"
              value={card.description ?? card.aiContext ?? ''}
              placeholder="Add a description"
              onChange={handleField('description')}
            />
          </div>

          {Array.isArray(card.workLog) && card.workLog.length > 0 ? (
            <div className="details-section">
              <div className="details-section-label">Work log</div>
              <ul className="work-log-list">
                {card.workLog.map((entry, idx) => (
                  <li key={entry.loggedAt ?? idx} className="work-log-entry">
                    <div className="work-log-entry-meta">
                      <span>{formatLoggedAt(entry.loggedAt)}</span>
                      {entry.hours != null ? <span>{entry.hours} hrs</span> : null}
                      {entry.status ? <span>{entry.status}</span> : null}
                    </div>
                    {entry.description ? <p className="work-log-entry-description">{entry.description}</p> : null}
                    {entry.nextSteps ? (
                      <p className="work-log-entry-next">
                        <strong>Next: </strong>{entry.nextSteps}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(card.history) && card.history.length > 0 ? (
            <div className="details-section">
              <div className="details-section-label">History</div>
              <ul className="history-list">
                {card.history.map((event, idx) => (
                  <li key={`${event.at ?? 'na'}-${idx}`} className="history-entry">
                    <span className="history-entry-time">{formatLoggedAt(event.at)}</span>
                    <span className="history-entry-text">{describeHistoryEvent(event)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="details-footer">
            <a
              className="details-footer-link"
              href={card.timeEntriesUrl ?? '#'}
              onClick={(event) => event.preventDefault()}
            >
              <Timer size={16} />
              Time entries
              <ExternalLink size={13} />
            </a>
            <a
              className="details-footer-link"
              href={card.taskFolderUrl ?? '#'}
              onClick={(event) => event.preventDefault()}
            >
              <FolderOpen size={16} />
              Task folder
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function ArchiveOverlay({ archivedCards, onClose, onCardOpen }) {
  const [expanded, setExpanded] = useState(false);
  const [target] = useState(getDetailsProjectionTarget);

  const closeOverlay = useCallback(() => {
    setExpanded(false);
    window.setTimeout(onClose, 480);
  }, [onClose]);

  useEffect(() => {
    const expandFrame = window.requestAnimationFrame(() => setExpanded(true));

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeOverlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(expandFrame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeOverlay]);

  const frame = expanded
    ? target
    : { top: window.innerHeight - 80, left: window.innerWidth - 200, width: 160, height: 40 };

  const handleArchivedCardClick = (cardId) => (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    closeOverlay();
    window.setTimeout(() => {
      onCardOpen(cardId, {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }, 500);
  };

  return (
    <div className={`projection-layer ${expanded ? 'is-open' : ''}`}>
      <button
        type="button"
        className="projection-backdrop"
        aria-label="Close archive"
        onClick={closeOverlay}
      />
      <section
        className="focused-card"
        aria-label="Archive"
        style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="focused-card-panel">
          <div className="details-header">
            <div>
              <div className="details-kicker">Archive</div>
              <h2>Completed matters</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close archive" onClick={closeOverlay}>
              <X size={18} />
            </button>
          </div>

          {archivedCards.length === 0 ? (
            <div className="details-section archive-empty">
              <div className="details-section-label">No archived matters yet</div>
              <p>Matters set to status <strong>Done</strong> appear here. Open one and change its status to send it back to the active board.</p>
            </div>
          ) : (
            <div className="details-section">
              <div className="details-section-label">{archivedCards.length} archived</div>
              <ul className="archive-list">
                {archivedCards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="archive-list-item"
                      onClick={handleArchivedCardClick(card.id)}
                    >
                      <span className="archive-list-item-title">{card.title}</span>
                      {card.client ? <span className="archive-list-item-subtitle">{card.client}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// --- Card Component for Overlay ---
function CardOverlay({ card }) {
  return (
    <div className="card-scene dragging">
      <div className="card-inner">
        <div className="card-front">
          <div className="card-drag-handle">
            <GripVertical size={16} />
          </div>
          <div className="card-heading">
            <div className="card-title">{card.title}</div>
            {card.client ? <div className="card-subtitle">{card.client}</div> : null}
          </div>
          <CardWidgets status={card.status} dueDate={card.dueDate} />
        </div>
      </div>
    </div>
  );
}

// --- Droppable Container ---
function Container({ id, title, icon, items, count, projectedCardId, onCardOpen }) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div className={`cutout-panel ${isOver ? 'is-over' : ''}`} ref={setNodeRef}>
      <div className="panel-header">
        <div className="panel-icon">{icon}</div>
        <div className="panel-title">{title}</div>
        <div className="panel-count">{count}</div>
      </div>
      <SortableContext
        id={id}
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="card-list">
          {items.map((card) => (
            <SortableCard 
              key={card.id} 
              id={card.id} 
              card={card} 
              isProjectingSource={projectedCardId === card.id}
              onOpen={onCardOpen}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [activeId, setActiveId] = useState(null);
  const flipTimerRef = useRef(null);
  const [commandMode, setCommandMode] = useState('team');
  const suppressCardOpenUntilRef = useRef(0);
  const preDragItemsRef = useRef(null);
  const preDragRectRef = useRef(null);
  
  // Track origin container and projected editor state
  const [draggedFromContainer, setDraggedFromContainer] = useState(null);
  const [projectedCard, setProjectedCard] = useState(null);
  const [focusedCard, setFocusedCard] = useState(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findContainer = useCallback((id) => findContainerIn(items, id), [items]);

  const handleDragStart = (event) => {
    const { active } = event;
    suppressCardOpenUntilRef.current = Date.now() + 500;
    if (flipTimerRef.current) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
    setActiveId(active.id);
    setDraggedFromContainer(findContainer(active.id));
    preDragItemsRef.current = items;
    const sourceEl = document.querySelector(`[data-card-id="${active.id}"]`);
    const rect = sourceEl?.getBoundingClientRect();
    preDragRectRef.current = rect
      ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      : null;

    setProjectedCard(null);
    setFocusedCard(null);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    const overId = over?.id;
    if (!overId || active.id === overId) return;

    const translated = active.rect.current.translated;
    const isBelowOverItem = !!(over && translated && translated.top > over.rect.top + over.rect.height);

    setItems((prev) => moveCardAcross(prev, {
      activeId: active.id,
      overId,
      isBelowOverItem,
    }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    suppressCardOpenUntilRef.current = Date.now() + 500;
    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over?.id);
    const shouldFlip = draggedFromContainer && activeContainer && draggedFromContainer !== activeContainer;

    const finishDrag = () => {
      setActiveId(null);
      setDraggedFromContainer(null);

      if (shouldFlip) {
        flipTimerRef.current = window.setTimeout(() => {
          const sourceCard = document.querySelector(`[data-card-id="${active.id}"]`);
          const sourceRect = sourceCard?.getBoundingClientRect();

          setProjectedCard({
            id: active.id,
            originRect: sourceRect
              ? {
                  top: sourceRect.top,
                  left: sourceRect.left,
                  width: sourceRect.width,
                  height: sourceRect.height,
                }
              : getProjectionTarget(),
            cancelOriginRect: preDragRectRef.current,
          });
          flipTimerRef.current = null;
        }, 90);
      }
    };

    const crossedContainers =
      activeContainer && draggedFromContainer && activeContainer !== draggedFromContainer;

    if (crossedContainers) {
      const fromColumn = draggedFromContainer;
      const now = new Date().toISOString();
      setItems((prev) => applyDragLanding(prev, active.id, { fromColumn, now }));
    } else if (activeContainer && overContainer && activeContainer === overContainer) {
      setItems((prev) => reorderWithin(prev, { activeId: active.id, overId: over?.id }));
    }

    finishDrag();
  };

  const updateCard = useCallback((cardId, patch) => {
    setItems((prev) => updateCardIn(prev, cardId, patch));
  }, []);

  const addWorkLogEntry = useCallback((cardId, entry) => {
    setItems((prev) => appendWorkLogEntry(prev, cardId, entry));
  }, []);

  const applyStatusChange = useCallback((cardId, newStatus, destinationColumn) => {
    const now = new Date().toISOString();
    let result;
    setItems((prev) => {
      result = setCardStatus(prev, cardId, newStatus, { now, destinationColumn });
      return result.items;
    });
    if (result?.requiresDestination) {
      setPendingStatusChange({ cardId, toStatus: newStatus });
      return { requiresDestination: true };
    }
    setPendingStatusChange((current) => (current?.cardId === cardId ? null : current));
    return { requiresDestination: false };
  }, []);

  const handleStatusChange = useCallback((cardId, newStatus) => {
    applyStatusChange(cardId, newStatus);
  }, [applyStatusChange]);

  const handlePickRestoreColumn = useCallback((cardId, destinationColumn) => {
    const pending = pendingStatusChange;
    if (!pending || pending.cardId !== cardId) return;
    applyStatusChange(cardId, pending.toStatus, destinationColumn);
  }, [applyStatusChange, pendingStatusChange]);

  const cancelPendingStatus = useCallback((cardId) => {
    setPendingStatusChange((current) => (current?.cardId === cardId ? null : current));
  }, []);

  const closeFocusedCard = useCallback(() => {
    setFocusedCard(null);
    setPendingStatusChange(null);
  }, []);

  const handleCardOpen = (cardId, originRect) => {
    if (Date.now() < suppressCardOpenUntilRef.current || activeId) {
      return;
    }

    setProjectedCard(null);
    setFocusedCard({
      id: cardId,
      originRect,
    });
  };

  const activeCard = activeId
    ? Object.values(items).flat().find((i) => i.id === activeId)
    : null;
  const projectedCardData = projectedCard
    ? Object.values(items).flat().find((i) => i.id === projectedCard.id)
    : null;
  const focusedCardData = focusedCard
    ? Object.values(items).flat().find((i) => i.id === focusedCard.id)
    : null;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <button
          type="button"
          className="archive-button"
          aria-label="Open archive"
          onClick={() => setIsArchiveOpen(true)}
        >
          <Archive size={14} />
          <span>Archive</span>
        </button>
        <h1>Vectis Law Command Center</h1>
      </div>

      <div className="command-mode-toggle" role="group" aria-label="Command centre view">
        <button
          type="button"
          className={commandMode === 'team' ? 'is-active' : ''}
          aria-pressed={commandMode === 'team'}
          onClick={() => setCommandMode('team')}
        >
          <Users size={14} />
          Team
        </button>
        <button
          type="button"
          className={commandMode === 'mine' ? 'is-active' : ''}
          aria-pressed={commandMode === 'mine'}
          onClick={() => setCommandMode('mine')}
        >
          <User size={14} />
          My Command Centre
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="board-grid">
          <Container id="user-1" title={COLUMN_TITLES['user-1']} icon={<User size={18}/>} items={items['user-1']} count={items['user-1'].length} projectedCardId={projectedCard?.id ?? focusedCard?.id} onCardOpen={handleCardOpen} />
          <Container id="user-2" title={COLUMN_TITLES['user-2']} icon={<User size={18}/>} items={items['user-2']} count={items['user-2'].length} projectedCardId={projectedCard?.id ?? focusedCard?.id} onCardOpen={handleCardOpen} />
          <Container id="user-3" title={COLUMN_TITLES['user-3']} icon={<User size={18}/>} items={items['user-3']} count={items['user-3'].length} projectedCardId={projectedCard?.id ?? focusedCard?.id} onCardOpen={handleCardOpen} />
          <Container id="user-4" title={COLUMN_TITLES['user-4']} icon={<User size={18}/>} items={items['user-4']} count={items['user-4'].length} projectedCardId={projectedCard?.id ?? focusedCard?.id} onCardOpen={handleCardOpen} />
        </div>

        <div className="status-grid">
          <Container id="available" title={COLUMN_TITLES.available} icon={<Inbox size={18}/>} items={items['available']} count={items['available'].length} projectedCardId={projectedCard?.id ?? focusedCard?.id} onCardOpen={handleCardOpen} />
          <Container id="waiting" title={COLUMN_TITLES.waiting} icon={<Clock size={18}/>} items={items['waiting']} count={items['waiting'].length} projectedCardId={projectedCard?.id ?? focusedCard?.id} onCardOpen={handleCardOpen} />
        </div>

        <DragOverlay>
          {activeId && activeCard ? <CardOverlay card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {projectedCard && projectedCardData ? (
        <ProjectedCard
          card={projectedCardData}
          originRect={projectedCard.originRect}
          cancelOriginRect={projectedCard.cancelOriginRect}
          onSave={(payload) => {
            if (payload?.status && payload.status !== projectedCardData.status) {
              applyStatusChange(projectedCard.id, payload.status);
            }
            if (payload?.entry && hasWorkLogContent(payload.entry)) {
              addWorkLogEntry(projectedCard.id, payload.entry);
            }
            preDragItemsRef.current = null;
            preDragRectRef.current = null;
            setProjectedCard(null);
          }}
          onCancelStart={() => {
            if (preDragItemsRef.current) {
              setItems(preDragItemsRef.current);
              preDragItemsRef.current = null;
            }
          }}
          onCancel={() => {
            preDragRectRef.current = null;
            setProjectedCard(null);
          }}
        />
      ) : null}

      {focusedCard && focusedCardData ? (
        <FocusedCardDetails
          card={focusedCardData}
          originRect={focusedCard.originRect}
          onClose={closeFocusedCard}
          onCardChange={updateCard}
          onStatusChange={handleStatusChange}
          pendingStatusChange={pendingStatusChange}
          onPickRestoreColumn={handlePickRestoreColumn}
          onCancelPendingStatus={cancelPendingStatus}
        />
      ) : null}

      {isArchiveOpen ? (
        <ArchiveOverlay
          archivedCards={getArchivedCards(items)}
          onClose={() => setIsArchiveOpen(false)}
          onCardOpen={handleCardOpen}
        />
      ) : null}
    </div>
  );
}

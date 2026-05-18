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
  arrayMove,
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

const STATUS_META = {
  'Not Started': { Icon: Circle },
  'Research and Planning': { Icon: Compass },
  'Drafting': { Icon: Pencil },
  'Reviewing': { Icon: Eye },
  'Waiting': { Icon: Clock },
  'Done': { Icon: CheckCircle2 },
};

const CLIENTS = [
  'Acme Corp',
  'EuroTech Ltd',
  'Initech LLC',
  'Globex Industries',
  'Vandelay Imports',
  'Internal',
];

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

function WorkLogForm({ cardTitle, cardStatus, onSave, onCancel }) {
  const [status, setStatus] = useState(cardStatus ?? '');

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
        <label className="details-section-label">Status</label>
        <select
          className="form-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Not set</option>
          {Object.keys(STATUS_META).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="details-section-label">Description of work completed</label>
        <textarea className="form-textarea" placeholder="E.g., Reviewed standard MSA clauses..."></textarea>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="details-section-label">Start date</label>
          <input type="date" className="form-input" />
        </div>
        <div className="form-group">
          <label className="details-section-label">End date</label>
          <input type="date" className="form-input" />
        </div>
      </div>

      <div className="form-group">
        <label className="details-section-label">Est. time spent (hrs)</label>
        <input type="number" step="0.5" className="form-input" placeholder="1.5" />
      </div>

      <div className="form-group">
        <label className="details-section-label">Next steps</label>
        <textarea className="form-textarea" placeholder="1. Send revised draft to counterparty&#10;2. Follow up on liability cap..." style={{ minHeight: '80px' }}></textarea>
      </div>

      {onSave ? (
        <button
          className="btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            onSave({ status });
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

function FocusedCardDetails({ card, originRect, onClose, onCardChange }) {
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
  const StatusIcon = (STATUS_META[card.status] ?? { Icon: Inbox }).Icon;

  const handleField = (field) => (event) => {
    onCardChange(card.id, { [field]: event.target.value });
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
                  value={card.status ?? ''}
                  onChange={handleField('status')}
                >
                  <option value="">Not set</option>
                  {Object.keys(STATUS_META).map((status) => (
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

function ArchiveOverlay({ onClose }) {
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

          <div className="details-section archive-empty">
            <div className="details-section-label">No archived matters yet</div>
            <p>Matters set to status <strong>Done</strong> will appear here. Archive view is a placeholder — see roadmap.</p>
          </div>
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

const INITIAL_ITEMS = {
  'user-1': [
    { id: 'c1', title: 'Review MSA for Acme Corp', status: 'Reviewing', dueDate: 'May 25, 2026', client: 'Acme Corp', owner: 'Partner A', team: 'Commercial', aiContext: 'Draft contains standard indemnity clauses. Requires specific review of liability cap.' },
    { id: 'c2', title: 'Draft Employee Handbook', status: 'Drafting', dueDate: 'Jun 04, 2026', client: 'Internal', owner: 'Partner A', team: 'Employment', aiContext: 'Needs alignment with new remote work policies.' }
  ],
  'user-2': [
    { id: 'c3', title: 'Data Privacy Addendum', status: 'Research and Planning', dueDate: 'May 22, 2026', client: 'EuroTech Ltd', owner: 'Partner B', team: 'Privacy', aiContext: 'Standard DPA. Matches previous templates used for EU clients.' }
  ],
  'user-3': [],
  'user-4': [],
  'waiting': [
    { id: 'c4', title: 'Response from Opposing Counsel', status: 'Waiting', dueDate: 'May 19, 2026', client: 'Initech LLC', owner: 'Partner A', team: 'IP & Licensing', aiContext: 'Pending their markups on the IP licensing agreement.' }
  ],
  'available': [
    { id: 'c5', title: 'Draft standard Terms of Service', status: 'Not Started', dueDate: null, client: null, owner: null, team: null, aiContext: 'Requested by new startup client.' }
  ]
};

const COLUMN_TITLES = {
  'user-1': 'Partner A',
  'user-2': 'Partner B',
  'user-3': 'Associate 1',
  'user-4': 'Associate 2',
  waiting: 'Waiting Response',
  available: 'Available',
};

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
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findContainer = (id) => {
    if (id in items) {
      return id;
    }
    return Object.keys(items).find((key) =>
      items[key].find((item) => item.id === id)
    );
  };

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

    if (!overId || active.id === overId) {
      return;
    }

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((i) => i.id === active.id);
      const overIndex = overItems.findIndex((i) => i.id === overId);

      let newIndex;
      if (overId in prev) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowOverItem = over && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }

      return {
        ...prev,
        [activeContainer]: [...prev[activeContainer].filter((item) => item.id !== active.id)],
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          activeItems[activeIndex],
          ...prev[overContainer].slice(newIndex, prev[overContainer].length),
        ],
      };
    });
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

    if (!activeContainer || !overContainer || activeContainer !== overContainer) {
      finishDrag();
      return;
    }

    const activeIndex = items[activeContainer].findIndex((i) => i.id === active.id);
    const overIndex = items[overContainer].findIndex((i) => i.id === over?.id);

    // Only arrayMove if overIndex is valid (not -1, which happens when dropped on an empty container)
    if (activeIndex !== overIndex && overIndex !== -1) {
      setItems((items) => ({
        ...items,
        [overContainer]: arrayMove(items[overContainer], activeIndex, overIndex),
      }));
    }

    finishDrag();
  };

  const updateCard = useCallback((cardId, patch) => {
    setItems((prev) => {
      const container = Object.keys(prev).find((key) =>
        prev[key].some((c) => c.id === cardId),
      );
      if (!container) return prev;
      return {
        ...prev,
        [container]: prev[container].map((c) =>
          c.id === cardId ? { ...c, ...patch } : c,
        ),
      };
    });
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
              updateCard(projectedCard.id, { status: payload.status });
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
          onClose={() => setFocusedCard(null)}
          onCardChange={updateCard}
        />
      ) : null}

      {isArchiveOpen ? (
        <ArchiveOverlay onClose={() => setIsArchiveOpen(false)} />
      ) : null}
    </div>
  );
}

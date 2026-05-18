# Vectis Law Command Center — Roadmap

This file tracks future product and engineering work. It is the forward-looking companion to [AGENTS.md](AGENTS.md), which describes the *current* state of the code. When picking up new work, read both.

Items are grouped by theme, not strict chronology. Within each group the most recently discussed item is listed first.

## 1. Card Content & Aesthetic

### 1.1 AI-generated widget content
The card front currently shows `Status` and `Due date` widgets sourced from sample data on each card. The longer-term intent is for these widgets to be AI-generated — i.e., an LLM picks the most relevant 1-2 data points per card (which may differ across matters) rather than a fixed pair. Until then, the schema is "two slots driven by static fields." Related: [Real AI summaries](#41-real-ai-summaries).

### 1.2 Surface more than two widgets where useful
Two slots are the current ceiling because of card width. If a card-front layout exists that can carry three or four signals comfortably (e.g. assignee, last activity, hours logged) without crowding the title, it should be evaluated.

### 1.3 Status model: enum, coupling, and driven moves *(deferred — needs design discussion)*
`card.status` is currently a loose string. The shape of a real status model is unsettled. Open questions:

- Should `status` be a strict enum (e.g. `Not Started` · `Research and Planning` · `Drafting` · `Reviewing` · `Waiting` · `Done`) or stay loose?
- Should setting status to `Waiting` programmatically move the card into the `Waiting Response` column, and `Done` into the archive? (Brainstorm direction was yes, but data model is parked.)
- Conversely, should dragging a card into `Waiting Response` force its status to `Waiting`?
- Is a separate `assignee` field needed, or does column placement remain the only source of ownership?
- How does this interact with the audit log ([Auditable card history](#17-auditable-card-history))?

### 1.4 Archive view, routing, and restore *(deferred — needs design discussion)*
The `Archive` button currently opens an empty-state overlay only. Open questions:

- What moves a card into the archive (status change in details overlay only, drag, both)?
- What does the archive view list — full cards in `.focused-card-panel` styling, or a denser table?
- How does restore work — back to `Available`, back to the previous assignee, or user-chosen?
- What metadata is preserved (when archived, by whom, prior column)?

Depends on [Status model](#13-status-model-enum-coupling-and-driven-moves).

### 1.5 Auditable card history *(deferred — needs design discussion)*
The product intent is for each card to carry an auditable record of its journey through the system (status changes, column moves, work-log entries, edits, archive/restore). Open questions:

- Schema shape (event log per card vs. global event stream).
- Which actions emit events, and what payload each carries.
- Where the history is surfaced (a `History` section in the details overlay was discussed).
- Retention and export expectations.

Depends on [Backend persistence](#22-backend-persistence) to be useful beyond a single session.

## 2. State, Persistence & Data Model

### 2.1 Bind the work-log form to card state
The inputs in `WorkLogForm` (description, start date, end date, estimated hours, steps) are uncontrolled. Wire them to a per-card `workLog` object and persist on Save. This is a prerequisite for [Backend persistence](#22-backend-persistence) — without it there is nothing real to save.

### 2.2 Backend persistence
Card positions, work logs, and form data should survive a refresh. No backend is chosen yet. Likely candidates: Supabase, Firebase, or a small custom API.

Suggested data model:
- `columns`
- `cards`
- `columnOrder`
- `teamMembers`

Card position/order should be stored explicitly, not inferred.

### 2.3 Populate details-view fields on real card data
The [click-to-open details overlay](AGENTS.md#card-interaction-modes) reads `dueDate`, `description`, `tasksUrl`, `timeEntriesUrl`, and `taskFolderUrl` from each card. `INITIAL_ITEMS` does not yet supply these; the view currently falls back to placeholders and `#` hrefs.

### 2.4 Real navigation for details-view links
"Open tasks", "Time entries", and "Task folder" in the details overlay currently call `event.preventDefault()`. Once the backing systems are decided, point these at real URLs.

### 2.5 Extract board mutations to pure helpers / reducer
Today, drag handlers mutate `items` inline. Before adding persistence or tests, extract:
- `moveCard`
- `reorderCard`
- `completeCard`
- `updateCardWorkLog`

This makes [Backend persistence](#22-backend-persistence) and [Tests](#51-unit-tests-for-state-transitions) much easier.

## 3. Views & Navigation

### 3.1 Wire the Team / My Command Centre toggle
The bottom-left toggle sets `commandMode` state but does not filter the board. Decide what "My Command Centre" should actually show (own cards across all columns? single-column personal view?) and implement.

### 3.2 Dynamic team roster
The four team columns (`Partner A`, `Partner B`, `Associate 1`, `Associate 2`) are hardcoded. Drive them from a real team list once a backend exists.

## 4. AI Integration

### 4.1 Real AI summaries
The `aiContext` field is hand-authored placeholder text. It currently feeds the `description` paragraph in the click-to-open details view. Replace with calls to an LLM endpoint, driven by the card's actual data and any logged work. Closely related to [AI-generated widget content](#11-ai-generated-widget-content) — the widget slots on the card front are the more prominent surface for AI output.

## 5. Workflow & Notifications

### 5.1 Waiting-Response status check after 7 days
If a card sits in the `Waiting Response` column for 7 consecutive days, the system should trigger a **status check**. Notify each user working on the card and the team's manager.

When a status check fires, the manager has two options:
1. **Assign the status check** to any other user (original assignees remain notified).
2. **Archive the card** — move it to the archive and set its status to `done`.

Requirements:
- Add two values to the card status enum: `status check` and `done`. Both are distinct from column membership.
- Track the timestamp a card entered `Waiting Response` so the 7-day threshold can be computed. Reset this timestamp when the card moves out and back in.
- Provide an archive destination for cards moved by the manager. Cards in archive should be retrievable but kept off the active board.
- Manager is a role on a team member — the [dynamic team roster](#32-dynamic-team-roster) work needs to model this.

Depends on [Backend persistence](#22-backend-persistence) (timestamps, statuses, and archive must survive across sessions) and [Dynamic team roster](#32-dynamic-team-roster) (manager role).

## 6. Quality & Verification

### 6.1 Unit tests for state transitions
Vitest, covering the extracted reducer / helpers from [Extract board mutations](#25-extract-board-mutations-to-pure-helpers--reducer). Cross-column drops, intra-column reorder, drop on empty container, and projected-editor lifecycle.

### 6.2 Browser E2E tests
Playwright (preferred) for drag-and-drop, the drag-flip editor lifecycle, and the click-to-open details overlay. Not yet installed.

### 6.3 Accessibility pass on the work-log form
Form labels are visual only. Link `<label>` to inputs via `htmlFor` / `id`, and audit focus order for the projection overlays.

### 6.4 Responsive behaviour
Current responsive rules cover three breakpoints but have not been validated in a real browser. The board should remain usable on tablet and degrade cleanly on mobile (likely 1 column with horizontal scroll for the status row).

## 7. Done / Decided (kept for context)

These are settled and live in the code today. Listed here so future agents do not re-open them as "ideas".

- Card focus is a **projection overlay**, not in-column expansion. The source card stays in its panel as a dim placeholder. See [Animation Model](AGENTS.md#animation-model).
- User/status panel **height is fixed**; overflow scrolls inside the panel.
- Flip animation: slower, no overshoot, no bounce-back, with `prefers-reduced-motion` handling.
- `Vectis Law Command Center` label sits bottom-right; `Team` / `My Command Centre` toggle sits bottom-left.
- The whole front of the card is the drag handle.
- The AI Summary prose block on the card front is **replaced** by two `Status` + `Due date` widgets in `.card-widgets` (mirroring `.details-meta-grid`). See [Card Surfaces](AGENTS.md#card-surfaces).
- The three card surfaces (front, drag-flip editor, click-to-open details) share one visual language: kicker + h2 header, meta-grid, `details-section-label` typography.
- Bottom row order: `Available` (left), `Waiting Response` (right). The `Our Tasks` column was renamed to `Available`.
- An `Archive` button sits in the fixed bottom-right of the viewport, left of the `Vectis Law Command Center` label. It opens an `ArchiveOverlay` placeholder using the same panel styling as the details view.
- Status in the details overlay reads from `card.status`, not from the column the card sits in.
- The click-to-open details view is **inline-editable** for title, status, due date, and description. Edits flow through an `onCardChange(id, patch)` callback into an `updateCard` reducer on `App` and propagate immediately to the card front. There is no Save button. Persistence across sessions still depends on [Backend persistence](#22-backend-persistence).
- The drag-flip work-log editor has an `X` close button that **reverts** the move — the card returns to its origin column and unsaved form entry is discarded. Two snapshots taken at `handleDragStart` drive this: `preDragItemsRef` (state) and `preDragRectRef` (the card's on-screen rect). On cancel, the projection animates back to the pre-drag rect — not the drop location — and the snapshot is restored at the *start* of the animation so the dim placeholder is in the origin column throughout.
- The work-log form's first field is a **Status** select populated from `STATUS_META`. On Save, the selected status flows up to `App.updateCard` and applies to the card. The form's other fields are still uncontrolled — see [Bind the work-log form to card state](#21-bind-the-work-log-form-to-card-state).
- The click-to-open Matter view carries five fixed meta entries: `Due date`, `Status`, `Owner`, `Team`, `Client`. The first four sit in a 2×2 grid; `Client` spans the full width below them. All five are inline-editable.
- Client is an enum sourced from a `CLIENTS` constant in `App.jsx`. The card front renders the client as a muted subtitle directly under the title.
- Matter view footer carries two pinned links — `Time entries` (bottom-left) and `Task folder` (bottom-right). The earlier `Open tasks` link was removed.

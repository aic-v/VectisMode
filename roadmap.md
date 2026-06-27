# Vectis Law Command Center — Roadmap

This file tracks future product and engineering work. It is the forward-looking companion to [AGENTS.md](AGENTS.md), which describes the *current* state of the code. When picking up new work, read both.

Items are grouped by theme, not strict chronology. Within each group the most recently discussed item is listed first.

## 1. Card Content & Aesthetic

### 1.1 AI-generated widget content
The card front currently shows `Status` and `Due date` widgets sourced from sample data on each card. The longer-term intent is for these widgets to be AI-generated — i.e., an LLM picks the most relevant 1-2 data points per card (which may differ across matters) rather than a fixed pair. Until then, the schema is "two slots driven by static fields." Related: [Real AI summaries](#41-real-ai-summaries).

### 1.2 Surface more than two widgets where useful
Two slots are the current ceiling because of card width. If a card-front layout exists that can carry three or four signals comfortably (e.g. assignee, last activity, hours logged) without crowding the title, it should be evaluated.

### 1.3 Assignee model
Status is now coupled with column placement (see Done section). Open question that remains: should there be a separate `assignee` field on each card, or does column placement remain the only source of ownership? Depends on [Dynamic team roster](#32-dynamic-team-roster).

### 1.4 History UX polish
A per-card `history[]` log is now appended on every status and column change and rendered in the Matter view. Future polish to consider:

- Group consecutive same-day events.
- Surface the actor (who made the change) once a real user model exists.
- Add a global event stream view across all cards.
- Retention and export rules once persistence lands.

## 2. State, Persistence & Data Model

### 2.1 Backend persistence
Card positions, work logs, history events, and form data should survive a refresh. No backend is chosen yet. Likely candidates: Supabase, Firebase, or a small custom API.

Suggested data model (each card already has the right shape in [src/board.js](src/board.js)):
- `columns`
- `cards` (with `status`, `previousStatus`, `previousColumn`, `workLog[]`, `history[]`)
- `columnOrder`
- `teamMembers`

Card position/order should be stored explicitly, not inferred.

### 2.2 Populate details-view fields on real card data
The click-to-open details overlay reads `dueDate`, `description`, `tasksUrl`, `timeEntriesUrl`, and `taskFolderUrl` from each card. `INITIAL_ITEMS` does not yet supply the latter three; the view falls back to placeholders and `#` hrefs.

### 2.3 Real navigation for details-view links
"Time entries" and "Task folder" in the details overlay currently call `event.preventDefault()`. Once the backing systems are decided, point these at real URLs.

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
2. **Archive the card** — move it to the archive (set its status to `Done`).

Requirements:
- Add a `status check` value to the card status enum, distinct from the existing `Done`.
- Track the timestamp a card entered `Waiting Response` so the 7-day threshold can be computed. Reset this timestamp when the card moves out and back in. The `history[]` log already records column-entry timestamps — derive from there or store explicitly.
- Manager is a role on a team member — the [dynamic team roster](#32-dynamic-team-roster) work needs to model this.

Depends on [Backend persistence](#21-backend-persistence) (timestamps, statuses, and archive must survive across sessions) and [Dynamic team roster](#32-dynamic-team-roster) (manager role).

## 6. Quality & Verification

### 6.1 Additional reducer tests
The Vitest suite in [src/board.test.js](src/board.test.js) currently covers the existing helpers (move, reorder, status set, drag landing, history, archive). Add coverage for:

- Edge cases on Done → other restoration (missing destination, unknown destination column).
- Multiple work-log entries appending in expected order.
- History event ordering across mixed status + column transitions.

### 6.2 Browser E2E tests
Playwright (preferred) for drag-and-drop, the drag-flip editor lifecycle, the click-to-open details overlay, archive restore flow, and the destination picker. Not yet installed.

### 6.3 Responsive behaviour
Current responsive rules cover three breakpoints but have not been validated in a real browser. The board should remain usable on tablet and degrade cleanly on mobile (likely 1 column with horizontal scroll for the status row).

## 7. Done / Decided (kept for context)

These are settled and live in the code today. Listed here so future agents do not re-open them as "ideas".

**Visual language and layout**

- Card focus is a **projection overlay**, not in-column expansion. The source card stays in its panel as a dim placeholder. See [Animation Model](AGENTS.md#animation-model).
- User/status panel **height is fixed**; overflow scrolls inside the panel.
- Flip animation: slower, no overshoot, no bounce-back, with `prefers-reduced-motion` handling.
- `Vectis Law Command Center` label sits bottom-right; `Team` / `My Command Centre` toggle sits bottom-left.
- The whole front of the card is the drag handle.
- The AI Summary prose block on the card front is **replaced** by two `Status` + `Due date` widgets in `.card-widgets` (mirroring `.details-meta-grid`). See [Card Surfaces](AGENTS.md#card-surfaces).
- The three card surfaces (front, drag-flip editor, click-to-open details) share one visual language: kicker + h2 header, meta-grid, `details-section-label` typography.
- Bottom row order: `Available` (left), `Waiting Response` (right). The `Our Tasks` column was renamed to `Available`.

**Card content**

- The click-to-open Matter view carries five fixed meta entries: `Due date`, `Status`, `Owner`, `Team`, `Client`. The first four sit in a 2×2 grid; `Client` spans the full width below them. All five are inline-editable.
- Client is an enum sourced from a `CLIENTS` constant in [src/board.js](src/board.js). The card front renders the client as a muted subtitle directly under the title.
- Matter view footer carries two pinned links — `Time entries` (bottom-left) and `Task folder` (bottom-right). The earlier `Open tasks` link was removed.
- The click-to-open details view is **inline-editable** for title, status, due date, owner, team, client, and description. Edits flow through an `onCardChange(id, patch)` callback into an `updateCard` reducer on `App` and propagate immediately to the card front. There is no Save button. Persistence across sessions still depends on [Backend persistence](#21-backend-persistence).

**Reducer extraction and state shape**

- Board mutations live in [src/board.js](src/board.js) as pure helpers (`moveCardAcross`, `reorderWithin`, `updateCard`, `setCardStatus`, `applyDragLanding`, `appendWorkLogEntry`, `appendHistoryEvent`, `getArchivedCards`). `App.jsx` only orchestrates UI state — there is no inline state mutation in drag handlers.
- Each card carries `workLog[]` (user-authored entries) and `history[]` (system-emitted events). Both are appended to via pure helpers.

**Work-log form**

- All fields in `WorkLogForm` (status, description, start/end date, hours, next steps) are controlled. On Save, the form emits both `{ status }` and a full `entry` object; an entry is only appended when it has actual content (any of description/dates/hours/next-steps).
- All form inputs have proper `htmlFor`/`id` linkage.
- The drag-flip work-log editor has an `X` close button that **reverts** the move — the card returns to its origin column and unsaved form entry is discarded. Two snapshots taken at `handleDragStart` drive this: `preDragItemsRef` (state) and `preDragRectRef` (the card's on-screen rect). On cancel, the projection animates back to the pre-drag rect — not the drop location — and the snapshot is restored at the *start* of the animation so the dim placeholder is in the origin column throughout.

**Status ↔ column coupling**

- Status `Waiting` ⟺ column `waiting`; status `Done` ⟺ column `archive`. Status is the single source of truth.
- Setting status to `Waiting`/`Done` from the Matter view or work-log Save moves the card into the required column and stashes `previousColumn` + `previousStatus` so a future restoration knows where it came from.
- Dragging a card into Waiting Response forces status `Waiting`; dragging a card out restores `previousStatus` (default `Reviewing`). Drops onto the archive container are blocked at the helper layer.
- Setting status away from `Done` is held as `pendingStatusChange` and surfaces an inline destination picker in the Matter view (`RESTORE_COLUMNS`). Closing the overlay or clicking *Cancel status change* rolls back the change. No silent moves.

**Archive and history**

- `ArchiveOverlay` renders the real contents of `items.archive`. Clicking an archived card closes the archive and opens the Matter view, which is the entry point for the destination picker above.
- `card.history[]` records `status` and `column` events with timestamps and is rendered as a small list in the Matter view, in the same style as the work-log entries.

**Testing**

- Vitest is installed and 40 reducer tests cover move, reorder, status set, drag landing, restore, history append, and archive retrieval. `npm test` runs them. No `@testing-library/react` yet — only pure helpers are tested.

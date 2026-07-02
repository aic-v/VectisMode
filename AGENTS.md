# Vectis Law Command Center — Agent Notes

This file describes the **current state** of the codebase. For forward-looking work — what to build next, open product questions, and decided-but-unimplemented direction — see [roadmap.md](roadmap.md).

## Project Overview

Vectis Law Command Center is a Vite + React dashboard for a technology law practice. The board surfaces six task columns in a card-based layout:

- Four team columns: `Partner A`, `Partner B`, `Associate 1`, `Associate 2`.
- Two bottom-row columns: `Available` (left), `Waiting Response` (right).

Cards are draggable between columns with `@dnd-kit`. The board distinguishes two card interactions, which trigger different overlays — see [Card Surfaces](#card-surfaces).

A bottom-left segmented control toggles between the `Team` board and `My Command Centre`, a personalised view with a day planner and an agent chat — see [My Command Centre](#my-command-centre).

The `Vectis Law Command Center` label is a small fixed element in the bottom-right of the viewport, intentionally low-emphasis so visual weight stays on the cards. An `Archive` button sits immediately to its left — see [Archive](#archive).

## Tech Stack

- React 19
- Vite 8
- Vanilla CSS in [src/index.css](src/index.css)
- Drag and drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Icons: `lucide-react`
- Tests: Vitest (unit), `@playwright/test` (E2E)

## Files of Interest

- [src/App.jsx](src/App.jsx) — React components for the team board and overlays, drag state, orchestration of status changes and the status-check sweep.
- [src/board.js](src/board.js) — pure helpers for every board mutation: moves, reorders, status changes (with column coupling), drag landing, work-log/history appends, and the status-check family. All board mutations go through these.
- [src/MyCommandCentre.jsx](src/MyCommandCentre.jsx) — the personalised view: identity picker, day planner, agent chat.
- [src/time.js](src/time.js) — the time ledger: work categories, entry validation, filters/totals/week buckets, sharing-level enforcement, and the Zoho-mappable CSV export. Pure module — see [Time Ledger & Timesheets](#time-ledger--timesheets).
- [src/Timesheets.jsx](src/Timesheets.jsx) — the Timesheet overlay: Me/Firm scope, period + grouping filters, inline entry editing, CSV download.
- [src/agent.js](src/agent.js) — the Vectis Assistant. `getAgentReply` is the seam for a future real agent endpoint; today it answers with local rules over the live board and ledger, and parses `log …` commands (its first write capability). Also holds due-date parsing/classification and the "my matters" heuristic.
- [src/storage.js](src/storage.js) — versioned localStorage persistence (board, identity, chat, time entries, sharing levels) with shape validation.
- [src/index.css](src/index.css) — design tokens (including the validated work-category palette), layout, projection/flip animations, status-check, My Command Centre, and timesheet styles, responsive rules.
- [src/board.test.js](src/board.test.js), [src/time.test.js](src/time.test.js), [src/storage.test.js](src/storage.test.js), [src/agent.test.js](src/agent.test.js) — Vitest suites (96 tests).
- [e2e/](e2e/) — Playwright suites (31 tests) with shared helpers in [e2e/helpers.js](e2e/helpers.js), configured by [playwright.config.js](playwright.config.js).

Sample card data is hardcoded in `INITIAL_ITEMS` inside [src/board.js](src/board.js); on a fresh browser it seeds the board, after which localStorage state wins — see [Persistence](#persistence).

## Layout Rules

- The board occupies close to the full viewport width.
- Top row: four team panels in a single grid (`.board-grid`).
- Bottom row: two status panels in a separate grid (`.status-grid`), shorter than the top row.
- Panel height is **fixed** (driven by `--panel-height`) and never changes due to card content or focus state. Overflowing cards scroll inside the panel via `.card-list`, with a minimal scrollbar that is transparent at rest and visible on hover/focus.
- Responsive collapse: two columns at ≤1180px, single column at ≤720px. Validated in a real browser via the Playwright responsive spec ([e2e/responsive.spec.js](e2e/responsive.spec.js)).
- Watch CSS specificity when overriding `--panel-height`: the base media queries set it on `.cutout-panel`, so view-specific overrides (e.g. `.my-centre-grid .my-panel`) must be more specific.

## Card Surfaces

Three surfaces share one visual language — a kicker + h2 header, a meta-grid for primary data points (status, due date), and `details-section-label` styling for any secondary labels. Treat them as one component family.

### Card front

Layout, top to bottom:

1. `.card-heading` — title (primary) plus the card's **client** as a muted subtitle directly beneath. The subtitle is omitted when `card.client` is empty.
2. `.card-widgets` — two compact meta-items, `Status` and `Due date`, in a mini version of `.details-meta-grid`. Status icon comes from `STATUS_META` in [src/App.jsx](src/App.jsx). Missing values fall back to `Not set` / `No due date`.

Statuses (`STATUS_KEYS` in [src/board.js](src/board.js)): `Not Started` · `Research and Planning` · `Drafting` · `Reviewing` · `Waiting` · `Status Check` · `Done`. `Waiting`, `Status Check`, and `Done` are coupled to columns — see [Status & Column Coupling](#status--column-coupling).

Cards with status `Status Check` get an amber left-edge treatment (`.card-front--alert`).

### Drag-flip work-log editor (`ProjectedCard`)

Triggered when a card is dragged into a *different* column. The overlay copy animates out of the landed card, flips to `WorkLogForm`, and reverses on Save. The form uses the same kicker (`Log work`) + h2 (card title) header as the details view, with an `X` close button on the right.

All fields are controlled: **Status** (defaulted to the card's current status), Description, Start date, End date, Est. hours, Next steps. On Save, the form passes both `{ status }` and a full `entry` object (with `loggedAt` timestamp) up through `ProjectedCard.handleSave` → `App.onSave`. Status flows through `applyStatusChange` (which routes through `setCardStatus` for status↔column coupling). The work-log entry is appended via `appendWorkLogEntry` only if it has any actual content.

Cancel behavior: clicking the `X` discards any unsaved form entry and **reverts the move** — the card returns to its origin column. Two snapshots taken in `handleDragStart` drive this: `preDragItemsRef` (the `items` state) and `preDragRectRef` (the dragged card's `getBoundingClientRect`).

On cancel, the projection animates back to `preDragRectRef` (the card's original on-screen position), not to the drop location. The snapshot restore is triggered at the *start* of the cancel animation, so the dim placeholder is already in the origin column while the projection is collapsing — the projection lands cleanly on top of it instead of jumping at the end. Implemented with paired callbacks `onCancelStart` (restores items) and `onCancel` (clears the projection after the animation).

### Click-to-open details view (`FocusedCardDetails`)

Triggered when a card is clicked without being dragged. Seven fields are inline-editable: **title**, **due date** (loose text input), **status** (select of `STATUS_META` keys), **owner** (text), **team** (text), **client** (select of `CLIENTS`), and **description**. The five meta fields sit in `.details-meta-grid` — two rows of two side-by-side, with `Client` spanning the full width on the third row via `.details-meta-item--wide`. Edits flow through an `onCardChange(cardId, patch)` callback into the `updateCard` reducer on `App`, which merges the patch into the matching card. There is no Save button — changes propagate immediately, and any fields the card front surfaces re-render from the same source.

Below the description, a `.details-footer` pins two links to the bottom: `Time entries` (left) and `Task folder` (right). When the card provides `timeEntriesUrl` / `taskFolderUrl` (all sample cards do), the links open those URLs in a new tab; otherwise they render as inert `#` anchors.

When the card's status is `Status Check`, a resolution panel renders above the description — see [Status Check Workflow](#status-check-workflow).

- Status icon next to the select stays in sync with the selected value.
- Closes on backdrop click, the X button, or `Escape`. When focus is inside an editable field, `Escape` blurs the field first; a second `Escape` closes the overlay.
- Card clicks are suppressed for ~500ms after `dragStart` / `dragEnd` via `suppressCardOpenUntilRef`, so a drop never inadvertently opens the details view.

## Status & Column Coupling

Status and column placement are a **single source of truth**, coordinated by helpers in [src/board.js](src/board.js):

- Status `Waiting` ⟺ column `waiting` (Waiting Response).
- Status `Status Check` ⟺ column `waiting` (a flagged card stays in Waiting Response).
- Status `Done` ⟺ column `archive`.

Two pure entry points drive everything:

- **`setCardStatus(items, cardId, newStatus, { now, destinationColumn })`** — used by Matter view edits, work-log Save, and status-check resolution. Moves the card into the required column when the new status is coupled, and out of `waiting`/`archive` when status changes away. Stashes `previousColumn` and `previousStatus` so a returning card lands back where it came from. **Refuses** to leave `Done` without a valid `destinationColumn` — returns `{ requiresDestination: true }` so the UI can prompt; unknown column ids and `archive` are rejected the same way. Also maintains `waitingSince` (stamped entering `waiting`, cleared leaving, restarted on `Status Check` → `Waiting`) and `statusCheckAt`.
- **`applyDragLanding(items, cardId, { fromColumn, now })`** — called from `handleDragEnd` once a drag actually crosses containers. Drops into `waiting` force status `Waiting` and stamp `waitingSince`; drags out of `waiting` restore `previousStatus` (default `Reviewing`) and clear `waitingSince`/`statusCheckAt`. Drops onto `archive` are blocked at the helper level (`moveCardAcross`).

Both helpers append events to `card.history` so the audit trail stays consistent with state.

## Status Check Workflow

The 7-day Waiting-Response watchdog (roadmap item now shipped; remaining work in [roadmap.md §5.1](roadmap.md#61-status-check--remaining-work)):

- Every card entering the `waiting` column gets `waitingSince`. A sweep in `App` (on mount, then every 60s) calls `applyStatusChecks`, which flags `Waiting` cards older than `STATUS_CHECK_THRESHOLD_DAYS` (7) as status **`Status Check`** and stamps `statusCheckAt`. The sweep is idempotent — already-flagged cards are untouched.
- Surfacing: amber card front, a `.status-check-banner` above the team board (each flagged matter is a click-to-open chip), and an alerts section at the top of the My Command Centre planner.
- Resolution happens in the Matter view's `StatusCheckPanel` via `resolveStatusCheck`, with three actions:
  - **Assign to <column>** — moves the card there and restores the stashed `previousStatus` (default `Reviewing`).
  - **Keep waiting** — status back to `Waiting`, `waitingSince` restarted (a fresh 7-day clock).
  - **Archive matter** — status `Done`, card moves to the archive.
- Dragging a flagged card out of `waiting` also clears the flag (restores previous status).
- The seeded sample card `c4` ships with `waitingSince` nine days in the past so the workflow fires on first load of a fresh browser.

## My Command Centre

`commandMode === 'mine'` replaces the board with [src/MyCommandCentre.jsx](src/MyCommandCentre.jsx): a "Sharing" + "Viewing as" toolbar, the full-width **My time** week strip, then a two-column grid (day planner left, agent chat right).

- **Identity** — a select over `TEAM_MEMBERS` ([src/board.js](src/board.js)), persisted to localStorage. "My matters" = the member's column plus cards in `waiting`/`available` whose `owner` matches the member name (heuristic until an assignee model exists — [roadmap 1.3](roadmap.md#13-assignee-model)).
- **My time** — this week's hours as category-stacked daily bars with total and billable %, plus an "Open timesheet" shortcut. See [Time Ledger & Timesheets](#time-ledger--timesheets).
- **Day planner** — status-check alerts first, then the agenda grouped Overdue / Due today / Next 7 days / Later / No due date (flagged cards are excluded from these groups to avoid duplication), then a Monday-first month calendar with dots on days where matters are due. Agenda items open the regular Matter view.
- **Agent chat ("Vectis Assistant")** — message list + input. Replies come from `getAgentReply` in [src/agent.js](src/agent.js): today a local rules engine over the live board and time ledger (due dates, waiting matters, status checks, workload, weekly time summaries), plus the `log …` command which writes a ledger entry via the `timeEntry` field on the structured reply. The function is the single seam to swap in a real agent endpoint. Chat history persists to localStorage. The panel is labelled "preview" and the empty state says replies are generated locally.

The panel heights budget for the toolbar and time strip (`.my-centre-grid .my-panel`) so the fixed bottom controls never overlap the chat input — validated by the responsive spec.

## Time Ledger & Timesheets

Time is a **global ledger** ([src/time.js](src/time.js)), not card data — because firm time (business development, training, product work) does not always have a matter card. Card work-logs *feed* the ledger; the ledger is the single source of truth for hours. Direction settled with the user (July 2026): the tool's primary purpose is individual-first productivity visibility, with org visibility subject to the individual's comfort and billing timesheets as a by-product.

**Entry shape:** `{ id, memberId, cardId?, matterTitle?, client?, category, date (YYYY-MM-DD), hours, narrative, billable, loggedAt }`. Entries are validated by `normalizeTimeEntry` on every write and on load.

**Work categories** (`WORK_CATEGORIES`): Client Work (billable by default) · Business Development · Research & Writing · Product & Tech · Training · Firm Administration. The category defaults the `billable` flag; it is overridable per entry. Value is deliberately not billable-only — the categories exist so non-billable contributions are visible. Category colors are CSS custom properties (`--cat-<key>`) — categorical palette slots in fixed order, CVD-validated against the panel surface.

**Three capture surfaces**, all stamping the current identity and funnelling through `App.logTime`:

1. The drag-flip **work-log form** — hours + a new category select; saving also appends a card work-log entry as before.
2. The **quick-add row** in the Matter view's Time section (hours, category, date, narrative). The section lists the matter's latest entries and a running total; the footer's `Time entries` button opens the Timesheet overlay pre-filtered to the matter.
3. The **assistant chat** — `parseLogCommand` understands e.g. `log 1.5h on the Acme MSA for reviewing the cap yesterday` / `log 45m of business development` (hours or minutes, matter fuzzy-matched by title/client words, category keywords, today/yesterday, narrative after "for").

**Sharing levels** (`SHARE_LEVELS`, picked per member in the My Command Centre toolbar, stored in `vectis:sharing:v1`): `full` (default — org sees entries) · `totals` (org sees only aggregate hours) · `private` (excluded, but counted so firm views say "N members private" rather than under-reporting silently). `applyShareLevels` enforces this in the Firm scope; the Me scope always shows the member their own detail.

**Surfaces:** the **My time panel** in My Command Centre (week strip of category-stacked bars, total + billable %, legend) and the **Timesheet overlay** ([src/Timesheets.jsx](src/Timesheets.jsx)) reachable from the fixed header button, the My time panel, or a matter footer — Me/Firm scope, period presets, grouping by date/matter/client/category, inline narrative/hours/billable editing, delete, and **Export CSV** with Zoho Books-mappable columns (`Date, User, Client, Matter, Category, Notes, Hours, Billable Status`). Decision on record: export stays neutral CSV, shaped for a later Zoho Books integration.

## Persistence

Stopgap, single-browser persistence via versioned localStorage keys in [src/storage.js](src/storage.js):

- `vectis:board:v1` — the full `items` object, saved on every change, validated with `isValidBoard` on load (bad/missing data falls back to `INITIAL_ITEMS`).
- `vectis:identity:v1` — the My Command Centre identity.
- `vectis:chat:v1` — assistant chat history.
- `vectis:time:v1` — the time ledger; entries are validated individually on load so one corrupt entry drops out without discarding the ledger.
- `vectis:sharing:v1` — per-member time-sharing levels.

Bump a key's version to invalidate stored state after a schema change. Real backend persistence is still an open decision — [roadmap 2.1](roadmap.md#21-backend-persistence).

## Archive

An `Archive` button sits in the fixed bottom-right of the viewport. Clicking it opens `ArchiveOverlay`, which renders the contents of `items.archive` as a list. Clicking an archived card closes the archive and opens the regular Matter view for that card — changing its status to anything other than `Done` triggers a **destination picker** inside the Matter view (`RESTORE_COLUMNS` × buttons). Until the user picks a column, the status change is held in `App.pendingStatusChange` and not applied; closing the overlay or clicking *Cancel status change* rolls the change back.

## Animation Model

Card focus is implemented as a **projection overlay**, not an in-column expansion. Do not revert this — the user has explicitly chosen this pattern so that the underlying panel stays static while the focused card occupies comfortable screen real estate.

Mechanics:

- The source card stays in its panel as a dim placeholder while an overlay is open.
- The overlay measures the source card with `getBoundingClientRect()` and animates from that rect into a centred target frame inside `.projection-layer`.
- Two target sizes exist:
  - `getProjectionTarget()` — drag-triggered editor.
  - `getDetailsProjectionTarget()` — click-triggered details view.

### Motion Preferences

- Smooth, slower flip.
- No overshoot easing, no bounce-back at the end.
- `prefers-reduced-motion: reduce` is honoured in CSS (flip, projection, and the chat typing indicator). Preserve or improve this when touching animation code.

## Known Gaps (in current code)

These are facts about today's code. The plan to address each lives in [roadmap.md](roadmap.md).

1. Persistence is single-browser localStorage — no backend, no multi-user sync (which also means the Firm timesheet scope only aggregates this browser's ledger).
2. Team columns are hardcoded via `TEAM_MEMBERS`; no dynamic roster, no manager role (status-check resolution is not permission-gated, and sharing levels are set per browser, not per authenticated user).
3. The assistant chat is a local rules engine, not a real agent; `aiContext` remains hand-authored placeholder text.
4. "Notify users and manager" for status checks means in-app surfacing only — no email/push.
5. "My matters" relies on the free-text `owner` field matching the member name.
6. Timesheets have no rates, no mark-as-billed state, and no invoice push — CSV export only.
7. No component-level tests (`@testing-library/react`); coverage is pure helpers + browser E2E.
8. No CI pipeline.

## Verification

Known-green commands:

```bash
npm run lint
npm test          # Vitest, 96 tests
npm run build
npm run test:e2e  # Playwright, 31 tests (starts its own dev server)
```

Playwright launches the `chromium` project. If the exact Playwright browser build is not downloaded (e.g. sandboxed environments with a pre-installed browser), point it at a system Chromium:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

Dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Local URL: `http://127.0.0.1:5173/` (Vite will fall back to `5174` if the port is taken). Note that board state persists in localStorage — clear the `vectis:*` keys (or use a fresh profile) to see the seeded board.

## What's Next

For next steps, open product questions, and the prioritised list of upcoming work, see [roadmap.md](roadmap.md).

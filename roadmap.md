# Vectis Law Command Center — Roadmap

This file tracks future product and engineering work. It is the forward-looking companion to [AGENTS.md](AGENTS.md), which describes the *current* state of the code. When picking up new work, read both.

Items are grouped by theme, not strict chronology. Within each group the most recently discussed item is listed first.

## 1. Card Content & Aesthetic

### 1.1 AI-generated widget content
The card front currently shows `Status` and `Due date` widgets sourced from sample data on each card. The longer-term intent is for these widgets to be AI-generated — i.e., an LLM picks the most relevant 1-2 data points per card (which may differ across matters) rather than a fixed pair. Until then, the schema is "two slots driven by static fields." Related: [Real agent integration](#41-real-agent-integration).

### 1.2 Surface more than two widgets where useful
Two slots are the current ceiling because of card width. If a card-front layout exists that can carry three or four signals comfortably (e.g. assignee, last activity, hours logged) without crowding the title, it should be evaluated.

### 1.3 Assignee model
Open question **(decision pending)**: should there be a separate `assignee` field on each card, or does column placement remain the only source of ownership? The My Command Centre view currently derives "my matters" from column placement plus the free-text `owner` field matching the member name — a proper assignee model would replace that heuristic. Depends on [Dynamic team roster](#32-dynamic-team-roster).

### 1.4 History UX polish
A per-card `history[]` log is appended on every status and column change and rendered in the Matter view. Future polish to consider:

- Group consecutive same-day events.
- Surface the actor (who made the change) once a real user model exists.
- Add a global event stream view across all cards.
- Retention and export rules for backend persistence.

## 2. State, Persistence & Data Model

### 2.1 Backend persistence — Supabase (decided July 2026)
**Decided: Supabase**, chosen for Postgres/SQL reporting, Row-Level Security mapping onto the sharing consent model, built-in auth, realtime, and self-host portability. The integration is live and env-gated (see [AGENTS.md, Persistence](AGENTS.md#persistence)); schema in [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql). Remaining:

- **Apply the migrations** to the project (`0001_init.sql`, then `0002_auth.sql`) and set `.env.local` (the sandbox that built this cannot reach supabase.co, so first-run verification happens on a real machine).
- **Supabase Auth — Google Workspace SSO (decided July 2026), built.** Replaces the "Viewing as" picker with a real login, stamps actors on history/work-log/time entries, and introduces the manager role. Code in [src/auth.js](src/auth.js)/[src/useAuth.js](src/useAuth.js)/[src/AuthGate.jsx](src/AuthGate.jsx); see [AGENTS.md, Authentication](AGENTS.md#authentication). Remaining: verify the live OAuth flow on a real network, and register the Google OAuth client + fill the roster emails in `0002_auth.sql`.
- **Real RLS policies — built** in [supabase/migrations/0002_auth.sql](supabase/migrations/0002_auth.sql): the auth-based policies enforce the full/totals/private consent tiers in the database (own + full-shared detail readable, totals via a SECURITY DEFINER view, private hidden; owner-only writes; manager-only rates). Replaces the pre-auth permissive policies once applied. Still to verify live end-to-end.
- **Offline queue / conflict handling** — v1 sync is last-write-wins with a debounced document push for the board; fine for a four-person team, revisit if edits collide in practice.
- **Split cards into rows** eventually, if per-card RLS or per-card history queries are needed; the ledger is already relational.

### 2.2 Real navigation targets for details-view links
`Time entries` is now an in-app button (it opens the Timesheet overlay scoped to the matter — time-tracking lives in this tool). `Task folder` still opens the card's `taskFolderUrl` in a new tab, and the sample data points at a placeholder `files.vectis.law` host — swap for the real document system once chosen **(decision pending: which system)**.

## 3. Views & Navigation

### 3.1 Extend My Command Centre
The toggle now renders a real personalised view (day planner + agent chat — see [AGENTS.md, My Command Centre](AGENTS.md#my-command-centre)). Direction confirmed with the user (July 2026): it is *the* individualised surface, and should grow. Ideas queued:

- Real calendar integration (external calendar feeds, meetings — not just card due dates).
- Richer agent conversation, including multi-agent support ("personal agent" chat is the first face of this). The agent can now log time; more write-actions (move a matter, set a status) are the natural next step.
- More personal widgets — matters recently touched, upcoming filing deadlines. (The time-logged-this-week widget shipped as the My time panel.)

### 3.2 Dynamic team roster
The four team columns are still a fixed roster, seeded in the `members` table (and mirrored by `TEAM_MEMBERS` in [src/board.js](src/board.js)). The **manager** role now exists (see [AGENTS.md, Authentication](AGENTS.md#authentication)): the manager can view-as other members and is the only one RLS lets write rates. Still to do: drive the roster from the `members` table dynamically (self-service onboarding of a new Workspace user into a free slot / new column), and gate manager-only *actions* in the UI — notably status-check resolution, which is still open to anyone (see [6. Status Check Workflow](#6-status-check-workflow--matter-nudges)).

## 4. AI Integration

### 4.1 Real agent integration
The Vectis Assistant chat in My Command Centre answers from a local, rules-based reading of the board ([src/agent.js](src/agent.js)). `getAgentReply(message, context)` is the single seam: replace its body with a call to a real agent endpoint and keep the signature. The user wants this developed next ("an agent that we can develop — look at tomorrow").

### 4.2 Real AI summaries
The `aiContext` field is hand-authored placeholder text and now only a fallback for `description`. Replace with LLM-generated summaries driven by the card's actual data and logged work. Closely related to [AI-generated widget content](#11-ai-generated-widget-content).

## 5. Timesheets, Productivity & Billing

Mission statement (user, July 2026): the tool's primary purpose is giving the individual — and the organisation, subject to the individual's comfort — visibility over productivity; billing timesheets follow as a by-product. Value is explicitly not billable-only: client work, business development, research & writing, product/tech, and training all count, hence the category model. The in-app ledger, capture surfaces, sharing levels, and CSV export are live (see [AGENTS.md, Time Ledger & Timesheets](AGENTS.md#time-ledger--timesheets)). Remaining:

### 5.1 Billing integration
Decision on record: keep the export **neutral but Zoho Books-compatible** (the workspace's likely billing system — final choice still open). Mark-as-billed and rates shipped (see Done). Remaining, roughly in order:

- **Print/PDF timesheet layout** for sending to clients directly.
- **Zoho Books push** — create invoices/time entries via the connected Zoho Books account instead of CSV, once the backend and the billing decision land.

### 5.2 Productivity depth
- Weekly/monthly trends (this week vs last), per-category over time.
- **Activity-based** unaccounted-time nudges ("you moved three cards on Tuesday but logged nothing") — needs actor attribution on history events, i.e. a real user model. The weekday-gap version shipped (see Done).
- Live timer capture (deliberately deferred from v1).
- Configurable categories (they are a constant today).

### 5.3 Sharing model hardening
Sharing levels exist (`full` default / `totals` / `private`) but are browser-local settings on the identity picker. Real enforcement needs authentication and the backend — until then it is a UX contract, not a security boundary.

## 6. Workflow & Notifications

### 6.1 Status check — remaining work
The 7-day Waiting-Response status check is live in-app (see [AGENTS.md, Status Check Workflow](AGENTS.md#status-check-workflow)). Remaining:

- **Real notifications.** "Notify each user working on the card and the team's manager" currently means the in-app banner and planner alerts. Email/push needs notification infra and the manager role from [Dynamic team roster](#32-dynamic-team-roster).
- **Manager gating.** Anyone can currently resolve a status check; once roles exist, resolution should be manager-only (assignees stay notified).
- **Threshold configuration.** 7 days is a constant (`STATUS_CHECK_THRESHOLD_DAYS`); consider per-team or per-matter overrides.

## 7. Quality & Verification

### 7.1 UI component tests
Vitest covers the pure helpers (106 tests); Playwright covers the real flows in-browser (32 tests). The middle layer — component tests with `@testing-library/react` — is still absent. Worth adding if overlay orchestration logic in `App.jsx` keeps growing.

### 7.2 CI
No CI pipeline runs the suites yet. `npm run lint && npm test && npm run build && npm run test:e2e` is the full gate; wire it into GitHub Actions. Note the Playwright browser-build caveat in [AGENTS.md, Verification](AGENTS.md#verification).

## 8. Done / Decided (kept for context)

These are settled and live in the code today. Listed here so future agents do not re-open them as "ideas".

**Time ledger, capture, and timesheets** *(new — July 2026)*

- Time entries are a **global ledger** ([src/time.js](src/time.js)), not card data — BD/training/product time needs no matter card. Card work-logs feed the ledger.
- Six **work categories** (Client Work · Business Development · Research & Writing · Product & Tech · Training · Firm Administration) with per-category billable defaults, overridable per entry. Decided: productivity is category-based, not billable-only.
- Three capture surfaces, all attributed to the current identity: the drag-flip work-log form (now with a category select), a quick-add row in the Matter view's Time section, and the assistant's `log 1.5h on the Acme MSA for …` chat command.
- **Sharing levels** per member — `full` (the decided default) / `totals` / `private` — enforced in the Firm scope of the Timesheet overlay, with private members counted rather than silently omitted.
- **Timesheet overlay** (header button, My time panel, or matter footer): Me/Firm scope, period presets, group by date/matter/client/category, inline edit/delete, billable toggles, and CSV export with Zoho Books-mappable columns. Decided: neutral CSV now, shaped for a Zoho Books integration later.
- **My time panel** in My Command Centre: week strip of category-stacked daily bars (validated categorical palette, `--cat-*` tokens), weekly total, billable split.
- **Rates & value** *(July 2026)*: hourly rate per member with per-client overrides (override wins) and a currency symbol, edited in the overlay's Rates panel. Billable entries are priced; unrated hours are reported, never silently zeroed. CSV gained Rate/Amount/Billed At columns.
- **Mark-as-billed** *(July 2026)*: "Mark shown as billed" stamps `billedAt` on visible unbilled entries; billed rows lock with an unmark chip; "Hide billed" filters them out. Closing a period can no longer double-export.
- **Unaccounted-time nudges** *(July 2026)*: weekdays this week with zero logged hours surface in the My time panel and the assistant's weekly summary.

**Status check workflow (7-day Waiting Response watchdog)** *(new)*

- `waitingSince` is stamped when a card enters the waiting column (status change or drag) and cleared when it leaves. A minute-interval sweep in `App` flags `Waiting` cards past `STATUS_CHECK_THRESHOLD_DAYS` (7) as status `Status Check` — a real status in the enum, coupled to the waiting column, distinct from `Done`.
- Flagged cards get an amber card-front treatment, a banner above the team board, and an alerts section in the My Command Centre planner. The Matter view shows a resolution panel with three actions: **assign** to a column (restores the stashed previous status), **keep waiting** (restarts the 7-day clock), or **archive** (status `Done`).
- Dragging a flagged card out of waiting also resolves the check (restores previous status).
- The seeded sample card `c4` has `waitingSince` 9 days ago so the workflow is demonstrable on first load.

**My Command Centre** *(new)*

- The bottom-left toggle now switches between the Team board and a personalised view: identity picker ("Viewing as", persisted), a **day planner** (status-check alerts, agenda grouped Overdue / Due today / Next 7 days / Later / No due date, and a month calendar with due-date dots), and the **Vectis Assistant** chat panel.
- "My matters" = cards in my column plus cards in waiting/available whose `owner` matches my name (heuristic until an assignee model exists).
- Chat replies are generated locally by rules over the live board in [src/agent.js](src/agent.js); history persists to localStorage. The panel is explicitly labelled a preview.

**Persistence (stopgap)** *(new)*

- Board, identity, and chat persist to versioned localStorage keys (`vectis:board:v1` etc.) via [src/storage.js](src/storage.js). Stored boards are shape-validated before use; anything invalid falls back to the seeded board.

**Testing and verification** *(updated)*

- Vitest: 74 tests over `board.js`, `storage.js`, `agent.js`. Playwright: 25 E2E tests over rendering, details editing, coupling, archive restore, drag flows, persistence, status checks, My Command Centre, and responsive collapse at 1440/1000/600px. Responsive behaviour has now been validated in a real browser (two layout bugs found and fixed in the process).
- Roadmap 6.1 (reducer edge cases), 6.2 (browser E2E), and 6.3 (responsive validation) from the previous revision are done. `setCardStatus` now also rejects unknown/archive destination columns when restoring from Done.

**Sample data & links** *(updated)*

- All sample cards carry `description`, `tasksUrl`, `timeEntriesUrl`, `taskFolderUrl`. Footer links open real URLs in a new tab when the card provides them; they fall back to inert `#` anchors otherwise.

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
- The click-to-open details view is **inline-editable** for title, status, due date, owner, team, client, and description. Edits flow through an `onCardChange(id, patch)` callback into an `updateCard` reducer on `App` and propagate immediately to the card front. There is no Save button.

**Reducer extraction and state shape**

- Board mutations live in [src/board.js](src/board.js) as pure helpers (`moveCardAcross`, `reorderWithin`, `updateCard`, `setCardStatus`, `applyDragLanding`, `appendWorkLogEntry`, `appendHistoryEvent`, `getArchivedCards`, plus the status-check family `getStatusCheckDueCards`, `getStatusCheckCards`, `applyStatusChecks`, `resolveStatusCheck`). `App.jsx` only orchestrates UI state — there is no inline state mutation in drag handlers.
- Each card carries `workLog[]` (user-authored entries) and `history[]` (system-emitted events). Both are appended to via pure helpers.

**Work-log form**

- All fields in `WorkLogForm` (status, description, start/end date, hours, next steps) are controlled. On Save, the form emits both `{ status }` and a full `entry` object; an entry is only appended when it has actual content (any of description/dates/hours/next-steps).
- All form inputs have proper `htmlFor`/`id` linkage.
- The drag-flip work-log editor has an `X` close button that **reverts** the move — the card returns to its origin column and unsaved form entry is discarded. Two snapshots taken at `handleDragStart` drive this: `preDragItemsRef` (state) and `preDragRectRef` (the card's on-screen rect). On cancel, the projection animates back to the pre-drag rect — not the drop location — and the snapshot is restored at the *start* of the animation so the dim placeholder is in the origin column throughout.

**Status ↔ column coupling**

- Status `Waiting` ⟺ column `waiting`; status `Status Check` ⟺ column `waiting`; status `Done` ⟺ column `archive`. Status is the single source of truth.
- Setting status to `Waiting`/`Done` from the Matter view or work-log Save moves the card into the required column and stashes `previousColumn` + `previousStatus` so a future restoration knows where it came from.
- Dragging a card into Waiting Response forces status `Waiting`; dragging a card out restores `previousStatus` (default `Reviewing`). Drops onto the archive container are blocked at the helper layer.
- Setting status away from `Done` is held as `pendingStatusChange` and surfaces an inline destination picker in the Matter view (`RESTORE_COLUMNS`). Closing the overlay or clicking *Cancel status change* rolls back the change. No silent moves.

**Archive and history**

- `ArchiveOverlay` renders the real contents of `items.archive`. Clicking an archived card closes the archive and opens the Matter view, which is the entry point for the destination picker above.
- `card.history[]` records `status` and `column` events with timestamps and is rendered as a small list in the Matter view, in the same style as the work-log entries.

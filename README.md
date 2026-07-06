# Vectis Law Command Center

A Vite + React dashboard for managing matters at a technology law practice. Cards represent legal matters and are organised across six panels — four team columns (`Partner A`, `Partner B`, `Associate 1`, `Associate 2`) plus `Available` and `Waiting Response` — with a separate `Archive` view for completed work. A `My Command Centre` view gives each team member a personalised day planner and an assistant chat.

## Quickstart

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Local URL: `http://127.0.0.1:5173/` (Vite will fall back to `5174` if the port is taken).

Without configuration the app persists to this browser's localStorage. For multi-device sync, apply [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) to a Supabase project and copy [.env.example](.env.example) to `.env.local` with the project's URL and publishable key.

## Scripts

```bash
npm run dev       # start the dev server (HMR)
npm run lint      # ESLint
npm test          # Vitest, single run
npm run test:watch
npm run test:e2e  # Playwright browser tests (starts its own dev server)
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## How the app is organised

- **[src/App.jsx](src/App.jsx)** — React components for the team board and overlays, drag state, and orchestration of status changes.
- **[src/board.js](src/board.js)** — pure helpers for every state transition: card moves, reorders, status changes (with column coupling), drag landing, work-log / history appends, and the status-check workflow.
- **[src/MyCommandCentre.jsx](src/MyCommandCentre.jsx)** — the personalised view: identity picker, My time week strip, day planner, assistant chat.
- **[src/time.js](src/time.js)** — the time ledger: work categories, entry validation, totals, sharing levels, CSV export.
- **[src/Timesheets.jsx](src/Timesheets.jsx)** — the Timesheet overlay (Me/Firm scope, grouping, export).
- **[src/agent.js](src/agent.js)** — the Vectis Assistant (local rules engine today; the seam for a real agent endpoint). Understands questions and `log 1.5h on …` commands.
- **[src/storage.js](src/storage.js)** — versioned localStorage persistence.
- **[src/index.css](src/index.css)** — design tokens, layout, projection/flip animations, responsive rules.
- **[e2e/](e2e/)** — Playwright browser tests.

`App.jsx` does not mutate `items` state inline — every change goes through a helper in `board.js`. This keeps the data model coherent and the helpers testable.

## Key concepts

- **Status is the single source of truth.** Status `Waiting` ⟺ column `Waiting Response`, status `Done` ⟺ `Archive`. Setting status from the Matter view or the drag-flip work-log form moves the card into the right column automatically.
- **Waiting cards are watched.** A card sitting in `Waiting Response` for 7 days is flagged for a **status check**: amber highlight, a banner on the board, and a resolution panel in the Matter view (reassign it, keep waiting, or archive it).
- **Restoring from Archive prompts you.** Changing an archived card's status to anything other than `Done` surfaces an inline picker — pick a destination column or cancel the change. The card never moves silently.
- **Drag is symmetric.** Dropping a card on `Waiting Response` sets status `Waiting` and remembers where it came from. Dragging it back out restores its previous status.
- **History.** Every status and column change is appended to `card.history[]` and shown as a small log in the Matter view.
- **My Command Centre.** The bottom-left toggle switches to a personal view: your week's time as category-stacked bars, status-check alerts, a due-date agenda and month calendar, and the Vectis Assistant chat (answers generated locally for now).
- **Time is a ledger, not a chore.** Hours are captured where work happens — the work-log form, a quick-add row on every matter, or by telling the assistant "log 1.5h on the Acme MSA". Entries carry a work category (client work, business development, research, product, training, admin) because value isn't billable-only.
- **Timesheets fall out for free.** The Timesheet overlay filters by period, groups by matter/client/category, respects each member's sharing level (full detail / totals only / private — full is the default), and exports a Zoho Books-mappable CSV.
- **State survives refresh — and syncs.** Everything persists to localStorage, and when Supabase env vars are set, the board and ledger sync across devices in realtime (auth and database-enforced sharing are the next step).

## Where to go next

- [AGENTS.md](AGENTS.md) — current state of the code in detail.
- [roadmap.md](roadmap.md) — future product and engineering work, open questions, and a list of done/decided items kept for context.

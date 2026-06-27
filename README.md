# Vectis Law Command Center

A Vite + React dashboard for managing matters at a technology law practice. Cards represent legal matters and are organised across six panels — four team columns (`Partner A`, `Partner B`, `Associate 1`, `Associate 2`) plus `Available` and `Waiting Response` — with a separate `Archive` view for completed work.

## Quickstart

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Local URL: `http://127.0.0.1:5173/` (Vite will fall back to `5174` if the port is taken).

## Scripts

```bash
npm run dev       # start the dev server (HMR)
npm run lint      # ESLint
npm test          # Vitest, single run
npm run test:watch
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## How the app is organised

- **[src/App.jsx](src/App.jsx)** — React components, drag/overlay state, and orchestration of status changes.
- **[src/board.js](src/board.js)** — pure helpers for every state transition: card moves, reorders, status changes (with column coupling), drag landing, and work-log / history appends.
- **[src/board.test.js](src/board.test.js)** — Vitest coverage of the helpers above.
- **[src/index.css](src/index.css)** — design tokens, layout, projection/flip animations, responsive rules.

`App.jsx` does not mutate `items` state inline — every change goes through a helper in `board.js`. This keeps the data model coherent and the helpers testable.

## Key concepts

- **Status is the single source of truth.** Status `Waiting` ⟺ column `Waiting Response`, status `Done` ⟺ `Archive`. Setting status from the Matter view or the drag-flip work-log form moves the card into the right column automatically.
- **Restoring from Archive prompts you.** Changing an archived card's status to anything other than `Done` surfaces an inline picker — pick a destination column or cancel the change. The card never moves silently.
- **Drag is symmetric.** Dropping a card on `Waiting Response` sets status `Waiting` and remembers where it came from. Dragging it back out restores its previous status.
- **History.** Every status and column change is appended to `card.history[]` and shown as a small log in the Matter view.

## Where to go next

- [AGENTS.md](AGENTS.md) — current state of the code in detail.
- [roadmap.md](roadmap.md) — future product and engineering work, open questions, and a list of done/decided items kept for context.

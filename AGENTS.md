# Vectis Law Command Center — Agent Notes

This file describes the **current state** of the codebase. For forward-looking work — what to build next, open product questions, and decided-but-unimplemented direction — see [roadmap.md](roadmap.md).

## Project Overview

Vectis Law Command Center is a Vite + React dashboard for a technology law practice. The board surfaces six task columns in a card-based layout:

- Four team columns: `Partner A`, `Partner B`, `Associate 1`, `Associate 2`.
- Two bottom-row columns: `Available` (left), `Waiting Response` (right).

Cards are draggable between columns with `@dnd-kit`. The board distinguishes two card interactions, which trigger different overlays — see [Card Interaction Modes](#card-interaction-modes).

A bottom-left segmented control toggles between a `Team` view and a `My Command Centre` view. It currently only updates `commandMode` state — it does not filter board content yet. Filtering behaviour is open; see [roadmap.md, Wire the Team / My Command Centre toggle](roadmap.md#31-wire-the-team--my-command-centre-toggle).

The `Vectis Law Command Center` label is a small fixed element in the bottom-right of the viewport, intentionally low-emphasis so visual weight stays on the cards. An `Archive` button sits immediately to its left — see [Archive](#archive).

## Tech Stack

- React 19
- Vite 8
- Vanilla CSS in [src/index.css](src/index.css)
- Drag and drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Icons: `lucide-react`

## Files of Interest

- [src/App.jsx](src/App.jsx) — all React components and state.
- [src/index.css](src/index.css) — design tokens, layout, projection/flip animations, responsive rules.
- [src/App.css](src/App.css) — intentionally empty; styles are consolidated in `index.css`.
- [index.html](index.html) — still bears the Vite template `<title>`; not yet rebranded.

Card data is hardcoded in `INITIAL_ITEMS` inside [src/App.jsx](src/App.jsx). There is no backend, no persistence, and no real AI integration yet — see [roadmap.md, State, Persistence & Data Model](roadmap.md#2-state-persistence--data-model).

## Layout Rules

- The board occupies close to the full viewport width.
- Top row: four team panels in a single grid (`.board-grid`).
- Bottom row: two status panels in a separate grid (`.status-grid`), shorter than the top row.
- Panel height is **fixed** (driven by `--panel-height`) and never changes due to card content or focus state. Overflowing cards scroll inside the panel via `.card-list`, with a minimal scrollbar that is transparent at rest and visible on hover/focus.
- Responsive collapse: two columns at ≤1180px, single column at ≤720px. Real-browser validation is still outstanding (see [roadmap.md, Responsive behaviour](roadmap.md#54-responsive-behaviour)).

## Card Surfaces

Three surfaces share one visual language — a kicker + h2 header, a meta-grid for primary data points (status, due date), and `details-section-label` styling for any secondary labels. Treat them as one component family.

### Card front

Layout, top to bottom:

1. `.card-heading` — title (primary) plus the card's **client** as a muted subtitle directly beneath. The subtitle is omitted when `card.client` is empty.
2. `.card-widgets` — two compact meta-items, `Status` and `Due date`, in a mini version of `.details-meta-grid`. Status icon comes from `STATUS_META` in [src/App.jsx](src/App.jsx). Missing values fall back to `Not set` / `No due date`.

Sample statuses populated in `INITIAL_ITEMS`: `Not Started` · `Research and Planning` · `Drafting` · `Reviewing` · `Waiting` · `Done`. These are loose strings — no enum enforcement, no behavioural coupling between status and column placement yet. See [roadmap.md, Status model](roadmap.md#13-status-model-enum-coupling-and-driven-moves).

Client is a true enum on the Matter view — values are constrained to the `CLIENTS` list in `App.jsx`. The card front renders whatever string the card holds.

### Drag-flip work-log editor (`ProjectedCard`)

Triggered when a card is dragged into a *different* column. The overlay copy animates out of the landed card, flips to `WorkLogForm`, and reverses on Save. The form uses the same kicker (`Log work`) + h2 (card title) header as the details view, with an `X` close button on the right.

The form's first field is a **Status** select populated from `STATUS_META` and defaulted to the card's current status. On Save, `WorkLogForm` passes `{ status }` up through `ProjectedCard.handleSave` → `App.onSave`, which applies the patch through `updateCard` before clearing the projection. The form's other fields (description, dates, hours, next steps) remain uncontrolled — see [roadmap.md, Bind the work-log form to card state](roadmap.md#21-bind-the-work-log-form-to-card-state).

Cancel behavior: clicking the `X` discards any unsaved form entry and **reverts the move** — the card returns to its origin column. Two snapshots taken in `handleDragStart` drive this: `preDragItemsRef` (the `items` state) and `preDragRectRef` (the dragged card's `getBoundingClientRect`).

On cancel, the projection animates back to `preDragRectRef` (the card's original on-screen position), not to the drop location. The snapshot restore is triggered at the *start* of the cancel animation, so the dim placeholder is already in the origin column while the projection is collapsing — the projection lands cleanly on top of it instead of jumping at the end. Implemented with paired callbacks `onCancelStart` (restores items) and `onCancel` (clears the projection after the animation).

### Click-to-open details view (`FocusedCardDetails`)

Triggered when a card is clicked without being dragged. Seven fields are inline-editable: **title**, **due date** (loose text input), **status** (select of `STATUS_META` keys), **owner** (text), **team** (text), **client** (select of `CLIENTS`), and **description**. The five meta fields sit in `.details-meta-grid` — two rows of two side-by-side, with `Client` spanning the full width on the third row via `.details-meta-item--wide`. Edits flow through an `onCardChange(cardId, patch)` callback into the `updateCard` reducer on `App`, which merges the patch into the matching card. There is no Save button — changes propagate immediately, and any fields the card front surfaces re-render from the same source.

Below the description, a `.details-footer` pins two external links to the bottom: `Time entries` (left) and `Task folder` (right). Both call `event.preventDefault()` for now — see [roadmap.md, Real navigation for details-view links](roadmap.md#24-real-navigation-for-details-view-links).

- Status icon next to the select stays in sync with the selected value.
- The three external-link fields (`Open tasks`, `Time entries`, `Task folder`) are not editable — they remain anchors.
- Closes on backdrop click, the X button, or `Escape`. When focus is inside an editable field, `Escape` blurs the field first; a second `Escape` closes the overlay.
- Card clicks are suppressed for ~500ms after `dragStart` / `dragEnd` via `suppressCardOpenUntilRef`, so a drop never inadvertently opens the details view.

Optional card fields consumed by the details view: `dueDate`, `description`, `tasksUrl`, `timeEntriesUrl`, `taskFolderUrl`. Sample `status` and `dueDate` are populated in `INITIAL_ITEMS`; the other three are not — see [roadmap.md, Populate details-view fields](roadmap.md#23-populate-details-view-fields-on-real-card-data). Links currently call `event.preventDefault()` — see [roadmap.md, Real navigation for details-view links](roadmap.md#24-real-navigation-for-details-view-links). Edits are not persisted across sessions — see [roadmap.md, Backend persistence](roadmap.md#22-backend-persistence).

## Archive

An `Archive` button sits in the fixed bottom-right of the viewport, immediately left of the `Vectis Law Command Center` label. Clicking it opens `ArchiveOverlay`, which uses the same projection layer and panel styling as the details view. The current state is a placeholder empty state — no card routing into or out of the archive is wired yet. See [roadmap.md, Archive view, routing, and restore](roadmap.md#14-archive-view-routing-and-restore).

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
- `prefers-reduced-motion: reduce` is honoured in CSS. Preserve or improve this when touching animation code.

## Known Gaps (in current code)

These are facts about today's code. The plan to address each lives in [roadmap.md](roadmap.md).

1. Work-log form inputs are uncontrolled; nothing is saved on Save. (The click-to-open details view *does* save edits into card state — see [Card Surfaces](#card-surfaces).)
2. Card state — including details-view edits — is not persisted across sessions.
3. `card.status` is a loose string — no enum, no coupling to column placement, no audit log.
4. Archive view is a placeholder empty state — no routing into or out of the archive yet.
5. Team columns are hardcoded.
6. Form labels are visual only — inputs need `id` / `htmlFor`.
7. `commandMode` toggle does not filter the board.
8. Details overlay's link fields (`tasksUrl`, `timeEntriesUrl`, `taskFolderUrl`) and `description` fall back to placeholders / `#` hrefs because `INITIAL_ITEMS` does not provide them.
9. No automated tests (unit or E2E).
10. Responsive behaviour exists in CSS but has not been validated in a real browser.

## Verification

Known-green commands:

```bash
npm run lint
npm run build
```

Dev server (used during the latest sessions):

```bash
npm run dev -- --host 127.0.0.1
```

Local URL: `http://127.0.0.1:5173/` (Vite will fall back to `5174` if the port is taken).

Interactive browser testing has not been wired up. Playwright is not installed — see [roadmap.md, Browser E2E tests](roadmap.md#52-browser-e2e-tests).

## What's Next

For next steps, open product questions, and the prioritised list of upcoming work, see [roadmap.md](roadmap.md).

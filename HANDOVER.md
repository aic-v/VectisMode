# Handover — Vectis Law Command Center

You are picking up an in-progress build of the Vectis Law Command Center, a
Vite + React dashboard for a technology law practice (repo: `aic-v/VectisMode`).
You are working for Aadil (aadil@vectis.law), who reviews work via PR and
answers product questions when asked — ask sharp questions early, then work
autonomously and report outcomes.

## Read these first, in order

1. [AGENTS.md](AGENTS.md) — the current state of the code. Accurate as of the
   last commit; trust it.
2. [roadmap.md](roadmap.md) — forward work, open decisions, and a
   Done/Decided section that exists so you do not re-litigate settled choices.
3. This file — session context that lives nowhere else.

## Product mission (verbatim intent from Aadil)

The tool's primary purpose is **individual — and organisational, subject to the
individual's comfort — visibility over productivity**, with billing timesheets
falling out as a by-product. Value is explicitly not billable-only: client
work, business development, research & writing, product/tech, and training all
count (hence the six work categories). My Command Centre is *the* personal
surface and should keep growing; the assistant chat is intended to become a
real (eventually multi-)agent.

## Where things stand

Everything below is built, tested (Vitest 111 / Playwright 32, lint + build
green), documented, and pushed to branch
`claude/directory-review-questions-psubm8`, tracked by **PR #4**
(https://github.com/aic-v/VectisMode/pull/4):

- Kanban board with status↔column coupling, archive + destination-picker
  restore, drag-flip work-log editor with cancel-revert.
- 7-day Waiting-Response **status check** watchdog with resolution panel.
- **My Command Centre**: day planner + calendar, My time week strip,
  sharing-level picker, Vectis Assistant chat (local rules engine).
- **Time ledger**: global member-attributed entries with categories; capture
  via work-log form, Matter-view quick-add, and chat commands
  ("log 1.5h on the Acme MSA for reviewing the cap yesterday").
- **Timesheets**: Me/Firm scope with sharing-level enforcement, grouping,
  rates (member + client override) with priced totals, mark-as-billed with
  locked rows, Zoho Books-mappable CSV export.
- **Supabase integration** (env-gated): schema in
  `supabase/migrations/0001_init.sql`, sync layer in `src/remote.js` +
  `src/useRemoteSync.js`. Local-only without env vars.

## Supabase project (created, NOT yet verified end-to-end)

- URL: `https://ispxqixgvdjszcchcoyv.supabase.co`
- Publishable key (browser-safe by design):
  `sb_publishable_0xa2hTGD6axR7eC9WvwXaQ_ENI3tIZL`
- `.env.local` (gitignored) should contain `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` with those values — see `.env.example`.
- **Never** put the service-role key or database password in the repo or env
  files. The DB password was shared in chat once; Aadil was advised to rotate
  it. If you need SQL access, ask him to run things in the SQL editor or to
  share credentials through a secret, not chat.
- The migration may not have been applied yet — confirm with Aadil before
  assuming tables exist. First-run behaviour if applied: local state seeds
  upward on first load; remote wins on subsequent loads.

## Pending user actions (nag politely if still open)

1. Apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor.
2. Create `.env.local` on his machine and confirm live sync works.
3. Rotate the database password.
4. Decide the auth method: magic-link email vs Google/Microsoft SSO.
5. Review/merge PR #4.

## Next build work, in priority order

1. **Supabase Auth + real RLS** (blocked on decision 4 above). Replace the
   "Viewing as" picker with real login; map members to auth users; activate
   the auth-phase policies sketched at the bottom of the migration so the
   sharing tiers (full/totals/private, default full) are database-enforced;
   stamp actors on history events and work logs. This unlocks the manager
   role and activity-based nudges.
2. **Verify live sync end-to-end** on a real network (this cannot be done
   from a sandbox whose network policy blocks supabase.co — check
   `curl -sS "$HTTPS_PROXY/__agentproxy/status"` before wasting time).
3. **Real agent endpoint** — replace the body of `getAgentReply` in
   `src/agent.js` (keep the signature: returns `{ text, timeEntry }`). A
   Supabase Edge Function holding the LLM key is the intended home. The local
   rules engine stays as offline fallback. Aadil wants the agent to grow
   write-actions (move matters, set statuses) and eventually multi-agent.
4. **Billing last mile** — print/PDF timesheet layout; later a Zoho Books
   push (keep the CSV columns Zoho-mappable; that decision is on record).
5. **CI** — GitHub Actions running `npm run lint && npm test && npm run build
   && npm run test:e2e`. Mind the Playwright browser caveat below.
6. Roadmap §§1–7 for everything else (dynamic roster + manager role,
   status-check notifications, assignee model decision, component tests,
   timers, configurable categories, trends).

## Decisions on record (do not reopen without new instruction)

- Backend: **Supabase** (SQL reporting, RLS→consent model, auth, realtime,
  portability).
- Sharing default: **full transparency**, member can drop to totals-only or
  private ("member-controlled tiers, full as default").
- Export: **neutral CSV, Zoho Books-compatible columns**; Zoho push later.
- Productivity is **category-based**, not billable-only.
- Time capture: work-log form + quick-add + chat commands; live timer
  deliberately deferred.
- Card focus is a projection overlay — never revert to in-column expansion.
- Time entries are a **global ledger**, not card data.

## Working agreements & gotchas

- Verification gate before any push:
  `npm run lint && npm test && npm run build` and
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`
  (that env var points Playwright at a pre-installed Chromium when the exact
  browser build isn't downloaded; plain `npm run test:e2e` works elsewhere).
- The eslint `react-hooks/purity` rule is strict: no `Date.now()`/impure calls
  reachable from render; JSX inline handlers are fine, intermediate
  render-scope helper functions that call impure code are not — extract a
  child component instead.
- `--panel-height` overrides need specificity ≥ `.my-centre-grid .my-panel`
  or the base media queries clobber them (this has bitten twice; the
  responsive spec guards it).
- Playwright selectors: several UI classes are reused for styling
  (`.archive-button`, `.timesheet-export`) — always filter by text.
- Update AGENTS.md/roadmap.md in the same commit as behaviour changes; keep
  the Done/Decided list current so future sessions don't reopen decisions.
- Commit in logical chunks with descriptive messages; push to the designated
  branch; don't open PRs unprompted. If PR #4 has been merged, restart the
  branch from the latest default branch rather than stacking on merged
  history.

---
name: principal-ui-ux
description: Enforce Principal UI/UX design and production engineering standards (Linear, Stripe, Vercel tier) across all frontend components, layouts, tables, settings, CSS, server actions and queries in src/. Trigger whenever creating, editing, refactoring, or auditing any UI, page, stylesheet, server action or database query.
---

# Principal UI/UX Design Standards (Linear / Stripe / Vercel tier)

Whenever creating, refactoring, or auditing ANY screen, layout shell, table, chart, or interactive component in `src/`, enforce these standards. Never generate plain, boxy, generic, or stretched interfaces.

**Project rules that win over anything below** (from the product owner):
- Keep the current colours and the existing tokens in `src/app/globals.css`. Do not introduce a second token system or a new palette.
- No filler or explanatory sentences under headings, in forms or in empty states. Labels and one short line where it is genuinely needed, nothing more.
- No duplicate features: reuse the existing component or page before adding a new one.
- Keep the database simple; UI work never needs a new table.

---

### 1. Spatial architecture & fluid scaling (all viewports)
- **Same order everywhere:** Keep the same feature order and placement on mobile (375px) and desktop (1920px). Scale with `clamp()`, `minmax()` and fluid grids. Collapsing *secondary detail* on a phone (e.g. a colleague list behind a tap, a colour legend) is allowed; hiding a *control or action* is not.
- **Purposeful density:**
  * **Forms & single-entity views** (Profile, Time off, Settings, Checklists): constrain width (`max-width: 860px; margin: 0 auto`) and pair related short inputs side by side (`grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`). On a phone, date and time inputs stack one per row (iOS date fields do not shrink).
  * **Operational workspaces** (Weekly Roster, inventory, analytics, live floor): use the width (up to `max-width: 1600px`) with multi-column fluid grids.
- **Escape paths:** Every nested page has one top-left back link (`← Parent`) above the title. Never at the bottom of the page, never two tab bars stacked. Secondary view switches (`Week | Month`, `Active | History`) are compact segmented pills in the header.

### 2. Surfaces & token discipline
- **Three surface levels, existing tokens only:**
  1. page background (the body / shell background),
  2. `--surface` for cards and tables,
  3. `--surface-2` (and `--surface-3` where needed) for nested strips, hover rows and insets.
- **Hairline borders, soft elevation:** `1px solid var(--border)` plus the existing `--shadow`; no heavy drop shadows or thick borders.
- **No inline overrides:** no new `style={{...}}` or hard-coded hex colours in `.tsx`. Heights (`--control-h` 44px, `--control-h-compact` 36px), radii (`--radius-sm`, `--radius`, `--radius-lg`) and colours come from `globals.css` so light and dark modes stay consistent. Dynamic values (a bar's width, an avatar size) are the only accepted inline styles. The design ratchet (`scripts/checks/design-tokens.cjs`) must not grow.

### 3. Typography & numbers
- `font-variant-numeric: tabular-nums` on hours, timers, euro amounts, stock counts, temperatures and percentages.
- Page headings and hero figures may use tight letter-spacing (`-0.02em`); metadata labels use the muted text token at 12px with a 4–6px gap to the value.

### 4. Interaction & perceived speed
- Buttons, cards, rows and toggles: `150ms` transitions, a visible `:focus-visible` ring, subtle press feedback (`transform: scale(0.99)`). Respect `prefers-reduced-motion`.
- **Optimistic UI for low-risk actions** (toggling availability, marking read, reordering a draft): update instantly and reconcile in the background; show a toast only if the server refuses.
  **Never optimistic** for clock in/out, payroll, approvals that pay money, publishing a roster or posting stock: wait for the server and show its answer.
- Initial loads use layout-matched skeletons, not spinners, so nothing jumps.

### 5. Tables, status & empty states
- Tables: sticky headers, row hover, right-aligned numbers, rare actions in a `···` menu on the far right instead of several buttons per row.
- Status pills: soft tinted background, readable text, 6px dot (success = in stock / confirmed, warn = pending / low, danger = expired / violation, neutral = draft).
- Empty states: a short title and, where there is one, the next action as a button. No generic "0 items found", and no explanatory paragraph.

### 6. Speed for power users
- Prefer inline edit (Enter to save, Escape to cancel) over a modal for single-value edits.
- A global `Ctrl/Cmd+K` search exists for managers (`/search`); new pages should be reachable from it rather than adding more menu entries.

### 7. Dashboards
- Home and analytics screens: a disciplined grid with a few hero figures and an exceptions list next to them.
- No bare number without context: show the target, the change against last period, or the unit next to it. If the data needed for that is not available, show the number with its unit only; never invent a comparison.

### 8. Copy & progressive disclosure
- Keep cards scannable; reveal secondary details and filters on tap or toggle, never 15 controls at once.
- Short action labels: `Publish roster`, `Log waste`, `Approve swap`, `November` (not `Submit form data`, `All of November`). German and English both, via the existing i18n.

### 9. Header corner anchoring
- In every page and card header: title (and date) top-left, view switch or primary action top-right, on one line (`display: flex; justify-content: space-between; align-items: center`). Use the shared `PageHeader` with its `actions` slot.

### 10. Locked KPI strips on mobile (375px)
- A strip of 2–3 short metrics (e.g. `Shifts | Target | Remaining`) stays in one row (`grid-template-columns: repeat(3, minmax(0, 1fr))`) at 375px; scale padding and figure size with `clamp()` so the third metric never wraps alone.

### 11. Settings & preferences
- Every preference row (Language, Light mode, Push notifications) has its working control on the right. If the device cannot support it, show the control disabled with a one-line reason, never just the label.
- Daily work lives in `My Day` (Availability, Time off, My Hours). Account-level things (Workplace links, Preferences, Notifications) live in `Profile`.

## Principal software engineering & anti-vibe-coding standards

Never write fragile, happy-path-only prototype code. Every feature must hold up in real multi-branch restaurant operations in the Europe/Berlin time zone.

### 13. Research first, no filler, role-first dashboards
- **Research before building:** before writing or changing a component, dashboard or layout, read the sibling pages, `src/components/ui.tsx`, the tokens in `src/app/globals.css` and the related files in `src/lib/queries/`. Plan the grid, data density and workflow up front; never build a one-off layout that clashes with existing patterns.
- **No AI filler:** no chatty or obvious subtitles under headings or inside cards ("Welcome back! Here you can manage your shifts", "Use this tool to track inventory easily"). Labels, live status and numbers carry the screen.
- **Role-first dashboards:** a card belongs on a role's first screen only if that role acts on it within the first five seconds:
  * **Employee:** next shift, clock-in state, pending actions. No management clutter.
  * **Shift leader:** today's team on the floor, prep and HACCP status (temperatures, checklist), open shift gaps.
  * **Branch manager:** labour versus sales, uncovered roster slots, approvals waiting for a decision.
  * **Branch / brand owner:** branch financial health, stock and waste anomalies, branches ranked by outliers.
- **Every card is actionable or analytical:** if a card shows neither a comparative figure nor leads to an action, remove it.

### 14. Thin UI, logic in `src/lib` and the database
- No labour maths, time-zone arithmetic, Minijob or pay calculations, or database orchestration inside `.tsx` files. Business rules live in pure, tested functions in `src/lib/`; integrity lives in Postgres (constraints, `SECURITY DEFINER` functions in `private`, RLS).
- **One source of truth:** search `src/lib/` before writing any helper (dates: `src/lib/time/berlinDate.ts`; shift times: `src/lib/time/roster.ts`; pay: `src/lib/pay/`; roles: `src/lib/auth/rank.ts`; formatting: `src/lib/format.ts`). Never add another copy.

### 15. Failure-first engineering (real restaurant conditions)
Assume the Wi-Fi drops mid-shift, two managers edit the same roster at once, and night shifts cross midnight (`17:30 → 02:00`) and the clock change.
- **Network:** critical floor actions either queue (attendance already has an offline queue) or fail with a clear message and keep the user's input. No unhandled promise rejections.
- **Concurrency:** shared branch state (rosters, stock counts, transfers, approvals) is changed with a version / compare-and-swap check or inside one atomic database function. A refused write tells the user to reload; it never silently overwrites.
- **No silent catches:** no empty `catch {}`. Show a short, translated message to the user; on the server, return the error or let Sentry capture it. A failed read must never look like "no data" or "no problems".
- **Time:** use real instants (`zonedToUtc`) for durations and rest; never minutes-since-midnight across days.

### 16. Types and bounded queries
- **No new `any`:** do not add `any`, `@ts-ignore` or `as unknown as`. The codebase still has older `any` casts (about 280): do not copy them; reduce them when you touch a file. Type new code from `src/lib/database.types.ts` where practical.
- **Validate inputs at the boundary:** every server action and route checks its input before touching Supabase, with the existing typed guards (e.g. `isAvailDays`, `validOperation`, `isParsedNote`). Do not add a validation library without asking.
- **Bounded reads:** reads on growing tables (`attendance_logs`, `waste_log`, `audit_logs`, notifications, stock history) are scoped by branch and date range and paginated or limited (`readAll` has a hard ceiling). No unbounded `select('*')`.

### 17. Verify before calling a task done
Run what applies and report honestly what was and was not run:
1. `npx tsc --noEmit` (or the staging build `node scripts/ops/start-local-staging.mjs --fast`, which type-checks): zero errors.
2. `npm test` (Vitest) for the files touched, plus a new or updated test for any new logic.
3. The `scripts/checks/*.cjs` that cover the area (all run in CI). Always: `design-tokens`, `a11y-static`, `server-messages`; for database changes the matching PGlite check.
4. For UI: look at the screen at 375px and desktop width (staging or a browser preview).
5. New migrations: say so explicitly; they must be run in production before merging.

### 12. Self-check — run last, covers sections 1–17
1. Buttons and inputs in one row share the same height (`--control-h`) and baseline; header switches sit top-right.
2. Same sequence at 375px and 1920px, no horizontal page overflow, no orphaned metric.
3. Numbers use `tabular-nums`; surfaces use the existing tokens.
4. No new inline `style={{}}` or hex colours (run `node scripts/checks/design-tokens.cjs`).
5. Every nested page has a top-left way back to its parent.
6. Every setting has a working control; copy is short and in both languages.
7. If a screen was changed, look at it at 375px and desktop width before calling it done (staging or a browser preview), and say plainly if that was not possible.
8. Did I research existing codebase patterns first, strip out all generic "vibe-coded" filler, and keep every dashboard card role-relevant and actionable?
9. Is the logic in `src/lib` or the database (not the component), are failures and concurrent edits handled, are reads bounded, and did the verification in section 17 pass?

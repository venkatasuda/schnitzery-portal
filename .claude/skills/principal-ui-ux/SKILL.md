---
name: principal-ui-ux
description: Enforce Principal UI/UX design standards (Linear, Stripe, Vercel tier) across all frontend components, layouts, tables, settings, and CSS in src/. Trigger whenever creating, editing, refactoring, or auditing any UI, page, or stylesheet.
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

### 12. Self-check before finishing any UI change
1. Buttons and inputs in one row share the same height (`--control-h`) and baseline; header switches sit top-right.
2. Same sequence at 375px and 1920px, no horizontal page overflow, no orphaned metric.
3. Numbers use `tabular-nums`; surfaces use the existing tokens.
4. No new inline `style={{}}` or hex colours (run `node scripts/checks/design-tokens.cjs`).
5. Every nested page has a top-left way back to its parent.
6. Every setting has a working control; copy is short and in both languages.
7. If a screen was changed, look at it at 375px and desktop width before calling it done (staging or a browser preview), and say plainly if that was not possible.

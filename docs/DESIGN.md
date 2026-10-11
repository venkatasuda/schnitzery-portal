# Schnitzery Portal — Design & UI

_Last updated: 2026-10-10. Source of truth is `src/app/globals.css`; this summarizes it._

## 1. Principles
- **Mobile-first.** Designed for a phone held in a busy kitchen — large tap targets,
  bottom navigation, minimal typing.
- **One hand, few taps.** Common actions (clock, count, log waste) are quick-tap.
- **Bilingual by default.** Every user-facing string resolves through `useLang()` /
  `messages.ts` (EN + DE); a missing key falls back to English, never breaks.
- **Light default.** White surfaces, slate text and teal navigation/actions; saved dark preferences remain supported; a light theme
  via `html.light`.

## 2. Theme tokens (`:root` in globals.css)
- **Brand:** `--red:#a63c40`, `--red-dark:#7e2c33`, `--red-light:#ed8b8f`;
  `--gold:#d4a847`, `--gold-light:#f0c860`; `--gold-ink` (text-contrast gold, flips in
  light mode to `#18675e`).
- **Neutrals (dark):** `--black:#111318`, `--dark/dark2/dark3`, `--white`, `--off-white`.
  Light mode overrides these under `html.light`.
- **Status:** `--success:#71d0a0`, `--warn:#edbc69`, `--danger:#f19b9e`; light mode uses darker text variants.
- **Shape:** `--radius:12px`, `--radius-sm:8px`.
- **Shadow:** `--shadow` (subtle), `--shadow-red` (alias).
- **Type:** `--font-display:"Playfair Display"` (brand), `--font-body:"DM Sans"`.

Always use tokens, never hardcoded hex, so light/dark and future rebrands stay consistent.

## 3. Components & patterns
- **Layout:** `(app)/layout.tsx` = header (brand, role label, search, notification bell,
  language + theme toggle, avatar) + content + `BottomNav` (role-aware).
- **Cards:** `.card` and `.feature-card` use flat surfaces, token borders, and subtle shadows.
- **Tabs:** `.hub-tabs` uses a segmented surface with a clearly selected tab.
- **Tables:** `.data-table` has aligned numeric columns, readable headers, and row dividers. Inventory rows become labelled cards below 600px.
- **Buttons:** `.btn-gold` primary; standard buttons otherwise.
- **Charts:** `src/components/dash/Charts.tsx` — ProgressRing, DonutStat, MiniBars,
  RankBars, Legend; `useTheme()` reads CSS vars + a MutationObserver so charts recolor on
  light/dark switch.
- **Feedback:** toast host, skeleton loaders, sync-status indicator (offline-aware).
- **Motion:** `.fade-up` screen transition; short transitions with reduced-motion support.

## 4. Role-adaptive UI
- Owners (`brand_owner`/`super_admin`) get a branch/owner **view toggle**; in "branch"
  view they navigate as a manager.
- Managers see management actions (approvals, staff controls, inventory setup); staff see
  self-service (clock, my day, logs); kiosk accounts are redirected to `/kiosk`.

## 5. Accessibility & localization notes
- Contrast handled via `--gold-ink` so gold text stays legible on light backgrounds.
- All new strings must be added to **both** EN and DE in `messages.ts`.
- Product names in inventory can be bilingual in one field (e.g. `Käse/Cheese`) because
  the table has a single `product` column; category/UI labels switch with the toggle.

## 6. Known rough edges / backlog (design)
- Some screens still read slightly "raw"; polish layer is applied but not every page is
  audited. (Reviewer feedback noted.) A full design-system doc per component is a ROADMAP item.
- The AI assistant panel (`AgentChat`) is intentionally minimal for Phase 1 (no streaming).

## Management and employee layouts
- Managers and owners use `ManagementNav`: grouped Operations, Workforce, and Business links, a fixed desktop sidebar, and a native collapsible mobile menu.
- Staff retain the focused bottom navigation and narrower mobile content area.
- Both layouts use the same routes, backend, and existing permission checks; HQ branch view continues to affect navigation.
- Management content supports a 1440px workspace; the employee content stays at 820px.
- The header includes language and theme controls; keyboard users can skip directly to main content.
- Inventory uses a compact category/view/action toolbar rather than stacked full-width controls.

## UI UX Pro Max review
Guidance: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md
- Applied minimal style with slate backgrounds/text, white surfaces, blue actions, and token-based status colors. Retained existing DM Sans typography.
- Management tabs use an underline; feature icons share a blue tint. Employee navigation remains compact.
- Inventory form labels wrap their controls; compact view buttons keep 44px targets.
- Design searches supported a minimal style, but both returned a marketing-page composition. That composition was rejected; layout follows the skill priority checklist and existing workflows.
- Signed-in responsive visual review and production build remain pending.

## Dashboard structure
- Branch managers: four KPI cards; attention and weekly schedule panels; cost and waste panels; specific quick actions without repeating sidebar navigation.
- HQ: organization-wide totals from getOrgOverview, branch table, compliance/system signals, waste ranking.
- Failed top-level queries display dashes and an unavailable message instead of an all-clear state. Existing query-level behavior remains unchanged.
- Employee dashboard retains clocking and personal hours. No POS/revenue data was invented.
- Generic layout advice was obtained through Lovable; implementation stays in the existing Next.js portal.

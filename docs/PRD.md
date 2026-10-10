# Schnitzery Portal — Product Requirements (PRD)

_Last updated: 2026-10-10. Living document — keep in sync with the app, not aspirational._

## 1. Summary
A production, mobile-first workforce and operations platform for the **Schnitzery**
restaurant franchise: multiple independently-owned branches (Stuttgart + Berlin and
beyond), one app. It covers the full shift-to-stock lifecycle — attendance,
scheduling, payroll inputs, inventory, food safety (HACCP), waste/expiry, cross-branch
transfers — with permissions enforced in the database, not just the UI.

## 2. Problem
A growing franchise ran operations on paper, spreadsheets, and WhatsApp: hours were
disputable, stock counts lived in notebooks, food-safety logs were unverifiable, and
no owner had a cross-branch view. Each branch is independently owned, so data must be
**strictly isolated per branch** while owners still get a roll-up.

## 3. Users & roles
Six-level role model (rank in parentheses); every data rule keys off it:

| Role | Rank | Scope | Typical use |
|---|---|---|---|
| `super_admin` | 5 | all branches | platform owner / developer |
| `brand_owner` | 4 | all branches | franchise HQ — payroll & cost across branches |
| `branch_owner` | 3 | own branch | owns one location |
| `manager` | 2 | own branch | runs daily ops, approves, sets inventory |
| `staff` | 1 | self | clocks in, logs stock/waste/temps |
| `kiosk` | 0 | one device | shared tablet clock screen |

A `user_branches` table allows multi-branch owners (one person over several Berlin
branches sharing a cloud kitchen). Inventory and all branch data are **per-branch** —
never global.

## 4. Goals / non-goals
**Goals:** tamper-proof attendance; per-branch isolation with owner roll-up; run a
branch end-to-end from a phone; EN/DE throughout; offline-tolerant clock; a demo that
shows real-looking data.
**Non-goals (now):** POS integration; full accounting/payroll *run* (we produce inputs,
not file taxes); customer-facing ordering; the autonomous ops agent beyond read-only
Phase 1 (see ROADMAP).

## 5. Feature set (shipped)
- **Attendance** — server-stamped clock in/out + breaks, geofence, corrections, late
  tracking, tamper-proof hours. Kiosk mode for shared tablets.
- **Scheduling** — weekly roster, shift templates/times, availability, leave requests,
  cover requests with auto-reassignment, swaps, hours-vs-contract board.
- **Inventory & ops** — scan-to-count (QR + camera), stock heat-map, deliveries with
  cost, shrinkage/variance analytics, depletion forecast, supplier POs, shopping-list
  export (copy/CSV/PDF).
- **Waste & expiry** — auto-costed waste log by reason; expiry/FIFO batch tracking;
  discards flow into waste automatically.
- **Cross-branch transfers** — request stock from another branch, status tracked.
- **Food safety** — temperature/HACCP logging with forced corrective actions + an
  immutable audit trail; incident log.
- **Cost tooling** — monthly ops summary (CSV), food-cost what-if simulator.
- **Dashboards** — role-specific, with charts (attendance, labour/food cost, waste trend,
  waste-by-branch).
- **Account security** — 3-strike login lockout a manager clears; forced first-login
  password change; opt-in web-push (approvals, leave/swap decisions, announcements).
- **AI ops assistant (Phase 1, flag-gated off)** — read-only chat over live stock,
  expiry and waste, scoped to what the user may see. See ARCHITECTURE + ROADMAP.

## 6. Requirements that are non-negotiable
- **Security is database-enforced** (Postgres RLS + role helpers). A leaked endpoint
  must not leak another branch's data.
- **Attendance is server-stamped** via privileged DB functions; hours can't be forged
  client-side.
- **Bilingual EN/DE** everywhere user-facing.
- **Mobile-first**, works on a phone in a busy kitchen; attendance tolerates dropped
  connections.

## 7. Success criteria
Each branch operable end-to-end from the app; owners get a correct cross-branch roll-up;
no cross-branch data leakage; a reviewer logging in sees populated, realistic screens.

## 8. Open questions / decisions pending
- Agent Phase 2 (background worker + approval inbox + write/propose tools): post-pitch.
- Monorepo migration + GCP deploy: planned, not started (see ROADMAP).
- Drinks inventory figures (Ist/Soll) to be entered per branch by managers.

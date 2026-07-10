***REMOVED*** Schnitzery — Staff & Operations Portal

A production multi-branch workforce- and operations-management platform for the **Schnitzery** restaurant franchise, covering attendance, scheduling, payroll, inventory, food safety, and day-to-day operations across all branches from a single mobile-first app.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000?logo=vercel&logoColor=white)
![i18n](https://img.shields.io/badge/i18n-EN%20%2F%20DE-informational)

> Live across the franchise's branches in Stuttgart and Berlin, open 365 days a year.

---

***REMOVED******REMOVED*** Overview

Schnitzery runs as a single restaurant franchise with multiple independently-owned branches, each with its own owner and manager. This portal gives every role — from a line cook clocking in on a tablet to a brand owner reviewing payroll and food cost across all branches — exactly the view and permissions they need, on their phone.

Beyond time and attendance, the app now runs the **full inventory and operations lifecycle** — stock counting, deliveries, forecasting, purchase orders, waste, expiry/FIFO, cross-branch transfers, food-cost modelling, and HACCP temperature logging — so a branch can be operated end to end from one place.

The system is built around three principles:

- **Database-enforced security.** Permissions live in the database (Postgres Row-Level Security + role helpers), not just in the UI, so a leaked endpoint can't leak another branch's data.
- **Tamper-proof attendance.** Clock events are stamped server-side through privileged database functions, so worked hours can't be fabricated from the client.
- **Mobile-first, offline-tolerant.** The whole interface is designed for a phone in a busy kitchen, and attendance keeps working when the connection drops.

---

***REMOVED******REMOVED*** Recent updates

The latest development cycle added a full **inventory and operations layer** on top of the existing workforce platform:

- **Inventory suite** — scan-to-count (QR labels + phone camera), a stock heat-map, deliveries with cost, analytics & shrinkage variance, a depletion forecast, supplier purchase orders, and shopping-list export (copy / CSV / PDF).
- **Waste & expiry** — a quick-tap, auto-costed waste log by reason, plus expiry / FIFO batch tracking grouped per product, with discards flowing into the waste log automatically.
- **Cross-branch stock transfers** — request stock from another branch, with either-side visibility and status tracking.
- **Food safety** — temperature / HACCP logging with forced corrective actions and an immutable audit trail.
- **Cost tooling** — a monthly operations summary (with CSV export) and a food-cost what-if simulator.
- **Scheduling** — a cover-request flow with automatic roster reassignment, and a team hours-vs-contract board.
- **Correctness** — Europe/Berlin business-date handling extended across roster and analytics week-start math.

---

***REMOVED******REMOVED*** Features

***REMOVED******REMOVED******REMOVED*** Time & Attendance
- One-tap clock in / out with break tracking
- **Geofencing** and **QR-code validation** to confirm on-site clock-ins
- In-store kiosk display mode for shared tablets
- Attendance corrections workflow (request → manager approval)
- Timesheets and per-employee hours
- **Offline queue** — clock events captured offline and synced automatically on reconnect

***REMOVED******REMOVED******REMOVED*** Scheduling
- Weekly roster builder with publish flow, showing each person's availability and hours-vs-contract while assigning
- Team hours board (whole team's month-to-date hours against contract)
- **Cover requests** — staff post a shift, a colleague claims it, a manager approves, and the roster is reassigned automatically
- Automatic shift-conflict detection
- Configurable shift times (incl. cross-midnight night shifts)
- Week-over-week schedule comparison

***REMOVED******REMOVED******REMOVED*** Inventory & Stock Operations
- **Stock counting** three ways — list view, a colour **heat-map grid** (green/amber/red by stock level), or **scan-to-count** with printable **QR shelf labels** and the phone camera
- **Deliveries** logged with cost and supplier
- **Inventory analytics** — spend, usage, food-cost %, prime cost, 6-month trends, and spend by category
- **Usage-variance / shrinkage signal** — flags products whose usage jumps relative to sales
- **Depletion forecast** — derived daily usage → days-of-stock-left runway + a suggested order quantity per product
- **Purchase orders** — the forecast turned into a supplier order, grouped by supplier and priced from delivery history, with print / PDF / copy / email
- **Waste log** — quick-tap logging by reason (spoiled, dropped, overcooked, expired, other), auto-costed from delivery prices, with a weekly summary
- **Expiry / FIFO tracking** — batches with expiry dates grouped per product, oldest-first alerts, and a discard action that auto-records to the waste log
- **Cross-branch stock transfers** — request stock from another branch; the source sends or rejects, the requester confirms receipt
- **Shopping / reorder list export** — copy, CSV, or printable PDF

***REMOVED******REMOVED******REMOVED*** Food Safety & Compliance
- **Temperature / HACCP logs** — monitored fridge/freezer units with safe ranges, immutable readings, forced **corrective actions** on out-of-range readings, and daily coverage tracking
- Compliance monitoring (breaks, rest periods, long shifts)
- Incident and no-show logging
- Opening/closing checklists

***REMOVED******REMOVED******REMOVED*** People & Documents
- Staff directory and profiles
- Role and branch assignment with guarded role changes
- Document storage with **expiry tracking and alerts**

***REMOVED******REMOVED******REMOVED*** Leave
- Leave requests, approvals, and a shared leave calendar
- Per-employee leave balances

***REMOVED******REMOVED******REMOVED*** Payroll & Cost
- Monthly payroll runs and labor-cost tracking, with export for processing
- **Monthly operations summary** — sales, labour %, food-cost %, prime cost, overtime and lateness on one screen, with CSV export
- **Food-cost what-if simulator** — sliders for ingredient cost, labour, and sales/prices that move prime cost, margin, food-cost %, and labour % live

***REMOVED******REMOVED******REMOVED*** Management & Oversight
- **Super-Admin Command Center** aggregating every branch
- **Branch Analytics** engine — 9 KPIs (attendance, absence, lateness, overtime, labor hours/cost, shift compliance, utilization, productivity) with daily/weekly/monthly views and trend charts
- Global search across people, branches, and documents
- Unified action center (pending approvals, corrections, expiring docs, no-shows…)
- Live status strip (connection, sync, kiosk health)
- Audit log and notification center

---

***REMOVED******REMOVED*** Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Bundler | Turbopack |
| Backend / DB | Supabase — PostgreSQL, Row-Level Security, Auth, Storage, RPC functions |
| Charts | Recharts |
| Icons | lucide-react |
| Scanning | qrcode (label generation) + html5-qrcode (camera decode) |
| Hosting | Vercel |
| i18n | Custom lightweight EN / DE layer (1,500+ keys per locale) |

---

***REMOVED******REMOVED*** Architecture & Engineering Highlights

These are the decisions that make the system robust beyond a typical CRUD app.

***REMOVED******REMOVED******REMOVED*** Six-tier role model, enforced in the database
Roles form a clear hierarchy — `super_admin` → `brand_owner` → `branch_owner` → `manager` → `staff` → `kiosk`. Access is enforced by **Postgres Row-Level Security policies** backed by SQL helper functions (`is_manager()`, `is_owner()`, `accessible_branch_ids()`, `role_rank()`). Branch managers and branch owners see only their own branch; brand owners and super admins aggregate across branches. Because the rules live at the data layer, the application code is a convenience, not the security boundary.

***REMOVED******REMOVED******REMOVED*** Tamper-proof time tracking
Clock-in/out and break events are written exclusively through **`SECURITY DEFINER` database functions**, never by direct table writes. Timestamps are stamped by the server, geofence distance is validated in the database, and staff cannot edit their own attendance rows. Corrections go through an explicit, audited approval flow.

***REMOVED******REMOVED******REMOVED*** Timezone-correct business dates
All branches operate on **Europe/Berlin** business days. Timestamps are stored as absolute UTC instants, while the *calendar date* a shift belongs to is derived in Berlin time — so a shift starting just after midnight (or a night shift crossing midnight) is attributed to the correct business day in both the database and the UI. Week-start and roster math run through shared Berlin-anchored helpers, and open-shift lookups are status-based rather than date-based, so clocking out after midnight always finds the right session.

***REMOVED******REMOVED******REMOVED*** Derived inventory intelligence
Usage, variance, depletion forecasts, and purchase-order quantities are **derived** from the raw data the branch already captures — opening/closing counts plus costed deliveries — rather than requiring a separate stock ledger. Waste value and food-cost figures reuse the same delivery-price basis, so every operational number traces back to real inputs. Expiry discards feed the waste log automatically, keeping loss figures complete without double entry.

***REMOVED******REMOVED******REMOVED*** Cross-branch transfers without leaking scope
Stock transfers are visible to both the source and destination branch via RLS (either-side policy), with branch names denormalised onto each transfer row so neither side needs to read the other branch. The source-branch picker uses a server-side service-role lookup (names only) so a branch manager can request from any branch without widening the branches table's RLS.

***REMOVED******REMOVED******REMOVED*** Client-side document generation
Shelf labels, purchase orders, and shopping lists are generated on the client (QR sheets, print-to-PDF windows, and UTF-8 CSV exports) — no server rendering or extra services — so exports work anywhere and stay bilingual.

***REMOVED******REMOVED******REMOVED*** Offline-first attendance
A client-side queue records clock events when the device is offline and replays them to the server once connectivity returns, with a live sync indicator — essential for tablets on flaky in-store Wi-Fi.

***REMOVED******REMOVED******REMOVED*** Bilingual by design
A custom internationalization layer serves the entire UI in **English and German** (1,500+ keys per locale), with a safe insert/validate flow that keeps both locales in sync.

***REMOVED******REMOVED******REMOVED*** Mobile-first UX
Navigation is built around a bottom nav bar and task-focused hub pages rather than a desktop sidebar, with a consistent dark-red / gold visual system and a single icon component used app-wide.

---

***REMOVED******REMOVED*** Screenshots

> _Add screenshots or a short demo GIF here._

| Dashboard | Inventory (heat-map) | Analytics |
|---|---|---|
| _(image)_ | _(image)_ | _(image)_ |

---

***REMOVED******REMOVED*** Getting Started

***REMOVED******REMOVED******REMOVED*** Prerequisites
- Node.js 18+ and npm
- A Supabase project (PostgreSQL + Auth)

***REMOVED******REMOVED******REMOVED*** 1. Clone & install
```bash
git clone <your-repo-url>
cd schnitzery
npm install
```

***REMOVED******REMOVED******REMOVED*** 2. Environment variables
Create a `.env.local` file in the project root:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   ***REMOVED*** server-side only (staff creation, cross-branch lookups)
```
> The service-role key is used only in server code and must never be exposed to the client.

***REMOVED******REMOVED******REMOVED*** 3. Database setup
Apply the SQL migrations (schema, RLS policies, and RPC functions) to your Supabase project via the Supabase SQL Editor. This includes the operations tables — `inventory_purchases`, `cover_requests`, `temp_units` / `temp_logs`, `waste_log`, `stock_batches`, and `stock_transfers`. Bootstrap your first `super_admin` by setting the role on your user row.

***REMOVED******REMOVED******REMOVED*** 4. Run
```bash
npm run dev
```
The app runs at `http://localhost:3000`.

***REMOVED******REMOVED******REMOVED*** Build & type-check
```bash
npx tsc --noEmit   ***REMOVED*** type safety
npm run build      ***REMOVED*** production build
```

---

***REMOVED******REMOVED*** Project Structure

```
src/
├── app/
│   └── (app)/            ***REMOVED*** authenticated routes (dashboard, attendance, schedule, payroll,
│       │                 ***REMOVED***   inventory, temp, waste, expiry, transfers, summary, simulator …)
│       ├── layout.tsx    ***REMOVED*** shell: header, bottom navigation
│       └── api/          ***REMOVED*** server route handlers (e.g. staff creation)
├── components/           ***REMOVED*** shared UI (Icon, NotificationBell, navigation, …)
└── lib/
    ├── queries/          ***REMOVED*** data layer — server actions & queries per domain
    ├── supabase/         ***REMOVED*** Supabase server/client setup
    ├── time/             ***REMOVED*** Europe/Berlin business-date helpers
    ├── offline/          ***REMOVED*** offline attendance queue
    └── i18n/             ***REMOVED*** EN / DE message catalog
```

---

***REMOVED******REMOVED*** Security Notes

- Authorization is enforced by Postgres RLS; the app layer mirrors it for clean UX but is not the boundary.
- Attendance writes are restricted to `SECURITY DEFINER` functions; the client cannot write attendance rows directly.
- Cross-branch access is scoped per role; non-owners are limited to their assigned branch. Cross-branch transfers are visible only to the two branches involved.
- The Supabase service-role key is confined to server-side code (staff creation and branch-name lookups for transfers).

---

***REMOVED******REMOVED*** Internationalization

The UI ships in **English** and **German**, switchable at runtime, covering every screen and message (1,500+ keys per locale). Translations are stored in a single typed catalog kept in sync across both locales.

---

***REMOVED******REMOVED*** Deployment

Deployed on **Vercel** with continuous deployment from the main branch. Database, auth, and storage are hosted on **Supabase**. The app is a mobile-first PWA (installable via Add to Home Screen).

---

***REMOVED******REMOVED*** Author

**Venkata Nagendra Reddy Suda**
Built and maintained solo — full-stack architecture, database design, and UI.

***REMOVED******REMOVED*** License

> _Choose a license (or mark as proprietary). This is a private business application; if the repository is public, consider adding a `LICENSE` file or a proprietary notice._

# Schnitzery — Staff & Operations Portal

A production multi-branch workforce-management platform for the **Schnitzery** restaurant franchise, covering attendance, scheduling, payroll, and day-to-day operations across all branches from a single mobile-first app.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000?logo=vercel&logoColor=white)
![i18n](https://img.shields.io/badge/i18n-EN%20%2F%20DE-informational)

> Live across the franchise's branches in Stuttgart and Berlin, open 365 days a year.

---

## Overview

Schnitzery runs as a single restaurant franchise with multiple independently-owned branches, each with its own owner and manager. This portal gives every role — from a line cook clocking in on a tablet to a brand owner reviewing payroll across all branches — exactly the view and permissions they need, on their phone.

The system is built around three principles:

- **Database-enforced security.** Permissions live in the database (Postgres Row-Level Security + role helpers), not just in the UI, so a leaked endpoint can't leak another branch's data.
- **Tamper-proof attendance.** Clock events are stamped server-side through privileged database functions, so worked hours can't be fabricated from the client.
- **Mobile-first, offline-tolerant.** The whole interface is designed for a phone in a busy kitchen, and attendance keeps working when the connection drops.

---

## Features

### Time & Attendance
- One-tap clock in / out with break tracking
- **Geofencing** and **QR-code validation** to confirm on-site clock-ins
- In-store kiosk display mode for shared tablets
- Attendance corrections workflow (request → manager approval)
- Timesheets and per-employee hours
- **Offline queue** — clock events captured offline and synced automatically on reconnect

### Scheduling
- Weekly roster builder with publish flow
- Shift-swap requests and approvals
- Automatic shift-conflict detection
- Configurable shift times (incl. cross-midnight night shifts)
- Week-over-week schedule comparison

### People & Documents
- Staff directory and profiles
- Role and branch assignment with guarded role changes
- Document storage with **expiry tracking and alerts**

### Leave
- Leave requests, approvals, and a shared leave calendar
- Per-employee leave balances

### Payroll
- Monthly payroll runs and labor-cost tracking
- Payroll export for processing

### Operations
- Live operations dashboard (who's working, late, absent, not checked in)
- Opening/closing checklists
- Inventory counts
- Incident and no-show logging
- Compliance monitoring (breaks, rest periods, long shifts)

### Management & Oversight
- **Super-Admin Command Center** aggregating every branch
- **Branch Analytics** engine — 9 KPIs (attendance, absence, lateness, overtime, labor hours/cost, shift compliance, utilization, productivity) with daily/weekly/monthly views and trend charts
- Global search across people, branches, and documents
- Unified action center (pending approvals, corrections, expiring docs, no-shows…)
- Live status strip (connection, sync, kiosk health)
- Audit log and notification center

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Bundler | Turbopack |
| Backend / DB | Supabase — PostgreSQL, Row-Level Security, Auth, Storage, RPC functions |
| Charts | Recharts |
| Icons | lucide-react |
| Hosting | Vercel |
| i18n | Custom lightweight EN / DE layer |

---

## Architecture & Engineering Highlights

These are the decisions that make the system robust beyond a typical CRUD app.

### Six-tier role model, enforced in the database
Roles form a clear hierarchy — `super_admin` → `brand_owner` → `branch_owner` → `manager` → `staff` → `kiosk`. Access is enforced by **Postgres Row-Level Security policies** backed by SQL helper functions (`is_manager()`, `is_owner()`, `accessible_branch_ids()`, `role_rank()`). Branch managers see only their own branch; owners aggregate across branches. Because the rules live at the data layer, the application code is a convenience, not the security boundary.

### Tamper-proof time tracking
Clock-in/out and break events are written exclusively through **`SECURITY DEFINER` database functions**, never by direct table writes. Timestamps are stamped by the server, geofence distance is validated in the database, and staff cannot edit their own attendance rows. Corrections go through an explicit, audited approval flow.

### Timezone-correct business dates
All branches operate on **Europe/Berlin** business days. Timestamps are stored as absolute UTC instants, while the *calendar date* a shift belongs to is derived in Berlin time — so a shift starting just after midnight (or a night shift crossing midnight) is attributed to the correct business day in both the database and the UI. Open-shift lookups are status-based rather than date-based, so clocking out after midnight always finds the right session.

### Offline-first attendance
A client-side queue records clock events when the device is offline and replays them to the server once connectivity returns, with a live sync indicator — essential for tablets on flaky in-store Wi-Fi.

### Bilingual by design
A custom internationalization layer serves the entire UI in **English and German** (1,000+ keys), with a safe insert/validate flow that keeps both locales in sync.

### Mobile-first UX
Navigation is built around a bottom nav bar and task-focused hub pages rather than a desktop sidebar, with a consistent dark-red / gold visual system and a single icon component used app-wide.

---

## Screenshots

> _Add screenshots or a short demo GIF here._

| Dashboard | Attendance | Analytics |
|---|---|---|
| _(image)_ | _(image)_ | _(image)_ |

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase project (PostgreSQL + Auth)

### 1. Clone & install
```bash
git clone <your-repo-url>
cd schnitzery
npm install
```

### 2. Environment variables
Create a `.env.local` file in the project root:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-side only (e.g. staff creation)
```
> The service-role key is used only in server code and must never be exposed to the client.

### 3. Database setup
Apply the SQL migrations (schema, RLS policies, and RPC functions) to your Supabase project via the Supabase SQL Editor. Bootstrap your first `super_admin` by setting the role on your user row.

### 4. Run
```bash
npm run dev
```
The app runs at `http://localhost:3000`.

### Build & type-check
```bash
npx tsc --noEmit   # type safety
npm run build      # production build
```

---

## Project Structure

```
src/
├── app/
│   └── (app)/            # authenticated routes (dashboard, attendance, schedule, payroll, …)
│       ├── layout.tsx    # shell: header, bottom navigation
│       └── api/          # server route handlers (e.g. staff creation)
├── components/           # shared UI (Icon, NotificationBell, navigation, …)
└── lib/
    ├── queries/          # data layer — server actions & queries per domain
    ├── supabase/         # Supabase server/client setup
    ├── time/             # Europe/Berlin business-date helpers
    ├── offline/          # offline attendance queue
    └── i18n/             # EN / DE message catalog
```

---

## Security Notes

- Authorization is enforced by Postgres RLS; the app layer mirrors it for clean UX but is not the boundary.
- Attendance writes are restricted to `SECURITY DEFINER` functions; the client cannot write attendance rows directly.
- Cross-branch access is scoped per role; non-owners are limited to their assigned branch.
- The Supabase service-role key is confined to server-side code.

---

## Internationalization

The UI ships in **English** and **German**, switchable at runtime, covering every screen and message. Translations are stored in a single typed catalog kept in sync across both locales.

---

## Deployment

Deployed on **Vercel** with continuous deployment from the main branch. Database, auth, and storage are hosted on **Supabase**.

---

## Author

**Venkata Nagendra Reddy Suda**
Built and maintained solo — full-stack architecture, database design, and UI.

## License

> _Choose a license (or mark as proprietary). This is a private business application; if the repository is public, consider adding a `LICENSE` file or a proprietary notice._

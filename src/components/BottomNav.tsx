"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";

// Hub-based bottom navigation — mirrors the old app's clean structure.
//  staff   → Home · My Day · Shifts · Profile
//  manager → Home · Schedule · Attendance · Inventory · Profile
//  owner   → Home · Branches · Schedule · Inventory · Profile
//
// The hub routes group many features behind one tidy button:
//   /my-day         → Availability · Time Off · Hours      (staff)
//   /schedule-hub   → Roster · Requests · Export           (manager/owner)
//   /attendance-hub → Live · No-Shows · Display            (manager)
export default function BottomNav({ role }: { role: string }) {
  const path = usePathname();
  const { t } = useLang();
  const isOwner = ["brand_owner", "super_admin"].includes(role); // HQ only: cross-branch nav with Branches tab
  const isManager = ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role);

  const staffItems = [
    { href: "/", label: t("nav.home"), icon: <HomeIcon /> },
    { href: "/my-day", label: t("nav.myDay"), icon: <CalIcon /> },
    { href: "/schedule", label: t("nav.shifts"), icon: <ClockIcon /> },
    { href: "/profile", label: t("nav.profile"), icon: <UserIcon /> },
  ];
  const managerItems = [
    { href: "/", label: t("nav.home"), icon: <GridIcon /> },
    { href: "/schedule-hub", label: t("nav.schedule"), icon: <CalIcon /> },
    { href: "/attendance-hub", label: t("nav.attendance"), icon: <ClockIcon /> },
    { href: "/inventory", label: t("nav.inventory"), icon: <BoxIcon /> },
    { href: "/profile", label: t("nav.profile"), icon: <UserIcon /> },
  ];
  const ownerItems = [
    { href: "/", label: t("nav.home"), icon: <GridIcon /> },
    { href: "/branches", label: t("nav.branches"), icon: <BuildingIcon /> },
    { href: "/schedule-hub", label: t("nav.schedule"), icon: <CalIcon /> },
    { href: "/inventory", label: t("nav.inventory"), icon: <BoxIcon /> },
    { href: "/profile", label: t("nav.profile"), icon: <UserIcon /> },
  ];

  const items = isOwner ? ownerItems : isManager ? managerItems : staffItems;

  return (
    <nav className="bottom-nav">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={`nav-btn${active ? " active" : ""}`}>
            {it.icon}
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function HomeIcon() { return <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>; }
function CalIcon() { return <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>; }
function GridIcon() { return <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>; }
function BoxIcon() { return <svg viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>; }
function BuildingIcon() { return <svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="6" x2="9" y2="6" /><line x1="15" y1="6" x2="15" y2="6" /><line x1="9" y1="10" x2="9" y2="10" /><line x1="15" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="15" y2="14" /></svg>; }
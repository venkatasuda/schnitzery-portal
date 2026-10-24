"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Clock, Users, Package, ChartNoAxesCombined, Settings, Building2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { useLang } from "@/components/LanguageProvider";

function navigationGroups(owner: boolean) {
  return [
    { label: "workspace.operations", items: [
      { href: "/", label: "workspace.dashboard", icon: LayoutDashboard, routes: ["/", "/my-branches", "/targets"] },
      ...(owner ? [{ href: "/branches", label: "nav.branches", icon: Building2, routes: ["/branches", "/overview"] }] : []),
      { href: "/inventory", label: "nav.inventory", icon: Package, routes: ["/inventory", "/stock-alerts", "/waste", "/expiry", "/transfers", "/labels"] },
      { href: "/ops", label: "home.dailyOps", icon: ClipboardCheck, routes: ["/ops", "/temp", "/checklist-status", "/checklist", "/incidents", "/announcements"] },
    ] },
    { label: "workspace.workforce", items: [
      { href: "/schedule-hub", label: "nav.schedule", icon: CalendarDays, routes: ["/schedule-hub", "/schedule", "/roster", "/availability", "/leave", "/leave-calendar", "/cover", "/conflicts"] },
      { href: "/attendance-hub", label: "nav.attendance", icon: Clock, routes: ["/attendance-hub", "/attendance", "/noshow", "/clock-display", "/my-day", "/hours", "/timesheet"] },
      { href: "/staff", label: "home.peopleTeam", icon: Users, routes: ["/people-hub", "/staff", "/directory", "/notes", "/expiring-docs"] },
      { href: "/approvals", label: "home.approvals", icon: ClipboardCheck, routes: ["/approvals"] },
    ] },
    { label: "workspace.business", items: [
      { href: "/analytics", label: "workspace.reports", icon: ChartNoAxesCombined, routes: ["/analytics", "/labor", "/summary", "/export", "/waste-branches", "/simulator"] },
      { href: "/compliance", label: "home.compliance", icon: ShieldCheck, routes: ["/compliance", "/audit"] },
      { href: "/profile", label: "home.settings", icon: Settings, routes: ["/profile", "/settings", "/settings-hub", "/geofence", "/kiosks", "/notifications"] },
    ] },
  ];
}

export default function ManagementNav({ role }: { role: string }) {
  const path = usePathname();
  const { t } = useLang();
  const owner = ["brand_owner", "super_admin"].includes(role);
  const groups = navigationGroups(owner);
  const navigation = <nav aria-label={t("workspace.navigation")}>
    {groups.map((group) => <div className="management-nav-group" key={group.label}>
      <div className="management-nav-label">{t(group.label)}</div>
      {group.items.map((item) => {
        const active = item.routes.some((route) => route === "/" ? path === "/" : path === route || path.startsWith(route + "/"));
        return <Link key={item.href} href={item.href} className={`management-nav-link${active ? " active" : ""}`} aria-current={active && path === item.href ? "page" : undefined}>
          <item.icon size={18} aria-hidden="true" /><span>{t(item.label)}</span>
        </Link>;
      })}
    </div>)}
  </nav>;
  return <>
    <aside className="management-sidebar">
      <Link href="/" className="management-brand">Schnitzery<span>{t("workspace.management")}</span></Link>
      {navigation}
    </aside>
    <details className="management-mobile-nav" key={path}>
      <summary>{t("workspace.navigation")}</summary>
      {navigation}
    </details>
  </>;
}

export function ManagementLocation({ role }: { role: string }) {
  const path = usePathname();
  const { t } = useLang();
  const groups = navigationGroups(["brand_owner", "super_admin"].includes(role));
  const group = groups.find(g => g.items.some(item => item.routes.some(route => route === "/" ? path === "/" : path === route || path.startsWith(route + "/"))));
  const item = group?.items.find(item => item.routes.some(route => route === "/" ? path === "/" : path === route || path.startsWith(route + "/")));
  if (!group || !item) return <div className="workspace-location">Schnitzery</div>;
  return <div className="workspace-location"><span>{t(group.label)}</span><span aria-hidden="true">/</span>{path === item.href ? <strong>{t(item.label)}</strong> : <Link href={item.href}>{t(item.label)} ↗</Link>}</div>;
}

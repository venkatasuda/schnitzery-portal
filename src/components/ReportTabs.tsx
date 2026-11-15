"use client";
// Related report pages shown as one place with tabs (fewer menu entries, same pages underneath):
//   Problems    = roster conflicts + no-shows
//   Performance = business analytics + month summary
//   Labour      = labour cost + planned vs worked hours
//   Team        = staff + directory + notes (managers; the directory alone stays open to everyone)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";

type Group = "problems" | "performance" | "labour" | "team" | "leave" | "compliance" | "settings";
const TABS: Record<Group, { href: string; en: string; de: string }[]> = {
  problems: [{ href: "/conflicts", en: "Roster conflicts", de: "Dienstplan-Konflikte" }, { href: "/noshow", en: "No-shows", de: "Nicht erschienen" }],
  performance: [{ href: "/analytics", en: "Business", de: "Geschäft" }, { href: "/summary", en: "Month summary", de: "Monatsübersicht" }],
  team: [{ href: "/staff", en: "Staff", de: "Mitarbeitende" }, { href: "/directory", en: "Directory", de: "Verzeichnis" }, { href: "/notes", en: "Notes & recognition", de: "Notizen & Anerkennung" }],
  leave: [{ href: "/leave", en: "Requests", de: "Anträge" }, { href: "/leave-calendar", en: "Calendar", de: "Kalender" }],
  compliance: [{ href: "/compliance", en: "Overview", de: "Übersicht" }, { href: "/compliance/logbook", en: "HACCP logbook", de: "HACCP-Logbuch" }, { href: "/expiring-docs", en: "Documents", de: "Dokumente" }, { href: "/audit", en: "Audit log", de: "Protokoll" }],
  settings: [{ href: "/settings", en: "Branch", de: "Filiale" }, { href: "/geofence", en: "Location check", de: "Standortprüfung" }, { href: "/kiosks", en: "Kiosks", de: "Kiosks" }, { href: "/settings/integrations", en: "Integrations", de: "Integrationen" }],
  labour: [{ href: "/labor", en: "Labour cost", de: "Personalkosten" }, { href: "/schedule/compare", en: "Planned vs worked", de: "Geplant vs. gearbeitet" }],
};

export default function ReportTabs({ group }: { group: Group }) {
  const path = usePathname();
  const { locale } = useLang();
  // Only on the pages of this group (e.g. not when /leave is embedded in My Day).
  if (!TABS[group].some((tab) => tab.href === path)) return null;
  return (
    <nav className="report-tabs" aria-label={locale === "de" ? "Bereich" : "Section"}>
      {TABS[group].map((tab) => (
        <Link key={tab.href} href={tab.href} prefetch={false} aria-current={path === tab.href ? "page" : undefined}>{locale === "de" ? tab.de : tab.en}</Link>
      ))}
    </nav>
  );
}

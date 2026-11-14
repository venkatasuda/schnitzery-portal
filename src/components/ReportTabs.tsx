"use client";
// Related report pages shown as one place with tabs (fewer menu entries, same pages underneath):
//   Problems    = roster conflicts + no-shows
//   Performance = business analytics + month summary
//   Labour      = labour cost + planned vs worked hours
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";

type Group = "problems" | "performance" | "labour";
const TABS: Record<Group, { href: string; en: string; de: string }[]> = {
  problems: [{ href: "/conflicts", en: "Roster conflicts", de: "Dienstplan-Konflikte" }, { href: "/noshow", en: "No-shows", de: "Nicht erschienen" }],
  performance: [{ href: "/analytics", en: "Business", de: "Geschäft" }, { href: "/summary", en: "Month summary", de: "Monatsübersicht" }],
  labour: [{ href: "/labor", en: "Labour cost", de: "Personalkosten" }, { href: "/schedule/compare", en: "Planned vs worked", de: "Geplant vs. gearbeitet" }],
};

export default function ReportTabs({ group }: { group: Group }) {
  const path = usePathname();
  const { locale } = useLang();
  return (
    <nav className="report-tabs" aria-label={locale === "de" ? "Bereich" : "Section"}>
      {TABS[group].map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={path === tab.href ? "page" : undefined}>{locale === "de" ? tab.de : tab.en}</Link>
      ))}
    </nav>
  );
}

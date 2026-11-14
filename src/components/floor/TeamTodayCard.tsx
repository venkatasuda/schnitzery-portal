"use client";
// Home → first card for shift leaders: today's team at a glance; tap for the full list (/team-today).
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getTeamToday } from "@/lib/queries/team-today";

type Counts = { in: number; break: number; late: number; not_in: number; done: number };

export default function TeamTodayCard() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => getTeamToday().then((r) => { if (live && r.ok) setCounts(r.counts); }).catch(() => undefined);
    void load();
    const timer = setInterval(load, 60_000); // a floor view should not go stale during service
    return () => { live = false; clearInterval(timer); };
  }, []);
  if (!counts) return null;
  const items: [keyof Counts, string, string][] = [
    ["in", s("In", "Da"), ""], ["break", s("Break", "Pause"), ""],
    ["late", s("Late", "Zu spät"), "is-alert"], ["not_in", s("Not in yet", "Noch nicht da"), ""],
  ];
  return (
    <Link href="/team-today" className="card team-today-card" aria-label={s("Today's team: open the list", "Team heute: Liste öffnen")}>
      <span className="team-today-title">{s("Today's team", "Team heute")}<span aria-hidden="true">›</span></span>
      <span className="team-today-stats">
        {items.map(([k, label, tone]) => (
          <span key={k} className={`team-today-stat${counts[k] > 0 ? ` ${tone}` : ""}`}><strong>{counts[k]}</strong>{label}</span>
        ))}
      </span>
    </Link>
  );
}

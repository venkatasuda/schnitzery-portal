"use client";
// Today's team (shift leaders and managers): everyone planned or clocked in today, problems first.
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, EmptyState, ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { appLocale } from "@/lib/format";
import { getTeamToday } from "@/lib/queries/team-today";
import type { FloorPerson, FloorState } from "@/lib/roster/floor";

export default function TeamTodayPage() {
  const { t, locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [data, setData] = useState<{ people: FloorPerson[] } | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "failed">("loading");
  async function load() {
    try {
      const r = await getTeamToday();
      if (r.ok) { setData(r); setState("ok"); } else setState(r.error === "access" ? "denied" : "failed");
    } catch { setState("failed"); }
  }
  useEffect(() => { void load(); const timer = setInterval(load, 60_000); return () => clearInterval(timer); }, []);

  const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(appLocale(), { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) : "");
  const teamLabel = (k: string | null) => (k ? t("teams." + k) : "");
  const shiftLabel = (k: string | null) => (k && ["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k || "");
  const label: Record<FloorState, (p: FloorPerson) => string> = {
    late: (p) => s(`Late · ${p.lateBy} min`, `Zu spät · ${p.lateBy} Min.`),
    in: (p) => s(`In since ${clock(p.clock_in)}`, `Da seit ${clock(p.clock_in)}`) + (p.late_mins > 0 ? s(` · ${p.late_mins} min late`, ` · ${p.late_mins} Min. zu spät`) : ""),
    break: () => s("On break", "In Pause"),
    not_in: (p) => (p.start ? s(`Starts ${p.start}`, `Beginnt ${p.start}`) : s("Not in yet", "Noch nicht da")),
    done: () => s("Finished", "Fertig"),
  };

  return (
    <div className="fade-up team-today-page">
      <PageHeader title={s("Today's team", "Team heute")} />
      {state === "loading" ? <CardSkeleton rows={4} />
        : state === "denied" ? <EmptyState title={s("For shift leaders", "Für Schichtleitungen")}>{s("Ask your manager to mark you as shift leader.", "Bitte die Leitung, dich als Schichtleitung freizuschalten.")}</EmptyState>
        : state === "failed" || !data ? <ErrorState message={t("common.loadFailed")} onRetry={() => void load()} retryLabel={t("business.retry")} />
        : data.people.length === 0 ? <EmptyState title={s("Nobody planned today", "Heute niemand eingeplant")} />
        : <ul className="team-today-list">
            {data.people.map((p) => (
              <li key={p.user_id} className={`card team-today-row is-${p.state}`}>
                <span className="team-today-dot" aria-hidden="true" />
                <span className="team-today-who"><strong>{p.name}</strong><span>{[teamLabel(p.team), shiftLabel(p.shift), p.start && p.end ? `${p.start}–${p.end}` : ""].filter(Boolean).join(" · ")}</span></span>
                <span className="team-today-state">{label[p.state](p)}</span>
              </li>
            ))}
          </ul>}
    </div>
  );
}

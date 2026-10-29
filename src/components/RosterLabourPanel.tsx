"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getRosterPlanning } from "@/lib/queries/owner-insights";
import { forecastWeek, rosterEntryMinutes, type ShiftTimeDef, type PlannedShift } from "@/lib/owner/insights";
import { formatEur, formatPct } from "@/lib/format";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type Entry = { user_id: string; team: string; shift: string };
type Planning = Extract<Awaited<ReturnType<typeof getRosterPlanning>>, { ok: true }>;

const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Live labour cost while the roster is being built (docs/OWNER-COCKPIT.md): expected sales
// (same weekday, last 4 weeks), planned hours and cost at current wages, and the expected
// labour % against the owner's target. Recomputed in the browser on every change.
export default function RosterLabourPanel({ weekStart, roster }: { weekStart: string; roster: Record<string, Entry[]> }) {
  const { t, locale } = useLang();
  const [plan, setPlan] = useState<Planning | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!weekStart) return;
    let live = true;
    setPlan(null); setFailed(false);
    getRosterPlanning(weekStart)
      .then((r) => { if (live) { if (r.ok) setPlan(r); else setFailed(true); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [weekStart]);

  const result = useMemo(() => {
    if (!plan || !weekStart) return null;
    const times = new Map<string, ShiftTimeDef>(plan.times.map((s) => [`${s.team}|${s.shift}`, s]));
    const dates = DAYS.map((_, i) => addDays(weekStart, i));
    const planned: PlannedShift[] = [];
    let unknown = 0;
    DAYS.forEach((d, i) => {
      for (const e of roster[d] || []) {
        const mins = rosterEntryMinutes(e, times);
        if (mins == null) unknown++; else planned.push({ date: dates[i], user_id: e.user_id, mins });
      }
    });
    return { ...forecastWeek(dates, plan.history, planned, plan.wagesKnown ? plan.wages : {}), unknown };
  }, [plan, roster, weekStart]);

  if (failed) return null; // planning aid only; the roster itself still works
  if (!result || !plan) return <div className="card u-mb-3 roster-labour" aria-busy="true"><div className="card-title">{t("rosterLabour.title")}</div><p className="ui-sub">{t("common.loading")}</p></div>;

  const target = plan.labourTarget;
  const tone = result.labourPct == null || target == null ? "" : result.labourPct <= target ? " good" : result.labourPct <= target + 3 ? " warn" : " bad";
  const notes = [
    result.missingWages ? t("business.missingWages", { n: result.missingWages }) : "",
    result.unknown ? t("insights.unknownShifts", { n: result.unknown }) : "",
    result.hours > 0 && result.sales == null ? t("rosterLabour.noHistory") : "",
  ].filter(Boolean);

  return (
    <div className="card u-mb-3 roster-labour" aria-live="polite">
      <div className="card-title">{t("rosterLabour.title")}</div>
      <div className="dashboard-facts">
        <div><span>{t("insights.expectedSales")}</span><strong>{formatEur(result.sales, locale, 0)}</strong></div>
        <div><span>{t("insights.plannedHours")}</span><strong>{result.hours.toLocaleString(locale === "de" ? "de-DE" : "en-GB")} h</strong></div>
        <div><span>{t("insights.plannedCost")}</span><strong>{formatEur(result.cost, locale, 0)}</strong></div>
        <div><span>{t("insights.projectedLabour")}</span><strong className={`ins-pct${tone}`}>{formatPct(result.labourPct, locale)}</strong></div>
      </div>
      <p className="ui-sub">{target != null ? t("cockpit.target", { n: target }) : t("cockpit.noTarget")}{notes.length ? ` · ${notes.join(" · ")}` : ""}</p>
    </div>
  );
}

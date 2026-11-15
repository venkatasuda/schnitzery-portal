import Link from "next/link";
import { formatEur, formatPct } from "@/lib/format";
import { healthTone, type HealthPart, type WeekRow, type WeekForecast } from "@/lib/owner/insights";

type Tf = (k: string, v?: Record<string, string | number>) => string;
export type Insights = {
  trend: WeekRow[];
  forecast: WeekForecast & { weekStart: string; hasRoster: boolean; unknownShifts: number };
  health: { score: number | null; parts: HealthPart[] } | null;
};

const HEALTH_HREF: Record<HealthPart["key"], string> = { temps: "/temp", checklists: "/checklist-status", sales: "/labor", approvals: "/approvals" };

// Tiny bar series; null weeks are a gap, partial weeks are drawn faded.
export function Spark({ values, faded, label }: { values: (number | null)[]; faded?: boolean[]; label: string }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const W = Math.max(1, values.length) * 14;
  return (
    <svg className="spark" viewBox={`0 0 ${W} 32`} role="img" aria-label={label} preserveAspectRatio="none">
      {values.map((v, i) => v == null ? null : (
        <rect key={i} x={i * 14 + 2} width={10} y={32 - Math.max(2, (v / max) * 30)} height={Math.max(2, (v / max) * 30)} rx={2} opacity={faded?.[i] ? 0.35 : 1} />
      ))}
    </svg>
  );
}

// Branch dashboard pieces (src/app/(app)/page.tsx): next week's forecast and the routine-work health.
// The last-8-weeks trend lives in PerformanceBand, next to the figures it explains.
const dayFmt = (d: string, locale: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Berlin" });
const labourTone = (pct: number | null, target: number | null) => pct == null || target == null ? "" : pct <= target ? " good" : pct <= target + 3 ? " warn" : " bad";

export function ForecastPanel({ data, labourTarget, t, locale }: { data: Insights; labourTarget: number | null; t: Tf; locale: string }) {
  const f = data.forecast;
  const money = (v: number | null) => formatEur(v, locale, 0);
  const tone = (pct: number | null) => labourTone(pct, labourTarget);
  const day = (d: string) => dayFmt(d, locale);
  return (
      <section className="dashboard-panel ins-forecast" aria-labelledby="ins-fc">
        <div className="dashboard-panel-heading"><h2 id="ins-fc">{t("insights.nextWeek")} <span className="ins-sub">· {t("insights.weekOf", { d: day(f.weekStart) })}</span></h2><Link href="/schedule-hub">{t("insights.roster")} ›</Link></div>
        {!f.hasRoster ? (
          <div className="dashboard-empty"><p>{t("insights.noRoster")}</p></div>
        ) : (<>
          <div className="ins-kpis">
            <div><span>{t("insights.expectedSales")}</span><strong>{money(f.sales)}</strong></div>
            <div><span>{t("insights.plannedHours")}</span><strong>{f.hours} h</strong></div>
            <div><span>{t("insights.plannedCost")}</span><strong>{money(f.cost)}</strong></div>
            <div><span>{t("insights.projectedLabour")}</span><strong className={`ins-pct${tone(f.labourPct)}`}>{formatPct(f.labourPct, locale)}</strong></div>
          </div>
          <div className="table-scroll" tabIndex={0} role="region" aria-label={t("insights.nextWeek")}>
            <table className="data-table ins-week">
              <thead><tr><th scope="col"><span className="sr-only">{t("insights.day")}</span></th>{f.days.map((d) => (
                <th scope="col" className="numeric" key={d.date} title={d.holiday ? t("insights.holiday") : undefined}>{day(d.date)}{d.holiday && <span className="ins-holiday" aria-label={t("insights.holiday")}>●</span>}</th>))}</tr></thead>
              <tbody>
                <tr><th scope="row">{t("insights.expectedSales")}</th>{f.days.map((d) => <td className="numeric" key={d.date}>{money(d.forecast)}</td>)}</tr>
                <tr><th scope="row">{t("insights.plannedHours")}</th>{f.days.map((d) => <td className="numeric" key={d.date}>{d.hours}</td>)}</tr>
                <tr><th scope="row">{t("insights.labourShort")}</th>{f.days.map((d) => {
                  const pct = d.cost != null && d.forecast ? Math.round((d.cost / d.forecast) * 1000) / 10 : null;
                  return <td className={`numeric ins-pct${tone(pct)}`} key={d.date}>{formatPct(pct, locale)}</td>;
                })}</tr>
              </tbody>
            </table>
          </div>
          <p className="dashboard-muted ins-foot">{[f.missingWages ? t("business.missingWages", { n: f.missingWages }) : "", f.unknownShifts ? t("insights.unknownShifts", { n: f.unknownShifts }) : "", t("insights.forecastNote")].filter(Boolean).join(" · ")}</p>
        </>)}
      </section>
  );
}

export function HealthPanel({ data, t, locale }: { data: Insights; t: Tf; locale: string }) {
  const h = data.health;
  return h ? <div className="ins-health">{h.parts.map((p) => (
    <Link key={p.key} href={HEALTH_HREF[p.key]} className="ins-part">
      <span>{t(`insights.h_${p.key}`)}</span>
      <span className="ins-bar" aria-hidden><i className={healthTone(p.score)} style={{ width: `${p.score ?? 0}%` }} /></span>
      <strong>{formatPct(p.score, locale)}</strong>
    </Link>
  ))}</div> : <p className="dashboard-muted">{t("homeDashboard.unavailable")}</p>;
}

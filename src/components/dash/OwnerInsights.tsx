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
function Spark({ values, faded, label }: { values: (number | null)[]; faded?: boolean[]; label: string }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const W = 8 * 14;
  return (
    <svg className="spark" viewBox={`0 0 ${W} 32`} role="img" aria-label={label} preserveAspectRatio="none">
      {values.map((v, i) => v == null ? null : (
        <rect key={i} x={i * 14 + 2} width={10} y={32 - Math.max(2, (v / max) * 30)} height={Math.max(2, (v / max) * 30)} rx={2} opacity={faded?.[i] ? 0.35 : 1} />
      ))}
    </svg>
  );
}

// Owner home, second band: what's coming (forecast), where it's heading (trend), and
// whether the routine work gets done (health). Cards inform; each links to where to act.
export default function OwnerInsights({ data, labourTarget, t, locale }: { data: Insights; labourTarget: number | null; t: Tf; locale: string }) {
  const { trend, forecast: f, health: h } = data;
  const money = (v: number | null) => formatEur(v, locale, 0);
  const tone = (pct: number | null) => pct == null || labourTarget == null ? "" : pct <= labourTarget ? " good" : pct <= labourTarget + 3 ? " warn" : " bad";
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Berlin" });
  const last = trend[trend.length - 1];
  const prev4 = trend.slice(-5, -1).map((w) => w.splh).filter((x): x is number => x != null);
  const splhAvg = prev4.length ? Math.round(prev4.reduce((a, b) => a + b, 0) / prev4.length) : null;

  return (
    <div className="insights-grid">
      <section className="dashboard-panel" aria-labelledby="ins-fc">
        <div className="dashboard-panel-heading"><h2 id="ins-fc">{t("insights.nextWeek")}</h2><Link href="/schedule-hub">{t("insights.roster")} ›</Link></div>
        <p className="dashboard-muted">{t("insights.weekOf", { d: day(f.weekStart) })}</p>
        {!f.hasRoster ? (
          <div className="dashboard-empty"><p>{t("insights.noRoster")}</p></div>
        ) : (<>
          <div className="dashboard-facts">
            <div><span>{t("insights.expectedSales")}</span><strong>{money(f.sales)}</strong></div>
            <div><span>{t("insights.plannedHours")}</span><strong>{f.hours} h</strong></div>
            <div><span>{t("insights.plannedCost")}</span><strong>{money(f.cost)}</strong></div>
            <div><span>{t("insights.projectedLabour")}</span><strong className={`ins-pct${tone(f.labourPct)}`}>{formatPct(f.labourPct, locale)}</strong></div>
          </div>
          <div className="table-scroll" tabIndex={0} role="region" aria-label={t("insights.nextWeek")}>
            <table className="data-table"><thead><tr><th scope="col">{t("insights.day")}</th><th scope="col" className="numeric">{t("insights.expectedSales")}</th><th scope="col" className="numeric">{t("insights.plannedHours")}</th><th scope="col" className="numeric">{t("insights.labourShort")}</th></tr></thead>
              <tbody>{f.days.map((d) => {
                const pct = d.cost != null && d.forecast ? Math.round((d.cost / d.forecast) * 1000) / 10 : null;
                return <tr key={d.date}><td>{day(d.date)}</td><td className="numeric">{money(d.forecast)}</td><td className="numeric">{d.hours}</td><td className={`numeric ins-pct${tone(pct)}`}>{formatPct(pct, locale)}</td></tr>;
              })}</tbody></table>
          </div>
          <p className="dashboard-muted">{[f.missingWages ? t("business.missingWages", { n: f.missingWages }) : "", f.unknownShifts ? t("insights.unknownShifts", { n: f.unknownShifts }) : "", t("insights.forecastNote")].filter(Boolean).join(" · ")}</p>
        </>)}
      </section>

      <section className="dashboard-panel" aria-labelledby="ins-tr">
        <div className="dashboard-panel-heading"><h2 id="ins-tr">{t("insights.trend")}</h2><Link href="/analytics">{t("homeDashboard.details")} ›</Link></div>
        <div className="ins-trend">
          <div><span>{t("cockpit.sales")}</span><strong>{last?.sales == null ? "—" : `${last.salesComplete ? "" : "≥ "}${money(last.sales)}`}</strong><Spark values={trend.map((w) => w.sales)} faded={trend.map((w) => !w.salesComplete)} label={t("cockpit.sales")} /></div>
          <div><span>{t("cockpit.labour")}</span><strong className={`ins-pct${tone(last?.labourPct ?? null)}`}>{formatPct(last?.labourPct, locale)}</strong><Spark values={trend.map((w) => w.labourPct)} label={t("cockpit.labour")} /></div>
          <div><span>{t("insights.splh")}</span><strong>{last?.splh == null ? "—" : money(last.splh)}</strong><Spark values={trend.map((w) => w.splh)} label={t("insights.splh")} /></div>
        </div>
        <p className="dashboard-muted">{splhAvg != null && last?.splh != null ? t("insights.splhVsAvg", { avg: money(splhAvg) }) : t("insights.trendNote")}</p>
      </section>

      <section className="dashboard-panel" aria-labelledby="ins-hl">
        <div className="dashboard-panel-heading"><h2 id="ins-hl">{t("insights.health")}</h2><strong className={`ins-score ${healthTone(h?.score ?? null)}`}>{h?.score ?? "—"}</strong></div>
        <p className="dashboard-muted">{t("insights.healthNote")}</p>
        {h ? h.parts.map((p) => (
          <Link key={p.key} href={HEALTH_HREF[p.key]} className="ins-part">
            <span>{t(`insights.h_${p.key}`)}</span>
            <span className="ins-bar" aria-hidden><i className={healthTone(p.score)} style={{ width: `${p.score ?? 0}%` }} /></span>
            <strong>{formatPct(p.score, locale)}</strong>
          </Link>
        )) : <p className="dashboard-muted">{t("homeDashboard.unavailable")}</p>}
      </section>
    </div>
  );
}

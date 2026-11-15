import Link from "next/link";
import { formatEur, formatPct } from "@/lib/format";
import type { WeekRow } from "@/lib/owner/insights";
import { Spark } from "@/components/dash/OwnerInsights";

type Tf = (k: string, v?: Record<string, string | number>) => string;
type Day = { date: string; sales: number | null; hours: number };

// "How are we doing?" — last full week against the week before, each figure with its 8-week shape.
// Green/red follows what is good for the business (labour % down is good). Unknown stays "—", never 0.
export default function PerformanceBand({ trend, labourTarget, flash, t, locale }: { trend: WeekRow[]; labourTarget: number | null; flash: { yesterday: Day; lastWeek: Day } | null; t: Tf; locale: string }) {
  const last = trend[trend.length - 1], prev = trend[trend.length - 2];
  const money = (v: number | null) => formatEur(v, locale, 0);
  const range = last ? (() => {
    const f = (d: Date) => d.toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    const a = new Date(`${last.weekStart}T12:00:00Z`), b = new Date(a); b.setUTCDate(b.getUTCDate() + 6);
    return `${f(a)} – ${f(b)}`;
  })() : "";
  // change against the week before; `good` says which direction is good for the business
  const change = (a: number | null | undefined, b: number | null | undefined, kind: "pct" | "pt" | "eur" | "h", good: "up" | "down" | "none") => {
    if (a == null || b == null || (kind === "pct" && !b)) return null;
    const d = kind === "pct" ? Math.round(((a - b) / b) * 100) : Math.round((a - b) * 10) / 10;
    if (d === 0) return { text: t("perf.same"), tone: "" };
    const up = d > 0, arrow = up ? "▲" : "▼", abs = Math.abs(d);
    const text = kind === "pct" ? `${arrow} ${abs}%` : kind === "pt" ? `${arrow} ${abs} ${t("perf.points")}` : kind === "eur" ? `${arrow} ${money(abs)}` : `${arrow} ${abs} h`;
    return { text, tone: good === "none" ? "" : (up === (good === "up")) ? " good" : " bad" };
  };
  const labourTone = last?.labourPct == null || labourTarget == null ? "" : last.labourPct <= labourTarget ? " good" : last.labourPct <= labourTarget + 3 ? " warn" : " bad";
  const tiles = [
    { key: "sales", label: t("cockpit.sales"), value: last?.sales == null ? "—" : `${last.salesComplete ? "" : "≥ "}${money(last.sales)}`, ch: last?.salesComplete && prev?.salesComplete ? change(last?.sales, prev?.sales, "pct", "up") : null, series: trend.map((w) => w.sales), faded: trend.map((w) => !w.salesComplete), href: "/analytics", tone: "" },
    { key: "labour", label: t("cockpit.labour"), value: formatPct(last?.labourPct, locale), ch: change(last?.labourPct, prev?.labourPct, "pt", "down"), series: trend.map((w) => w.labourPct), href: "/labor", tone: labourTone, sub: labourTarget != null ? t("cockpit.target", { n: labourTarget }) : undefined },
    { key: "splh", label: t("insights.splh"), value: last?.splh == null ? "—" : money(last.splh), ch: change(last?.splh, prev?.splh, "eur", "up"), series: trend.map((w) => w.splh), href: "/labor", tone: "" },
    { key: "hours", label: t("perf.hours"), value: last ? `${Math.round(last.hours)} h` : "—", ch: change(last?.hours, prev?.hours, "h", "none"), series: trend.map((w) => w.hours), href: "/schedule/compare", tone: "" },
  ];
  const yDelta = flash && flash.yesterday.sales != null && flash.lastWeek.sales ? Math.round(((flash.yesterday.sales - flash.lastWeek.sales) / flash.lastWeek.sales) * 100) : null;

  return (
    <section className="perf" aria-labelledby="perf-title">
      <div className="dashboard-panel-heading">
        <h2 id="perf-title">{t("perf.title")} <span className="ins-sub">· {t("perf.lastWeek")} {range}</span></h2>
        <Link href="/analytics">{t("homeDashboard.details")} ›</Link>
      </div>
      <div className="perf-tiles">
        {tiles.map((x) => (
          <Link key={x.key} href={x.href} className={`perf-tile${x.tone}`}>
            <span className="perf-label">{x.label}</span>
            <strong>{x.value}</strong>
            <span className="perf-change">
              {x.ch ? <span className={`perf-delta${x.ch.tone}`}>{x.ch.text}</span> : <span className="ui-muted">—</span>}
              <span className="ui-muted"> {t("perf.vsWeekBefore")}</span>
              {x.sub && <span className="ui-muted"> · {x.sub}</span>}
            </span>
            <Spark values={x.series} faded={x.faded} label={`${x.label} · ${t("insights.trend")}`} />
          </Link>
        ))}
      </div>
      {flash && (
        <p className="perf-yesterday">
          <span className="perf-label">{t("cockpit.flash")}</span>
          <span>{t("cockpit.flashSales")} <strong>{money(flash.yesterday.sales)}</strong>{yDelta != null && <span className={`perf-delta${yDelta >= 0 ? " good" : " bad"}`}> {yDelta >= 0 ? "▲" : "▼"} {Math.abs(yDelta)}%</span>}
            {flash.yesterday.sales == null && <Link className="ui-text-link" href="/labor"> · {t("cockpit.enterSales")}</Link>}</span>
          <span>{t("cockpit.flashHours")} <strong>{flash.yesterday.hours} h</strong> <span className="ui-muted">({flash.lastWeek.hours} h {t("cockpit.vsLastWeek")})</span></span>
        </p>
      )}
    </section>
  );
}

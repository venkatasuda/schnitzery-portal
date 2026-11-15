import Link from "next/link";
import { formatEur, formatPct } from "@/lib/format";
import type { Figure } from "@/lib/analytics/coverage";
import type { WeekSpend } from "@/lib/owner/insights";

type Tf = (k: string, v?: Record<string, string | number>) => string;
export type Profit = {
  weekStart: string; spend: WeekSpend; prevSpend: WeekSpend; primePct: number | null; foodPct: number | null; labourPct: number | null;
  prev: { primePct: number | null; foodPct: number | null }; extra: { mins: number; cost: number | null } | null;
};
export type Leaks = { waste: Figure; wasteEntries: number; price: number; priceItems: number; priceUnknown: number } | null;

// "Where does the money go?" — last full week: prime cost (ingredients + labour ÷ sales) against target,
// ingredient purchases against the week before, and the money that leaked (waste, price rises, hours beyond the roster).
// Unknown stays "—"; nothing is estimated that the data cannot support.
export default function ProfitBand({ profit, leaks, primeTarget, purchaseTarget, t, locale }: {
  profit: Profit; leaks: Leaks; primeTarget: number | null; purchaseTarget: number | null; t: Tf; locale: string;
}) {
  const money = (v: number | null | undefined) => formatEur(v, locale, 0);
  const pts = (a: number | null, b: number | null) => {
    if (a == null || b == null) return null;
    const d = Math.round((a - b) * 10) / 10;
    return d === 0 ? { text: t("perf.same"), tone: "" } : { text: `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} ${t("perf.points")}`, tone: d > 0 ? " bad" : " good" };
  };
  const vsTarget = (v: number | null, target: number | null) => v == null || target == null ? "" : v <= target ? " good" : v <= target + 3 ? " warn" : " bad";
  const spendText = (s: WeekSpend) => s.spend == null ? "—" : `${s.complete ? "" : "≥ "}${money(s.spend)}`;
  const spendCh = profit.spend.complete && profit.prevSpend.complete && profit.prevSpend.spend
    ? Math.round(((profit.spend.spend! - profit.prevSpend.spend) / profit.prevSpend.spend) * 100) : null;
  const primeCh = pts(profit.primePct, profit.prev.primePct);

  const rows = [
    { key: "waste", label: t("profit.waste"), href: "/waste", value: leaks ? (leaks.waste.complete ? leaks.waste.value : null) : null,
      sub: leaks ? `${leaks.wasteEntries} ${t("profit.entries")}` : "" , partial: !!leaks && !leaks.waste.complete && leaks.waste.value > 0 ? leaks.waste.value : null },
    { key: "price", label: t("profit.priceRises"), href: "/inventory/insights", value: leaks && !leaks.priceUnknown ? leaks.price : null,
      sub: leaks ? `${leaks.priceItems} ${t("profit.items")}` : "", partial: leaks && leaks.priceUnknown && leaks.price > 0 ? leaks.price : null },
    { key: "extra", label: t("profit.extraHours"), href: "/schedule/compare", value: profit.extra?.cost ?? null,
      sub: profit.extra ? `${Math.round(profit.extra.mins / 6) / 10} h` : t("profit.noRoster"), partial: null },
  ];
  const known = rows.filter((r) => r.value != null || r.partial != null);
  const total = known.reduce((n, r) => n + (r.value ?? r.partial ?? 0), 0);
  const totalExact = known.length === rows.length && rows.every((r) => r.value != null);

  return (
    <section className="perf profit" aria-labelledby="profit-title">
      <div className="dashboard-panel-heading">
        <h2 id="profit-title">{t("profit.title")} <span className="ins-sub">· {t("perf.lastWeek")}</span></h2>
        <Link href="/inventory/insights">{t("homeDashboard.details")} ›</Link>
      </div>
      <div className="profit-grid">
        <Link href="/targets" className={`perf-tile profit-hero${vsTarget(profit.primePct, primeTarget)}`}>
          <span className="perf-label">{t("profit.prime")}</span>
          <strong>{formatPct(profit.primePct, locale)}</strong>
          <span className="perf-change">
            {primeCh ? <span className={`perf-delta${primeCh.tone}`}>{primeCh.text}</span> : <span className="ui-muted">—</span>}
            <span className="ui-muted"> {t("perf.vsWeekBefore")}{primeTarget != null ? ` · ${t("cockpit.target", { n: primeTarget })}` : ""}</span>
          </span>
          <span className="perf-change ui-muted">{t("profit.food")} {formatPct(profit.foodPct, locale)} · {t("profit.labour")} {formatPct(profit.labourPct, locale)}</span>
        </Link>
        <Link href="/inventory/purchasing" className={`perf-tile${vsTarget(profit.foodPct, purchaseTarget)}`}>
          <span className="perf-label">{t("profit.purchases")}</span>
          <strong>{spendText(profit.spend)}</strong>
          <span className="perf-change">
            {spendCh != null ? <span className="perf-delta">{spendCh === 0 ? t("perf.same") : `${spendCh > 0 ? "▲" : "▼"} ${Math.abs(spendCh)}%`}</span> : <span className="ui-muted">—</span>}
            <span className="ui-muted"> {t("perf.vsWeekBefore")}</span>
          </span>
          <span className="perf-change ui-muted">{formatPct(profit.foodPct, locale)} {t("profit.ofSales")}{purchaseTarget != null ? ` · ${t("cockpit.target", { n: purchaseTarget })}` : ""}</span>
        </Link>
        <div className="card profit-leaks">
          <div className="profit-leaks-head">
            <span className="perf-label">{t("profit.leaks")}</span>
            <strong>{known.length ? `${totalExact ? "" : "≥ "}${money(total)}` : "—"}</strong>
          </div>
          <ul>
            {rows.map((r) => (
              <li key={r.key}>
                <Link href={r.href}>
                  <span>{r.label}</span>
                  <span className="ui-muted">{r.sub}</span>
                  <strong>{r.value != null ? money(r.value) : r.partial != null ? `≥ ${money(r.partial)}` : "—"}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

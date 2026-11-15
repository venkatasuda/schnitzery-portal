"use client";
// Inventory figures for managers and owners: one KPI strip and one "needs action" list, shared by the
// Inventory overview (last 7 days) and Reports → Business insights (7/30/90 days). Data comes from
// getInventoryInsights; nothing is computed here except the comparison arrow.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatEur } from "@/lib/format";
import type { Figure } from "@/lib/analytics/coverage";
import { getInventoryInsights } from "@/lib/queries/inventory-insights";
import { CardSkeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ui";

type Ok = Extract<Awaited<ReturnType<typeof getInventoryInsights>>, { ok: true }>;
export type InsightReport = Ok["report"];

const COPY = {
  en: { stock: "Stock value", counted: "counted in the last 2 days", waste: "Waste", spend: "Purchases", expiry: "Expiring ≤ 3 days", batches: "batches", expired: "expired",
    orders: "Open orders", open: "open", overdue: "overdue", vs: "vs period before", incomplete: "Incomplete", actions: "Needs action", none: "Nothing needs action",
    count: "Count", price: "Price up", expiryKind: "Expiry", order: "Overdue", wasteKind: "Waste", entries: "entries", unknown: "—", title: "This week", report: "Full report",
    failed: "Inventory figures could not be loaded.", retry: "Retry" },
  de: { stock: "Bestandswert", counted: "in den letzten 2 Tagen gezählt", waste: "Ausschuss", spend: "Einkauf", expiry: "Ablauf ≤ 3 Tage", batches: "Chargen", expired: "abgelaufen",
    orders: "Offene Bestellungen", open: "offen", overdue: "überfällig", vs: "ggü. Vorperiode", incomplete: "Unvollständig", actions: "Handlungsbedarf", none: "Kein Handlungsbedarf",
    count: "Zählen", price: "Preis gestiegen", expiryKind: "Ablauf", order: "Überfällig", wasteKind: "Ausschuss", entries: "Einträge", unknown: "—", title: "Diese Woche", report: "Ganzer Bericht",
    failed: "Bestandszahlen konnten nicht geladen werden.", retry: "Erneut versuchen" },
};
const copyFor = (locale: string) => COPY[locale === "de" ? "de" : "en"];

export function InsightKpis({ report, locale }: { report: InsightReport; locale: string }) {
  const c = copyFor(locale), money = (n: number) => formatEur(n, locale, 0);
  // "≥" marks a figure with missing prices or counts; "—" means nothing is known.
  const known = (f: Figure) => f.complete ? money(f.value) : f.value > 0 ? `≥ ${money(f.value)}` : "—";
  const delta = (now: Figure, before: Figure, goodDown: boolean | null) => {
    if (!now.complete || !before.complete || !before.value) return null;
    const d = Math.round(((now.value - before.value) / before.value) * 100);
    if (d === 0) return { text: "±0%", tone: "" };
    return { text: `${d > 0 ? "▲" : "▼"} ${Math.abs(d)}%`, tone: goodDown == null ? "" : goodDown === d < 0 ? " good" : " bad" };
  };
  const cov = report.coverage, expired = report.expiry.filter((b) => b.expired).length;
  const tiles: { key: string; label: string; value: string; href: string; tone: string; ch: { text: string; tone: string } | null; sub: string }[] = [
    { key: "stock", label: c.stock, value: cov.products ? known(report.stockValue) : "—", href: "/inventory/counts",
      tone: cov.products && cov.fresh < cov.products ? " warn" : "", ch: null, sub: `${cov.fresh}/${cov.products} ${c.counted}` },
    { key: "waste", label: c.waste, value: known(report.waste.figure), href: "/waste", tone: "",
      ch: delta(report.waste.figure, report.previousWaste.figure, true), sub: `${report.waste.entries} ${c.entries}` },
    { key: "spend", label: c.spend, value: known(report.spend), href: "/inventory/purchasing", tone: "", ch: delta(report.spend, report.previousSpend, null), sub: "" },
    { key: "expiry", label: c.expiry, value: known(report.expiryValue), href: "/expiry", tone: expired ? " bad" : report.expiry.length ? " warn" : " good",
      ch: null, sub: `${report.expiry.length} ${c.batches}${expired ? ` · ${expired} ${c.expired}` : ""}` },
    { key: "orders", label: c.orders, value: known(report.outstanding), href: "/inventory/purchasing", tone: report.overdue ? " bad" : "",
      ch: null, sub: `${report.openOrders} ${c.open} · ${report.overdue} ${c.overdue}` },
  ];
  return (
    <div className="perf-tiles inv-kpis">
      {tiles.map((x) => (
        <Link key={x.key} href={x.href} className={`perf-tile${x.tone}`}>
          <span className="perf-label">{x.label}</span>
          <strong>{x.value}</strong>
          <span className="perf-change">
            {x.ch ? <><span className={`perf-delta${x.ch.tone}`}>{x.ch.text}</span><span className="ui-muted"> {c.vs}</span></>
              : <span className="ui-muted">{x.sub || "—"}</span>}
          </span>
          {x.ch && x.sub && <span className="perf-change ui-muted">{x.sub}</span>}
        </Link>
      ))}
    </div>
  );
}

export function InsightActions({ actions, locale, limit }: { actions: InsightReport["actions"]; locale: string; limit?: number }) {
  const c = copyFor(locale);
  const kind = { count: [c.count, ""], price: [c.price, " warn"], expiry: [c.expiryKind, " warn"], order: [c.order, " low"], waste: [c.wasteKind, ""] } as const;
  const list = limit ? actions.slice(0, limit) : actions;
  if (!list.length) return <p className="inv-actions-empty">{c.none}</p>;
  return (
    <ul className="inv-actions">
      {list.map((a, i) => {
        const [label, tone] = kind[a.kind];
        const urgent = a.kind === "expiry" && a.priority === 0; // already expired
        return (
          <li key={`${a.kind}-${a.label}-${i}`}>
            <Link href={a.href} className="inv-action">
              <span className={`status-badge${urgent ? " low" : tone}`}>{label}</span>
              <span className="inv-action-label">{a.kind === "waste" ? `${a.label} ${c.entries}` : a.label}</span>
              <span className="inv-action-value">{a.value == null ? c.unknown : formatEur(a.value, locale, 2)}</span>
              <span aria-hidden="true" className="ui-muted">›</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Inventory overview for managers and owners. Staff and shift leaders get "access" and see nothing extra.
export default function InventoryPulse({ locale }: { locale: string }) {
  const c = copyFor(locale);
  const [data, setData] = useState<Ok | null>(null), [state, setState] = useState<"loading" | "ok" | "hidden" | "failed">("loading");
  const seq = useRef(0);
  async function load() {
    const n = ++seq.current; setState("loading");
    try {
      const r = await getInventoryInsights(7);
      if (n !== seq.current) return;
      if (r.ok) { setData(r); setState("ok"); } else setState(r.error === "access" || r.error === "branch" ? "hidden" : "failed");
    } catch { if (n === seq.current) setState("failed"); }
  }
  useEffect(() => { void load(); return () => { seq.current++; }; }, []);
  if (state === "hidden") return null;
  if (state === "loading") return <CardSkeleton rows={3} />;
  if (state === "failed" || !data) return <ErrorState message={c.failed} onRetry={() => void load()} retryLabel={c.retry} />;
  return (
    <section className="inv-pulse" aria-labelledby="inv-pulse-title">
      <div className="dashboard-panel-heading">
        <h2 id="inv-pulse-title">{c.title}</h2>
        <Link href="/inventory/insights">{c.report} ›</Link>
      </div>
      <InsightKpis report={data.report} locale={locale} />
      <section className="card inv-pulse-actions" aria-label={c.actions}>
        <div className="ui-panel-head"><h2>{c.actions}</h2></div>
        <InsightActions actions={data.report.actions} locale={locale} limit={6} />
      </section>
    </section>
  );
}

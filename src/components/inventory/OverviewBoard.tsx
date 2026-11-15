"use client";
// Inventory → Overview for managers and owners (layout from the AI Studio design, Schnitzery colours):
// 4 summary cards with a footer action · exception switcher with 3 separate cards · value by category + quick actions.
// Data: getInventoryInsights (last 7 days). Staff and shift leaders get "access" and see the fallback instead.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Truck, ChefHat, Lock, ShoppingCart, Clock, AlertTriangle } from "lucide-react";
import { formatEur } from "@/lib/format";
import { fmtDay } from "@/lib/time/berlinDate";
import type { Figure } from "@/lib/analytics/coverage";
import { getInventoryInsights } from "@/lib/queries/inventory-insights";
import { overviewGroups } from "@/lib/inventory/overview";
import { CardSkeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ui";

type Ok = Extract<Awaited<ReturnType<typeof getInventoryInsights>>, { ok: true }>;
type Group = "all" | "reorder" | "expiry" | "gaps";

const COPY = {
  en: { value: "Stock value", products: "products", priced: "with a price", left: "left", close: "Valuation close", coverage: "Count coverage", counted: "counted in the last 2 days", stale: "not counted recently", allCounted: "All products counted", countSheet: "Count sheet",
    inbound: "Open orders", open: "open", overdue: "overdue", noOverdue: "Nothing overdue", receiving: "Receive goods", risk: "Money at risk", wasteWeek: "waste this week", expiring: "expiring ≤ 3 days", wasteLog: "Waste log",
    exceptions: "Needs action", all: "All", reorder: "Reorder", expiry: "Expiry", gaps: "Data gaps", reorderTitle: "Below reorder point", createOrder: "Reorder worksheet", order: "order",
    expiryTitle: "Expiring or expired batches", openBatches: "Batches", expired: "expired", gapsTitle: "Missing counts or prices", gapsNote: "Figures stay incomplete until fixed", noCount: "Never counted", noPrice: "No delivery price",
    count: "Count", setPrice: "Add price", inspect: "Open", noneReorder: "Nothing below its reorder point.", noneExpiry: "No batches expiring in the next 3 days.", noneGaps: "Every product is counted and priced.",
    byCategory: "Value by category", quick: "Quick actions", spot: "Count", receive: "Receive", kitchen: "Kitchen prep", period: "Period close", failed: "Inventory figures could not be loaded.", retry: "Retry", lastCount: "counted" },
  de: { value: "Bestandswert", products: "Artikel", priced: "mit Preis", left: "übrig", close: "Bestandsabschluss", coverage: "Zählabdeckung", counted: "in den letzten 2 Tagen gezählt", stale: "länger nicht gezählt", allCounted: "Alles gezählt", countSheet: "Zählliste",
    inbound: "Offene Bestellungen", open: "offen", overdue: "überfällig", noOverdue: "Nichts überfällig", receiving: "Wareneingang", risk: "Geld im Risiko", wasteWeek: "Ausschuss diese Woche", expiring: "Ablauf ≤ 3 Tage", wasteLog: "Ausschuss",
    exceptions: "Handlungsbedarf", all: "Alle", reorder: "Nachbestellen", expiry: "Ablauf", gaps: "Datenlücken", reorderTitle: "Unter Meldebestand", createOrder: "Nachbestellung", order: "bestellen",
    expiryTitle: "Ablaufende oder abgelaufene Chargen", openBatches: "Chargen", expired: "abgelaufen", gapsTitle: "Fehlende Zählungen oder Preise", gapsNote: "Zahlen bleiben bis dahin unvollständig", noCount: "Nie gezählt", noPrice: "Kein Lieferpreis",
    count: "Zählen", setPrice: "Preis erfassen", inspect: "Öffnen", noneReorder: "Nichts unter dem Meldebestand.", noneExpiry: "Keine Chargen laufen in den nächsten 3 Tagen ab.", noneGaps: "Alle Artikel sind gezählt und bepreist.",
    byCategory: "Wert nach Kategorie", quick: "Schnellzugriff", spot: "Zählen", receive: "Wareneingang", kitchen: "Küche", period: "Abschluss", failed: "Bestandszahlen konnten nicht geladen werden.", retry: "Erneut versuchen", lastCount: "gezählt" },
};

export default function OverviewBoard({ locale, fallback }: { locale: string; fallback: ReactNode }) {
  const c = COPY[locale === "de" ? "de" : "en"];
  const [data, setData] = useState<Ok | null>(null), [state, setState] = useState<"loading" | "ok" | "hidden" | "failed">("loading");
  const [group, setGroup] = useState<Group>("all");
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
  if (state === "hidden") return <>{fallback}</>;
  if (state === "loading") return <CardSkeleton rows={4} />;
  if (state === "failed" || !data) return <ErrorState message={c.failed} onRetry={() => void load()} retryLabel={c.retry} />;

  const r = data.report, money = (n: number | null) => formatEur(n, locale, 0), cents = (n: number | null) => formatEur(n, locale, 2);
  const known = (f: Figure) => (f.complete ? money(f.value) : f.value > 0 ? `≥ ${money(f.value)}` : "—");
  const g = overviewGroups(r.stock, r.expiry);
  const cov = r.coverage, expired = g.expiring.filter((b) => b.expired).length;
  const total = g.reorder.length + g.expiring.length + g.gaps.length;
  const show = (x: Group) => group === "all" || group === x;
  const risk = (r.waste.figure.complete ? r.waste.figure.value : 0) + (r.expiryValue.value ?? 0);

  const cards = [
    { key: "value", label: c.value, meta: `${cov.products} ${c.products}`, value: cov.products ? known(r.stockValue) : "—", tone: "",
      foot: <span className="ui-muted">{cov.priced}/{cov.products} {c.priced}</span>, href: "/inventory/valuation", action: c.close },
    { key: "coverage", label: c.coverage, meta: `${cov.fresh}/${cov.products}`, value: cov.products ? `${Math.round((cov.fresh / cov.products) * 100)}%` : "—", tone: "",
      foot: g.stale ? <span className="tone-warn">{g.stale} {c.stale}</span> : <span className="tone-success">{c.allCounted}</span>, href: "/inventory/counts", action: c.countSheet },
    { key: "inbound", label: c.inbound, meta: `${r.openOrders} ${c.open}`, value: known(r.outstanding), tone: "",
      foot: r.overdue ? <span className="tone-danger">{r.overdue} {c.overdue}</span> : <span className="ui-muted">{c.noOverdue}</span>, href: "/inventory/purchasing?receive=1", action: c.receiving },
    { key: "risk", label: c.risk, meta: `${r.expiry.length} ${c.openBatches}`, value: risk > 0 ? `${r.expiryValue.complete && r.waste.figure.complete ? "" : "≥ "}${money(risk)}` : "—", tone: risk > 0 ? " is-danger" : "",
      foot: <span className="ui-muted">{money(r.waste.figure.value)} {c.wasteWeek} · {money(r.expiryValue.value)} {c.expiring}</span>, href: "/waste", action: c.wasteLog },
  ];

  return (
    <div className="inv-board">
      <div className="inv-board-kpis">
        {cards.map((k) => (
          <article key={k.key} className="card inv-kpi">
            <div className="inv-kpi-head"><span>{k.label}</span><span className="inv-mono">{k.meta}</span></div>
            <strong className={`inv-kpi-value${k.tone}`}>{k.value}</strong>
            <div className="inv-kpi-foot">{k.foot}<Link href={k.href}>{k.action} <ArrowRight size={12} aria-hidden="true" /></Link></div>
          </article>
        ))}
      </div>

      <div className="inv-board-main">
        <div className="inv-board-left">
          <div className="card inv-switch">
            <h2>{c.exceptions} ({total})</h2>
            <div className="ui-segmented" role="group" aria-label={c.exceptions}>
              {([["all", c.all, total], ["reorder", c.reorder, g.reorder.length], ["expiry", c.expiry, g.expiring.length], ["gaps", c.gaps, g.gaps.length]] as const).map(([id, label, n]) => (
                <button key={id} type="button" aria-pressed={group === id} onClick={() => setGroup(id)}>{label} ({n})</button>
              ))}
            </div>
          </div>

          {show("reorder") && <section className="card inv-block" aria-labelledby="inv-reorder">
            <header><h2 id="inv-reorder"><ShoppingCart size={14} aria-hidden="true" className="tone-danger" /> {c.reorderTitle} ({g.reorder.length})</h2>
              <Link className="btn-gold ui-btn-sm" href="/inventory/order">{c.createOrder}</Link></header>
            {g.reorder.length ? <ul>{g.reorder.slice(0, 8).map((p) => (
              <li key={p.id}>
                <div><strong>{p.product}</strong><small>{p.qty}/{p.target ?? "—"} {p.unit}{p.stale ? ` · ${c.stale}` : ""}</small></div>
                <div className="inv-row-end"><span className="inv-mono tone-danger">{p.suggested != null ? `${c.order} ${p.suggested} ${p.unit}` : `${p.qty} ${p.unit} ${c.left}`}</span>
                  <Link className="btn-secondary ui-btn-sm" href="/inventory?view=forecast">{c.inspect}</Link></div>
              </li>))}</ul> : <p className="inv-empty">{c.noneReorder}</p>}
          </section>}

          {show("expiry") && <section className="card inv-block" aria-labelledby="inv-expiry">
            <header><h2 id="inv-expiry"><Clock size={14} aria-hidden="true" className="tone-warn" /> {c.expiryTitle} ({g.expiring.length})</h2>
              <Link className="btn-secondary ui-btn-sm" href="/expiry">{c.openBatches}</Link></header>
            {g.expiring.length ? <ul>{g.expiring.slice(0, 8).map((b) => (
              <li key={b.id}>
                <div><strong>{b.product}</strong><small>{b.qty ?? "—"} {b.unit} · {fmtDay(b.expiry, locale)}{b.expired ? ` · ${c.expired}` : ""}</small></div>
                <div className="inv-row-end"><span className={`inv-mono ${b.expired ? "tone-danger" : "tone-warn"}`}>{cents(b.value)}</span>
                  <Link className="btn-secondary ui-btn-sm" href="/expiry">{c.inspect}</Link></div>
              </li>))}</ul> : <p className="inv-empty">{c.noneExpiry}</p>}
          </section>}

          {show("gaps") && <section className="card inv-block" aria-labelledby="inv-gaps">
            <header><h2 id="inv-gaps"><AlertTriangle size={14} aria-hidden="true" className="tone-warn" /> {c.gapsTitle} ({g.gaps.length})</h2>
              <span className="ui-muted">{c.gapsNote}</span></header>
            {g.gaps.length ? <ul>{g.gaps.slice(0, 8).map((x) => (
              <li key={`${x.kind}${x.id}`}>
                <div><strong>{x.product}</strong><small>{x.kind === "count" ? c.noCount : c.noPrice}</small></div>
                <div className="inv-row-end"><Link className="btn-secondary ui-btn-sm" href={x.kind === "count" ? "/inventory/counts" : "/inventory/prices"}>{x.kind === "count" ? c.count : c.setPrice}</Link></div>
              </li>))}</ul> : <p className="inv-empty">{c.noneGaps}</p>}
          </section>}
        </div>

        <aside className="inv-board-right">
          <section className="card inv-side" aria-labelledby="inv-cat">
            <header><h2 id="inv-cat">{c.byCategory}</h2><span className="inv-mono ui-muted">€</span></header>
            {g.byCategory.length ? g.byCategory.slice(0, 6).map((x) => (
              <div key={x.name} className="inv-cat">
                <div><span>{x.name}</span><span className="inv-mono ui-muted">{money(x.value)} · {x.pct}%</span></div>
                <progress className="inventory-coverage-bar" value={x.pct} max={100} aria-label={`${x.name}: ${x.pct}%`}>{x.pct}%</progress>
              </div>)) : <p className="inv-empty">—</p>}
          </section>
          <section className="card inv-side" aria-labelledby="inv-quick">
            <header><h2 id="inv-quick">{c.quick}</h2></header>
            <div className="inv-quick">
              {([[c.spot, "/inventory/counts", ClipboardList], [c.receive, "/inventory/purchasing?receive=1", Truck], [c.kitchen, "/inventory/production", ChefHat], [c.period, "/inventory/valuation", Lock]] as const).map(([label, href, Icon]) => (
                <Link key={href} href={href}><Icon size={16} aria-hidden="true" /><span>{label}</span></Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

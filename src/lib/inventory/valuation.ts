// Relative imports: vitest runs without the "@/" alias.
import { figure, latestPrice, type Figure } from "../analytics/coverage";
import type { StockInterval } from "./reconciliation";

// Release D: euro value of what was used, from Release C reconciliation intervals.
// OK/Unusual intervals count; Gain/Uncertain are withheld (counts), unpriced ones too (prices).
// Each interval is priced at the latest delivery price on or before its closing count.
type Row = StockInterval & { product: string; category: string; unit: string | null };
type Purchase = { product: string; category?: string | null; unit?: string | null; purchase_date: string; qty: unknown; cost: unknown };

const key = (r: { category?: string | null; product: string; unit?: string | null }) => JSON.stringify([r.category || "", r.product, (r.unit || "").trim().toLowerCase()]);

export function valueUsage(rows: Row[], purchases: Purchase[]) {
  const byKey: Record<string, Purchase[]> = {};
  for (const p of purchases) (byKey[key(p)] ||= []).push(p);
  let eur = 0, withheld = 0, unpriced = 0;
  const products: Record<string, { product: string; category: string; qty: number; eur: number }> = {};
  const spans: Record<string, { from: string; to: string }> = {};
  const byDate: Record<string, number> = {}; // value booked on the closing-count date
  for (const r of rows) {
    const k = JSON.stringify([r.category, r.product]);
    const s = (spans[k] ||= { from: r.from, to: r.to });
    if (r.from < s.from) s.from = r.from; if (r.to > s.to) s.to = r.to;
    if (r.status !== "ok" && r.status !== "unusual") { withheld++; continue; }
    const price = latestPrice(byKey[key(r)] || [], r.to);
    if (price == null) { unpriced++; continue; }
    const used = Math.max(0, r.used), value = used * price;
    eur += value; byDate[r.to] = (byDate[r.to] || 0) + value;
    const p = (products[k] ||= { product: r.product, category: r.category, qty: 0, eur: 0 });
    p.qty += used; p.eur += value;
  }
  const usage: Figure = figure(eur, { counts: withheld, prices: unpriced });
  // A ratio against sales is only fair when every product covers the same counted span.
  const distinct = Array.from(new Set(Object.values(spans).map(s => `${s.from}|${s.to}`)));
  const span = distinct.length === 1 ? { from: distinct[0].split("|")[0], to: distinct[0].split("|")[1] } : null;
  return { usage, span, byDate, products: Object.values(products).sort((a, b) => b.eur - a.eur) };
}

// Latest count per product × latest price on or before today.
export function valueStock(latest: { product: string; category?: string | null; unit?: string | null; ist: number }[], purchases: Purchase[], today: string): Figure & { priced: number } {
  const byKey: Record<string, Purchase[]> = {};
  for (const p of purchases) (byKey[key(p)] ||= []).push(p);
  let eur = 0, unpriced = 0, invalid = 0, priced = 0;
  for (const c of latest) {
    if (!Number.isFinite(c.ist) || c.ist < 0) { invalid++; continue; }
    if (c.ist === 0) continue;
    const price = latestPrice(byKey[key(c)] || [], today);
    if (price == null) unpriced++; else { eur += c.ist * price; priced++; }
  }
  return { ...figure(eur, { prices: unpriced, counts: invalid }), priced };
}

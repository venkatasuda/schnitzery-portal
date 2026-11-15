// Inventory overview groups (manager / owner), from the insights report. Pure, no I/O.
// Unknown stays unknown: a product without a count is never "0 in stock", without a price never "€0".
type Num = unknown;
const num = (n: Num): number | null => (n == null || n === "" || !Number.isFinite(Number(n)) || Number(n) < 0 ? null : Number(n));

export type OverviewStock = {
  id: string; product: string; category?: string | null; unit?: string | null; soll: Num; reorder_point?: Num;
  qty: number | null; price: number | null; value: number | null; fresh: boolean; suggested: number | null; age: number | null;
};
export type OverviewBatch = { id: string; product: string; unit?: string | null; qty: Num; remaining_qty?: Num; expiry_date: string; value: number | null; expired: boolean };

export function overviewGroups(stock: OverviewStock[], expiry: OverviewBatch[]) {
  // 1. Reorder: counted at or below the reorder point (or below target when no reorder point is set).
  const reorder = stock
    .map((p) => ({ ...p, target: num(p.soll), threshold: num(p.reorder_point) ?? num(p.soll) }))
    .filter((p) => p.qty != null && p.threshold != null && p.qty <= p.threshold)
    .sort((a, b) => (a.qty! / Math.max(a.threshold!, 0.001)) - (b.qty! / Math.max(b.threshold!, 0.001)) || a.product.localeCompare(b.product))
    .map((p) => ({ id: p.id, product: p.product, unit: p.unit ?? "", qty: p.qty!, target: p.target, suggested: p.suggested, stale: !p.fresh }));
  // 2. Expiry: expired first, then soonest.
  const expiring = [...expiry].sort((a, b) => Number(b.expired) - Number(a.expired) || a.expiry_date.localeCompare(b.expiry_date))
    .map((b) => ({ id: b.id, product: b.product, unit: b.unit ?? "", qty: num(b.remaining_qty === undefined ? b.qty : b.remaining_qty), expiry: b.expiry_date, value: b.value, expired: b.expired }));
  // 3. Gaps that make figures incomplete: never counted, or counted without a known price.
  const gaps = [
    ...stock.filter((p) => p.qty == null).map((p) => ({ id: p.id, product: p.product, kind: "count" as const })),
    ...stock.filter((p) => p.qty != null && p.qty > 0 && p.price == null).map((p) => ({ id: p.id, product: p.product, kind: "price" as const })),
  ];
  // Value by category (known values only), largest first.
  const totals = new Map<string, number>();
  for (const p of stock) if (p.value != null) totals.set(p.category || "—", (totals.get(p.category || "—") ?? 0) + p.value);
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const byCategory = [...totals].map(([name, value]) => ({ name, value: Math.round(value), pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
  const stale = stock.filter((p) => !p.fresh).length;
  return { reorder, expiring, gaps, byCategory, stale };
}

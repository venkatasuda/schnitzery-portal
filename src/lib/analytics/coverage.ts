// Release D (docs/ANALYTICS-RELIABILITY.md): missing data is never zero.
// A money figure carries what it could not include; percentages need complete inputs.

export type Missing = Partial<Record<"wages" | "salesDays" | "costs" | "prices" | "counts", number>>;
export type Figure = { value: number; complete: boolean; missing: Missing };

export function figure(value: number, missing: Missing = {}): Figure {
  const m: Missing = {};
  for (const [k, n] of Object.entries(missing) as [keyof Missing, number][]) if (n > 0) m[k] = n;
  return { value: Math.round(value * 100) / 100, complete: Object.keys(m).length === 0, missing: m };
}

// Hidden (null) unless both sides are complete and the base is positive.
export function pctOf(part: Figure, base: Figure): number | null {
  if (!part.complete || !base.complete || !(base.value > 0)) return null;
  return Math.round((part.value / base.value) * 1000) / 10;
}

// A day counts as open when anyone worked at that branch; an open day without a
// sales entry is missing (a closed day is not).
export function missingSalesDays(worked: { branch_id: string; work_date: string }[], sales: { branch_id: string; sale_date: string }[], through: string): number {
  const entered = new Set(sales.map(s => `${s.branch_id}|${s.sale_date}`));
  const open = new Set(worked.filter(w => w.work_date <= through).map(w => `${w.branch_id}|${w.work_date}`));
  return Array.from(open).filter(k => !entered.has(k)).length;
}

const validCost = (v: unknown) => v != null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;
// Purchase spend: an entry without a usable cost is missing, not €0.
export function spendFigure(rows: { cost: unknown }[]): Figure {
  let sum = 0, missing = 0;
  for (const r of rows) validCost(r.cost) ? (sum += Number(r.cost)) : missing++;
  return figure(sum, { costs: missing });
}

// Latest delivery price on or before `date` (owner decision 2026-10-21). Several
// deliveries on that latest day are weighted by quantity. null = no usable price.
export function latestPrice(purchases: { purchase_date: string; qty: unknown; cost: unknown }[], date: string): number | null {
  let day = "", qty = 0, cost = 0;
  for (const p of purchases) {
    const q = Number(p.qty);
    if (p.purchase_date > date || !(q > 0) || !Number.isFinite(q) || !validCost(p.cost)) continue;
    if (p.purchase_date > day) { day = p.purchase_date; qty = 0; cost = 0; }
    if (p.purchase_date === day) { qty += q; cost += Number(p.cost); }
  }
  return qty > 0 ? cost / qty : null;
}

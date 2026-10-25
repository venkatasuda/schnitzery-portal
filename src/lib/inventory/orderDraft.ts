import { figure } from "../analytics/coverage";

export type OrderLine = { qty: number | string; unitPrice: number | null };

export function orderLineCost(line: OrderLine): number | null {
  const qty = Number(line.qty);
  if (String(line.qty).trim() === "" || !Number.isFinite(qty) || qty < 0 || line.unitPrice == null || !Number.isFinite(line.unitPrice) || line.unitPrice < 0) return null;
  const cost = Math.round(qty * line.unitPrice * 100) / 100;
  return Number.isFinite(cost) ? cost : null;
}

export function orderSummary(lines: OrderLine[]) {
  let value = 0, missingPrices = 0, invalidQuantities = 0, selected = 0;
  for (const line of lines) {
    const qty = Number(line.qty);
    if (String(line.qty).trim() === "" || !Number.isFinite(qty) || qty < 0) { invalidQuantities++; continue; }
    if (qty === 0) continue;
    selected++;
    const cost = orderLineCost(line);
    if (cost == null || !Number.isFinite(cost)) missingPrices++; else value += cost;
  }
  const money = figure(value, { prices: missingPrices });
  return { ...money, complete: money.complete && invalidQuantities === 0, missingPrices, invalidQuantities, selected };
}

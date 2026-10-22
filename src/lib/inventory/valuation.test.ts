import { expect, it } from "vitest";
import { valueStock, valueUsage } from "./valuation";

const iv = (product: string, from: string, to: string, used: number, status: "ok" | "unusual" | "gain" | "uncertain" = "ok") =>
  ({ product, category: "Dry", unit: "kg", from, to, used, status, fromId: from, toId: to, opening: 0, delivered: 0, received: 0, sent: 0, wasted: 0, closing: 0, expected: 0, usedPerDay: 0, reasons: [] });
const buy = (product: string, purchase_date: string, qty: number, cost: number | null, unit = "kg") => ({ product, category: "Dry", unit, purchase_date, qty, cost });

it("values clean intervals at the latest price on or before each closing count", () => {
  const r = valueUsage([iv("Oil", "2026-10-01", "2026-10-05", 4), iv("Oil", "2026-10-05", "2026-10-09", 2, "unusual")],
    [buy("Oil", "2026-09-20", 10, 20), buy("Oil", "2026-10-07", 10, 30), buy("Oil", "2026-10-20", 1, 99)]);
  expect(r.usage).toEqual({ value: 4 * 2 + 2 * 3, complete: true, missing: {} });
  expect(r.span).toEqual({ from: "2026-10-01", to: "2026-10-09" });
  expect(r.products).toEqual([{ product: "Oil", category: "Dry", qty: 6, eur: 14 }]);
});

it("withholds gains/uncertain and unpriced intervals instead of counting them as zero", () => {
  const r = valueUsage([iv("Oil", "2026-10-01", "2026-10-05", -3, "gain"), iv("Salt", "2026-10-01", "2026-10-05", 1), iv("Flour", "2026-10-01", "2026-10-05", 2)],
    [buy("Flour", "2026-09-01", 1, 2), buy("Salt", "2026-09-01", 1, 5, "pcs")]); // Salt bought in another unit → no price
  expect(r.usage).toEqual({ value: 4, complete: false, missing: { counts: 1, prices: 1 } });
});

it("has no common span when products were counted on different days", () => {
  expect(valueUsage([iv("Oil", "2026-10-01", "2026-10-05", 1), iv("Salt", "2026-10-02", "2026-10-05", 1)], []).span).toBeNull();
});

it("stock value marks unpriced products instead of valuing them at zero", () => {
  expect(valueStock([{ product: "Oil", category: "Dry", unit: "kg", ist: 3 }, { product: "Salt", category: "Dry", unit: "kg", ist: 0 }, { product: "Rice", category: "Dry", unit: "kg", ist: 2 }],
    [buy("Oil", "2026-10-01", 2, 5)], "2026-10-21")).toEqual({ value: 7.5, complete: false, missing: { prices: 1 }, priced: 1 });
});

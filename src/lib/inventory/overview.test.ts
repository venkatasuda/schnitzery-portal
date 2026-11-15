import { expect, it } from "vitest";
import { overviewGroups, type OverviewStock } from "./overview";

const p = (o: Partial<OverviewStock>): OverviewStock => ({ id: "x", product: "x", category: "Meat", unit: "kg", soll: 10, qty: null, price: null, value: null, fresh: true, suggested: null, age: 0, ...o });

it("lists only counted products at or below their reorder point, most urgent first", () => {
  const g = overviewGroups([
    p({ id: "a", product: "Chicken", qty: 2, soll: 10, suggested: 8 }),
    p({ id: "b", product: "Oil", qty: 5, soll: 10, reorder_point: 6 }),
    p({ id: "c", product: "Rice", qty: 9, soll: 10, reorder_point: 4 }),   // above its reorder point
    p({ id: "d", product: "Salt", qty: null, soll: 10 }),                  // not counted: unknown, not low
  ], []);
  expect(g.reorder.map((r) => r.id)).toEqual(["a", "b"]);
  expect(g.reorder[0]).toMatchObject({ qty: 2, target: 10, suggested: 8, stale: false });
});
it("puts expired batches first, then the soonest", () => {
  const g = overviewGroups([], [
    { id: "1", product: "Milk", qty: 3, expiry_date: "2026-11-17", value: 3, expired: false },
    { id: "2", product: "Cream", qty: 1, expiry_date: "2026-11-10", value: 2, expired: true },
    { id: "3", product: "Eggs", qty: 1, remaining_qty: 0.5, expiry_date: "2026-11-16", value: null, expired: false },
  ]);
  expect(g.expiring.map((b) => b.id)).toEqual(["2", "3", "1"]);
  expect(g.expiring[1].qty).toBe(0.5);
});
it("reports gaps and splits known value by category", () => {
  const g = overviewGroups([
    p({ id: "a", category: "Meat", qty: 2, price: 10, value: 20 }),
    p({ id: "b", category: "Dry", qty: 5, price: 12, value: 60 }),
    p({ id: "c", category: "Dry", qty: 1, price: null, value: null }),
    p({ id: "d", qty: null, fresh: false }),
  ], []);
  expect(g.gaps).toEqual([{ id: "d", product: "x", kind: "count" }, { id: "c", product: "x", kind: "price" }]);
  expect(g.byCategory).toEqual([{ name: "Dry", value: 60, pct: 75 }, { name: "Meat", value: 20, pct: 25 }]);
  expect(g.stale).toBe(1);
});

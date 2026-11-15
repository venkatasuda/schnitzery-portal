import { expect, it } from "vitest";
import { stagedOrder } from "./stageOrder";

const products = [
  { id: "p1", product: "Chicken", category: "Meat", unit: "kg", supplier_id: "s1", is_active: true },
  { id: "p2", product: "Oil", category: "Dry", unit: "L", supplier_id: "s1", is_active: true },
  { id: "p3", product: "Old", category: "Dry", unit: "kg", supplier_id: null, is_active: false },
];
const suppliers = [{ id: "s1", name: "Metro", is_active: true }, { id: "s2", name: "Gone", is_active: false }];

it("builds order lines for the matching supplier and products", () => {
  const r = stagedOrder({ supplier: " metro ", items: [
    { product: "Chicken", category: "Meat", unit: "kg", qty: "8", unitPrice: 6.5 },
    { product: "Oil", category: "Dry", unit: "L", qty: 2, unitPrice: null },
  ] }, products, suppliers);
  expect(r).toEqual({ supplier_id: "s1", skipped: 0, lines: [
    { product_id: "p1", qty: "8", pack_id: "", unit_price: "6.5" },
    { product_id: "p2", qty: "2", pack_id: "", unit_price: "" },
  ] });
});
it("drops zero/invalid quantities, counts unknown or inactive products, never picks an inactive supplier", () => {
  const r = stagedOrder({ supplier: "Gone", items: [
    { product: "Chicken", category: "Meat", unit: "kg", qty: "0", unitPrice: 1 },
    { product: "Chicken", category: "Meat", unit: "kg", qty: "x", unitPrice: 1 },
    { product: "Old", category: "Dry", unit: "kg", qty: 3, unitPrice: 1 },
    { product: "Ghost", category: "Dry", unit: "kg", qty: 1, unitPrice: 1 },
  ] }, products, suppliers);
  expect(r).toEqual({ supplier_id: "", lines: [], skipped: 2 });
});

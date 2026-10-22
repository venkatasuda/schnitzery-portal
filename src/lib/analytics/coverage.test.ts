import { expect, it } from "vitest";
import { figure, latestPrice, missingSalesDays, pctOf, spendFigure } from "./coverage";

it("a figure is complete only when nothing is missing", () => {
  expect(figure(100, { wages: 0 })).toEqual({ value: 100, complete: true, missing: {} });
  expect(figure(100, { wages: 2, costs: 0 })).toEqual({ value: 100, complete: false, missing: { wages: 2 } });
});

it("percentages need complete inputs and a positive base", () => {
  expect(pctOf(figure(25), figure(100))).toBe(25);
  expect(pctOf(figure(25, { wages: 1 }), figure(100))).toBeNull();
  expect(pctOf(figure(25), figure(100, { salesDays: 1 }))).toBeNull();
  expect(pctOf(figure(25), figure(0))).toBeNull();
});

it("an open day without sales is missing; a closed day is not; future days ignored", () => {
  const worked = [{ branch_id: "A", work_date: "2026-10-01" }, { branch_id: "A", work_date: "2026-10-01" }, { branch_id: "A", work_date: "2026-10-02" }, { branch_id: "B", work_date: "2026-10-02" }, { branch_id: "A", work_date: "2026-10-30" }];
  const sales = [{ branch_id: "A", sale_date: "2026-10-01" }, { branch_id: "A", sale_date: "2026-10-03" }];
  expect(missingSalesDays(worked, sales, "2026-10-21")).toBe(2); // A 10-02, B 10-02
});

it("purchases without a cost are missing, not zero", () => {
  expect(spendFigure([{ cost: 10 }, { cost: "5.5" }, { cost: null }, { cost: "" }, { cost: -1 }])).toEqual({ value: 15.5, complete: false, missing: { costs: 3 } });
  expect(spendFigure([{ cost: 0 }]).complete).toBe(true); // a free delivery is a real €0
});

it("uses the latest usable delivery price on or before the date", () => {
  const p = [
    { purchase_date: "2026-09-01", qty: 10, cost: 20 },
    { purchase_date: "2026-10-01", qty: 10, cost: 30 },
    { purchase_date: "2026-10-01", qty: 30, cost: 70 },   // same day → weighted: 100/40
    { purchase_date: "2026-10-05", qty: 5, cost: null },  // unusable
    { purchase_date: "2026-10-10", qty: 1, cost: 9 },     // after the date
  ];
  expect(latestPrice(p, "2026-10-07")).toBe(2.5);
  expect(latestPrice(p, "2026-09-15")).toBe(2);
  expect(latestPrice(p, "2026-08-01")).toBeNull();
});

import { expect, it } from "vitest";
import { channelSplit, channelTotal } from "./channels";

it("splits closed days into till and platforms with share and average order", () => {
  const r = channelSplit([
    { pos_total: 1000, channels: { lieferando: { gross: 300, orders: 12 }, wolt: { gross: 100, orders: 4 } } },
    { pos_total: 600, channels: {} },
    { pos_total: null, channels: { wolt: { gross: 50, orders: 2 } } }, // no till figure: left out
  ]);
  expect(r.days).toBe(2);
  expect(r.total).toBe(2000);
  expect(r.rows).toEqual([
    { key: "till", sales: 1600, orders: null, share: 80, avg: null },
    { key: "lieferando", sales: 300, orders: 12, share: 15, avg: 25 },
    { key: "wolt", sales: 100, orders: 4, share: 5, avg: 25 },
  ]);
  expect(channelTotal({ lieferando: { gross: 10.1, orders: 1 }, uber_eats: { gross: 0.2, orders: 1 } })).toBe(10.3);
});

it("accepts only Lieferando / Uber Eats / Wolt with € amounts and whole orders", async () => {
  const { ChannelSalesSchema: S } = await import("./channels");
  expect(S.safeParse({ lieferando: { gross: 412.5, orders: 23 }, wolt: { gross: 96.4, orders: 5 } }).success).toBe(true);
  expect(S.safeParse({}).success).toBe(true);
  expect(S.safeParse({ deliveroo: { gross: 10, orders: 1 } }).success).toBe(false);
  expect(S.safeParse({ wolt: { gross: -1, orders: 1 } }).success).toBe(false);
  expect(S.safeParse({ wolt: { gross: 10.123, orders: 1 } }).success).toBe(false);
  expect(S.safeParse({ wolt: { gross: 10, orders: 1.5 } }).success).toBe(false);
  expect(S.safeParse({ wolt: { gross: 10, orders: 1, tip: 2 } }).success).toBe(false);
});

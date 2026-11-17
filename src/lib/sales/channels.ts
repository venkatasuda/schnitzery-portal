// Delivery platforms print on their own order printers (not in the till); their totals are entered at the day close.
import { z } from "zod";

export const CHANNELS = ["lieferando", "uber_eats", "wolt"] as const;
// Same limits as private.delivery_channel_total (20261116120000): € with cents, whole orders.
const Platform = z.strictObject({ gross: z.number().nonnegative().max(999999.99).multipleOf(0.01), orders: z.number().int().nonnegative().max(9999) });
export const ChannelSalesSchema = z.strictObject({ lieferando: Platform.optional(), uber_eats: Platform.optional(), wolt: Platform.optional() });
export type Channel = (typeof CHANNELS)[number];
export type ChannelSales = Partial<Record<Channel, { gross: number; orders: number }>>;
export const CHANNEL_LABEL: Record<Channel, string> = { lieferando: "Lieferando", uber_eats: "Uber Eats", wolt: "Wolt" };
export const channelTotal = (c: ChannelSales | null | undefined) =>
  Math.round(Object.values(c ?? {}).reduce((a, x) => a + (x?.gross ?? 0), 0) * 100) / 100;

// Sales by channel over closed days: till vs each platform, with orders and average order value.
// Days without a till figure are left out (the day's total would be wrong).
export type ChannelRow = { key: "till" | Channel; sales: number; orders: number | null; share: number; avg: number | null };
export function channelSplit(closes: { pos_total: number | null; channels: ChannelSales | null }[]) {
  const sum: Record<string, { sales: number; orders: number }> = {};
  let days = 0;
  for (const c of closes) {
    if (c.pos_total == null) continue;
    days++;
    (sum.till ??= { sales: 0, orders: 0 }).sales += c.pos_total;
    for (const k of CHANNELS) { const v = c.channels?.[k]; if (v) { const s = (sum[k] ??= { sales: 0, orders: 0 }); s.sales += v.gross; s.orders += v.orders; } }
  }
  const total = Object.values(sum).reduce((a, s) => a + s.sales, 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rows: ChannelRow[] = (["till", ...CHANNELS] as const).filter((k) => sum[k]).map((k) => ({
    key: k, sales: r2(sum[k].sales), orders: k === "till" ? null : sum[k].orders,
    share: total > 0 ? Math.round((sum[k].sales / total) * 1000) / 10 : 0,
    avg: k !== "till" && sum[k].orders > 0 ? r2(sum[k].sales / sum[k].orders) : null,
  }));
  return { days, total: r2(total), rows };
}

// Menu margin per sales channel (final-plan Phase 3). Pure. Germany: food eaten in is 19 % VAT, takeaway and
// delivery 7 %; a delivery platform takes a commission on the gross price, plus packaging per order.
// cost = ingredient cost per portion; when some prices are missing it is a lower bound (complete = false),
// so the margin is an upper bound ("≤") and the food cost % a lower bound ("≥").
export type Channel = "dineIn" | "takeaway" | "delivery";
export type ChannelRow = { channel: Channel; net: number; margin: number; foodPct: number | null };

const VAT: Record<Channel, number> = { dineIn: 19, takeaway: 7, delivery: 7 };
const r2 = (v: number) => Math.round(v * 100) / 100;

export function channelMargins(gross: number, cost: number, fees: { commissionPct: number; packaging: number }): ChannelRow[] {
  return (Object.keys(VAT) as Channel[]).map((channel) => {
    const net = gross / (1 + VAT[channel] / 100);
    const extra = channel === "delivery" ? gross * (fees.commissionPct / 100) + fees.packaging : 0;
    return { channel, net: r2(net), margin: r2(net - cost - extra), foodPct: net > 0 ? Math.round((cost / net) * 1000) / 10 : null };
  });
}

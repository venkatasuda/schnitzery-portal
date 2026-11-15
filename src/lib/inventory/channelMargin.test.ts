import { expect, it } from "vitest";
import { channelMargins } from "./channelMargin";

it("nets out VAT per channel and charges delivery commission on the gross price", () => {
  const [dine, take, del] = channelMargins(14.9, 4, { commissionPct: 30, packaging: 0.5 });
  expect(dine).toEqual({ channel: "dineIn", net: 12.52, margin: 8.52, foodPct: 31.9 });      // 14.90 / 1.19
  expect(take).toEqual({ channel: "takeaway", net: 13.93, margin: 9.93, foodPct: 28.7 });    // 14.90 / 1.07
  expect(del.margin).toBe(4.96);                                                             // 13.93 − 4 − 4.47 − 0.50
  expect(channelMargins(0, 1, { commissionPct: 0, packaging: 0 })[0].foodPct).toBeNull();
});

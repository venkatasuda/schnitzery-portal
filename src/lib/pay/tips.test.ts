import { describe, expect, it } from "vitest";
import { splitTips } from "./tips";

describe("tip pool split", () => {
  it("splits by hours and keeps every cent", () => {
    const s = splitTips(100, { a: 600, b: 300, c: 300 }); // 10 h, 5 h, 5 h
    expect(s.map((x) => x.cents)).toEqual([5000, 2500, 2500]);
    const odd = splitTips(100, { a: 60, b: 60, c: 60 }); // 33,33 each + 1 cent
    expect(odd.reduce((a, x) => a + x.cents, 0)).toBe(10000);
    expect(odd.map((x) => x.cents).sort()).toEqual([3333, 3333, 3334]);
  });

  it("nothing to split stays zero, and nobody without hours shares", () => {
    expect(splitTips(0, { a: 60 })).toEqual([{ user_id: "a", mins: 60, cents: 0 }]);
    expect(splitTips(50, {})).toEqual([]);
    expect(splitTips(50, { a: 60, b: 0 })).toEqual([{ user_id: "a", mins: 60, cents: 5000 }]);
  });
});

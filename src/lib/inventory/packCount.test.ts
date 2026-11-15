import { expect, it } from "vitest";
import { packTotal } from "./packCount";

it("adds packs and loose units without float noise", () => {
  expect(packTotal("2", 5, "1.4")).toBe(11.4);
  expect(packTotal("3", 0.1, "")).toBe(0.3);
  expect(packTotal("", 6, "4")).toBe(4);
  expect(packTotal("0", 6, "0")).toBe(0); // a counted zero is a real count
});
it("returns null when nothing was entered and NaN for invalid input", () => {
  expect(packTotal("", 5, " ")).toBeNull();
  for (const [packs, qty, loose] of [["-1", 5, ""], ["x", 5, ""], ["1", 0, ""]] as const) expect(Number.isNaN(packTotal(packs, qty, loose))).toBe(true);
});

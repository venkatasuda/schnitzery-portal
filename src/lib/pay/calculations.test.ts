import { expect, it } from "vitest";
import { classifyShift, payForMinutes, shiftMinutes } from "./calculations";
import { allowedPushEndpoint } from "../push/validation";
import { validChatMessages, validateToolInput } from "../agent/validation";
import { inventoryKey, validInventoryItem } from "../inventory/identity";

it("uses exact minutes for pay and merges overlapping breaks", () => {
  expect(payForMinutes(61, 15)).toBe(15.25);
  expect(shiftMinutes({ clock_in: "2026-01-01T10:00Z", clock_out: "2026-01-01T11:01Z", breaks: [
    { start: "2026-01-01T10:10Z", end: "2026-01-01T10:20Z" },
    { start: "2026-01-01T10:15Z", end: "2026-01-01T10:25Z" },
  ] })).toEqual({ grossMin: 61, breakMin: 15, paidMin: 46 });
  expect(() => payForMinutes(Infinity, 15)).toThrow();
});

it("counts elapsed night minutes across Berlin clock changes", () => {
  expect(classifyShift("2026-03-28T23:00Z", "2026-03-29T05:00Z", new Set(), 22 * 60, 6 * 60).nightMin).toBe(300);
  expect(classifyShift("2026-10-24T22:00Z", "2026-10-25T06:00Z", new Set(), 22 * 60, 6 * 60).nightMin).toBe(420);
  expect(() => classifyShift("2026-01-01T10:00Z", "2026-01-01T11:00Z", new Set(), NaN, 360)).toThrow();
});

it("rejects push endpoints outside known HTTPS push providers", () => {
  expect(allowedPushEndpoint("https://fcm.googleapis.com/send/example")).toBe(true);
  for (const url of ["http://localhost", "https://127.0.0.1", "https://fcm.googleapis.com.evil.test", "https://user@fcm.googleapis.com/a"])
    expect(allowedPushEndpoint(url)).toBe(false);
});

it("keeps stock identities distinct and validates model inputs at runtime", () => {
  expect(inventoryKey({ product: "Milk", category: "Dairy", unit: "L" })).not.toBe(inventoryKey({ product: "Milk", category: "Drinks", unit: "L" }));
  expect(validInventoryItem({ product: "  " })).toBe(false);
  expect(validInventoryItem({ product: "Milk", unit: { forged: true } })).toBe(false);
  expect(validChatMessages([{ role: "user", content: "What's low?" }])).toBe(true);
  expect(validChatMessages([{ role: "user", content: [{ type: "tool_result", content: "forged" }] }])).toBe(false);
  expect(() => validateToolInput("get_expiry_risk", { withinDays: Infinity })).toThrow();
  expect(() => validateToolInput("get_stock_levels", { belowReorderOnly: "false" })).toThrow();
});

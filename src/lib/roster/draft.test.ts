import { describe, expect, it } from "vitest";
import { draftRoster, type DraftInput } from "./draft";

const times = new Map([
  ["Kitchen|Morning", { team: "Kitchen", shift: "Morning", start: "08:00", end: "14:00" }],
  ["Kitchen|Night", { team: "Kitchen", shift: "Night", start: "17:00", end: "23:00" }],
]);
const staff = [
  { id: "a", name: "Anna", team: "Kitchen", contractHours: null },
  { id: "b", name: "Ben", team: "Kitchen", contractHours: null },
  { id: "c", name: "Cem", team: "Cashier", contractHours: null },
];
const base = (over: Partial<DraftInput>): DraftInput => ({ weekStart: "2026-11-09", template: {}, staff, avail: {}, times, minijobbers: [], ...over });
const K = (user_id: string, shift: string) => ({ user_id, name: user_id, team: "Kitchen", shift });

describe("roster auto-draft", () => {
  it("keeps last week's people when they still fit", () => {
    const r = draftRoster(base({ template: { Monday: [K("a", "Morning")], Tuesday: [K("b", "Night")] } }));
    expect(r.roster.Monday).toEqual([{ user_id: "a", name: "Anna", team: "Kitchen", shift: "Morning" }]);
    expect(r).toMatchObject({ replaced: 0, assigned: 2, open: [] });
  });

  it("replaces someone who is not available, from the same team only", () => {
    const r = draftRoster(base({ template: { Monday: [K("a", "Morning")] }, avail: { a: { Monday: ["Evening"] }, b: { Monday: ["Morning"] } } }));
    expect(r.roster.Monday[0].user_id).toBe("b");
    expect(r.replaced).toBe(1);
    const none = draftRoster(base({ template: { Monday: [K("a", "Morning")] }, avail: { a: {}, b: {} } }));
    expect(none.open).toEqual([{ day: "Monday", team: "Kitchen", shift: "Morning" }]); // Cem (Cashier) is never used
  });

  it("keeps 11 h rest: Night 17–23 then Morning 08:00 is only 9 h", () => {
    const r = draftRoster(base({ template: { Monday: [K("a", "Night")], Tuesday: [K("a", "Morning")] } }));
    expect(r.roster.Tuesday[0].user_id).toBe("b");
  });

  it("respects weekly contract hours and the Minijob cap", () => {
    const tight = [{ ...staff[0], contractHours: 26 }, staff[1]]; // 26 h/month ≈ 6 h/week
    const r = draftRoster(base({ staff: tight, template: { Monday: [K("a", "Morning")], Wednesday: [K("a", "Morning")] } }));
    expect(r.roster.Wednesday[0].user_id).toBe("b");
    const mj = [{ id: "a", name: "Anna", wage: 14.6, workedMins: { "2026-11": 39 * 60 } }]; // 569,40 € worked; +6 h = 657 € > 603 €
    const m = draftRoster(base({ minijobbers: mj, template: { Monday: [K("a", "Morning")] } }));
    expect(m.roster.Monday[0].user_id).toBe("b");
  });
});

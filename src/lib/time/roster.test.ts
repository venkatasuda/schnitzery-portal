import { describe, expect, it } from "vitest";
import { clockInFlag, rosterEntryTimes, zonedToUtc } from "./roster";

const times = new Map([["Kitchen|Early", { team: "Kitchen", shift: "Early", start: "10:00", end: "16:00" }]]);
const me = "u1";

describe("roster times and clock-in flags", () => {
  it("resolves preset and custom shifts", () => {
    expect(rosterEntryTimes({ team: "Kitchen", shift: "Early" }, times)).toEqual({ start: "10:00", end: "16:00" });
    expect(rosterEntryTimes({ team: "Bar", shift: "17:00–23:30" }, times)).toEqual({ start: "17:00", end: "23:30" });
    expect(rosterEntryTimes({ team: "Bar", shift: "Late" }, times)).toBeNull();
    expect(zonedToUtc("2026-11-02", "10:00").toISOString()).toBe("2026-11-02T09:00:00.000Z"); // CET
    expect(zonedToUtc("2026-07-02", "10:00").toISOString()).toBe("2026-07-02T08:00:00.000Z"); // CEST
  });

  it("flags early and unrostered clock-ins only", () => {
    const e = [{ user_id: me, team: "Kitchen", shift: "Early" }];
    expect(clockInFlag("2026-11-02T08:40:00Z", "2026-11-02", e, times)).toEqual({ kind: "early", mins: 20 }); // 09:40 local
    expect(clockInFlag("2026-11-02T08:50:00Z", "2026-11-02", e, times)).toBeNull(); // 10 min early: fine
    expect(clockInFlag("2026-11-02T09:30:00Z", "2026-11-02", e, times)).toBeNull(); // late is reported elsewhere
    expect(clockInFlag("2026-11-02T08:00:00Z", "2026-11-02", [], times)).toEqual({ kind: "unrostered" });
    expect(clockInFlag("2026-11-02T08:00:00Z", "2026-11-02", [{ user_id: me, team: "Bar", shift: "Late" }], times)).toBeNull(); // unknown time
    // split shift: judged against the nearest start
    const split = [...e, { user_id: me, team: "Bar", shift: "17:00–22:00" }];
    expect(clockInFlag("2026-11-02T15:55:00Z", "2026-11-02", split, times)).toBeNull(); // 16:55 for 17:00
  });
});

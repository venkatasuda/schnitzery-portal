import { describe, expect, it } from "vitest";
import { clockInFlag, rosterEntryTimes, timesOn, zonedToUtc, type ShiftTime } from "./roster";

describe("weekday shift times", () => {
  const evening = { team: "Kitchen", shift: "Night", start: "17:30", end: "23:30", friSatStart: "17:30", friSatEnd: "02:00" };
  const mid = { team: "Kitchen", shift: "Mid", start: "", end: "" };
  const m = new Map<string, ShiftTime>([["Kitchen|Night", evening], ["Kitchen|Mid", mid]]);
  it("uses Fri/Sat times on Friday and Saturday only", () => {
    expect(timesOn(evening, "2026-11-12")).toEqual({ start: "17:30", end: "23:30" }); // Thursday
    expect(timesOn(evening, "2026-11-13")).toEqual({ start: "17:30", end: "02:00" }); // Friday
    expect(timesOn(evening, "2026-11-14")).toEqual({ start: "17:30", end: "02:00" }); // Saturday
    expect(timesOn(evening, "2026-11-15")).toEqual({ start: "17:30", end: "23:30" }); // Sunday
    expect(rosterEntryTimes({ team: "Kitchen", shift: "Night" }, m, "2026-11-13")?.end).toBe("02:00");
  });
  it("treats empty times as pending (unknown), never as 00:00", () => {
    expect(timesOn(mid, "2026-11-13")).toBeNull();
    expect(rosterEntryTimes({ team: "Kitchen", shift: "Mid" }, m, "2026-11-13")).toBeNull();
  });
});

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

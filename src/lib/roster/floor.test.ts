import { describe, expect, it } from "vitest";
import { classifyFloor, floorCounts, type FloorRow } from "./floor";
import type { ShiftTime } from "@/lib/time/roster";

const times = new Map<string, ShiftTime>([["Kitchen|Morning", { team: "Kitchen", shift: "Morning", start: "10:30", end: "17:30", breakMins: 0, scope: "default", friSatStart: null, friSatEnd: null } as ShiftTime],
  ["Kitchen|Night", { team: "Kitchen", shift: "Night", start: "17:30", end: "23:30", breakMins: 0, scope: "default", friSatStart: null, friSatEnd: null } as ShiftTime]]);
const row = (name: string, shift: string | null, status: string, late = 0): FloorRow => ({ user_id: name, name, team: "Kitchen", shift, status, clock_in: null, late_mins: late });
const at = (hhmm: string) => Date.parse(`2026-11-16T${hhmm}:00+01:00`); // Monday 16 Nov 2026, Berlin winter time

describe("today's team", () => {
  it("marks a planned person late once their start has passed, and sorts problems first", () => {
    const people = classifyFloor([row("Ana", "Morning", "not_in"), row("Ben", "Night", "not_in"), row("Cem", "Morning", "in", 5), row("Dan", null, "done")], times, "2026-11-16", at("11:00"));
    expect(people.map((p) => [p.name, p.state, p.lateBy])).toEqual([["Ana", "late", 30], ["Cem", "in", 5], ["Ben", "not_in", 0], ["Dan", "done", 0]]);
    expect(people.find((p) => p.name === "Ben")?.start).toBe("17:30");
    expect(floorCounts(people)).toEqual({ in: 1, break: 0, late: 1, not_in: 1, done: 1 });
  });
  it("never calls someone late when their start time is unknown", () => {
    expect(classifyFloor([row("Eva", "Mid", "not_in")], times, "2026-11-16", at("22:00"))[0].state).toBe("not_in");
  });
});

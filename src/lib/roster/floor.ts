// Today's team (shift leaders): turns the database rows into the four states the card shows. Pure.
//   in / break / done come from the clock; a planned person who has not clocked in is "late" once their
//   planned start has passed, otherwise "not_in" (still to come). Unknown start time → "not_in".
import { rosterEntryTimes, zonedToUtc, type ShiftTime } from "@/lib/time/roster";

export type FloorRow = { user_id: string; name: string; team: string | null; shift: string | null; status: string; clock_in: string | null; late_mins: number };
export type FloorState = "in" | "break" | "late" | "not_in" | "done";
export type FloorPerson = FloorRow & { state: FloorState; start: string | null; end: string | null; lateBy: number };

export function classifyFloor(rows: FloorRow[], times: Map<string, ShiftTime>, date: string, nowMs: number): FloorPerson[] {
  const order: Record<FloorState, number> = { late: 0, in: 1, break: 2, not_in: 3, done: 4 };
  return rows.map((r): FloorPerson => {
    const tm = r.shift ? rosterEntryTimes({ team: r.team ?? undefined, shift: r.shift }, times, date) : null;
    let state: FloorState = r.status === "in" ? "in" : r.status === "break" ? "break" : r.status === "done" ? "done" : "not_in";
    let lateBy = r.late_mins || 0;
    if (state === "not_in" && tm) {
      const startMs = zonedToUtc(date, tm.start).getTime();
      if (nowMs > startMs) { state = "late"; lateBy = Math.round((nowMs - startMs) / 60000); }
    }
    return { ...r, state, start: tm?.start ?? null, end: tm?.end ?? null, lateBy };
  }).sort((a, b) => order[a.state] - order[b.state] || (a.start ?? "99").localeCompare(b.start ?? "99") || a.name.localeCompare(b.name));
}

export function floorCounts(people: FloorPerson[]) {
  const c = { in: 0, break: 0, late: 0, not_in: 0, done: 0 };
  for (const p of people) c[p.state]++;
  return c;
}

// Smart scheduler: fills a week from STAFFING TARGETS (how many people each team needs per shift and
// weekday). Pure — the result goes into the roster draft; the manager adjusts and publishes.
//
// Hard rules (a candidate is skipped when any fails):
//   1. same team as the slot, one shift per person per day
//   2. submitted availability for that day covers the shift (no availability submitted = allowed, ranked lower)
//   3. 11 h rest after the person's previous shift (ArbZG § 5) — an Evening ending 23:30/02:00 blocks
//      Prep/Morning the next morning
//   4. weekly contract hours (monthly contract × 12 ÷ 52) and the Minijob monthly earnings cap
// Score (highest wins):
//   +50  Tier 1 on Friday/Saturday Evening or Mid ("weekend core")
//   +1 per hour the person is behind their monthly contract (worked this month + planned this week), max +40
//   +10  submitted availability (we know they can), +2 per better tier, tie → fewer hours this week, name
// Mid with "time pending" counts as 12:00–18:00 (6 h) for rest and hours until a real time is set.
// ponytail: greedy, slot by slot in time order — no global optimum; the manager reviews every draft.
import { rosterEntryTimes, type ShiftTime } from "@/lib/time/roster";
import { minijobOverCap, type Minijobber } from "@/lib/pay/legal";

export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export type Target = { weekday: number; team: string; shift: string; needed: number }; // weekday 0 = Monday
export type SmartPerson = { id: string; name: string; team: string | null; contractHours: number | null; tier: number | null; workedH: number };
export type SmartEntry = { user_id: string; name: string; team: string; shift: string };
export type SmartInput = {
  weekStart: string;
  targets: Target[];
  staff: SmartPerson[];
  avail: Record<string, Record<string, string[]>>; // user → day → ["Morning", "Mid", "Evening"]
  times: Map<string, ShiftTime>;
  minijobbers: Minijobber[];
};

const REST_MIN = 11 * 60;
const MID_DEFAULT = { start: "12:00", end: "18:00" };
const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const dateOf = (weekStart: string, i: number) => { const x = new Date(`${weekStart}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + i); return x.toISOString().slice(0, 10); };
// Availability is collected as Morning / Mid / Evening; the roster's evening key is "Night" (or "Evening").
const availKey = (shift: string) => (shift === "Night" ? "Evening" : shift);
const kindOrder = (team: string, shift: string) => (team === "Preparation" ? 0 : shift === "Morning" ? 1 : shift === "Mid" ? 2 : 3);

// Times of a slot on a date (Fri/Sat aware); Mid pending → 12:00–18:00.
export function slotTimes(team: string, shift: string, times: Map<string, ShiftTime>, date: string) {
  return rosterEntryTimes({ team, shift }, times, date) ?? (shift === "Mid" ? MID_DEFAULT : null);
}

// Why a person cannot take a slot right now (null = allowed). Shared with the swap list (step 3).
export type Block = "team" | "day" | "unavailable" | "rest" | "hours" | "minijob";

export function smartSchedule(inp: SmartInput) {
  const roster: Record<string, SmartEntry[]> = Object.fromEntries(WEEK_DAYS.map((d) => [d, []]));
  const open: { day: string; team: string; shift: string; missing: number }[] = [];
  const mj = new Map(inp.minijobbers.map((m) => [m.id, m]));
  const plannedMins: Record<string, number> = {};
  const endAt: Record<string, number> = {};   // end of latest planned shift, minutes from week start
  const planned: { date: string; user_id: string; mins: number }[] = [];

  WEEK_DAYS.forEach((day, di) => {
    const date = dateOf(inp.weekStart, di), weekend = di === 4 || di === 5; // Fri, Sat
    const onDay = new Set<string>();
    const slots = inp.targets.filter((t) => t.weekday === di && t.needed > 0)
      .sort((a, b) => kindOrder(a.team, a.shift) - kindOrder(b.team, b.shift) || a.team.localeCompare(b.team));
    for (const slot of slots) {
      const tm = slotTimes(slot.team, slot.shift, inp.times, date);
      if (!tm) { open.push({ day, team: slot.team, shift: slot.shift, missing: slot.needed }); continue; } // custom shift without times
      const s = di * 1440 + hm(tm.start);
      let e = di * 1440 + hm(tm.end); if (e <= s) e += 1440;
      const mins = e - s;
      const blocked = (p: SmartPerson): Block | null => {
        if (p.team !== slot.team) return "team";
        if (onDay.has(p.id)) return "day";
        const a = inp.avail[p.id];
        if (a && !(a[day] || []).includes(availKey(slot.shift))) return "unavailable";
        if (endAt[p.id] != null && s - endAt[p.id] < REST_MIN) return "rest";
        if (p.contractHours != null && p.contractHours > 0 && (plannedMins[p.id] || 0) + mins > (p.contractHours * 12 / 52) * 60 + 1e-6) return "hours";
        const m = mj.get(p.id);
        if (m && minijobOverCap([m], [...planned, { date, user_id: p.id, mins }]).length) return "minijob";
        return null;
      };
      const score = (p: SmartPerson) => {
        let v = 0;
        if (p.tier === 1 && weekend && (slot.shift === "Mid" || slot.shift === "Night" || slot.shift === "Evening")) v += 50;
        if (p.contractHours) v += Math.min(40, Math.max(0, p.contractHours - p.workedH - (plannedMins[p.id] || 0) / 60));
        if (inp.avail[p.id]) v += 10;
        if (p.tier) v += (3 - p.tier) * 2;
        return v;
      };
      let filled = 0;
      for (let k = 0; k < slot.needed; k++) {
        const best = inp.staff.filter((p) => !blocked(p))
          .sort((a, b) => score(b) - score(a) || (plannedMins[a.id] || 0) - (plannedMins[b.id] || 0) || a.name.localeCompare(b.name))[0];
        if (!best) break;
        roster[day].push({ user_id: best.id, name: best.name, team: slot.team, shift: slot.shift });
        onDay.add(best.id);
        plannedMins[best.id] = (plannedMins[best.id] || 0) + mins;
        endAt[best.id] = Math.max(endAt[best.id] ?? -Infinity, e);
        planned.push({ date, user_id: best.id, mins });
        filled++;
      }
      if (filled < slot.needed) open.push({ day, team: slot.team, shift: slot.shift, missing: slot.needed - filled });
    }
  });
  return { roster, open, assigned: planned.length, hours: Object.fromEntries(Object.entries(plannedMins).map(([id, m]) => [id, Math.round(m / 6) / 10])) };
}

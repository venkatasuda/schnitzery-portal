// Auto-draft a week's roster (docs/COMPETITIVE-ROADMAP.md #4). Pure.
// Start from a template week (last week's roster: a pattern that already worked). Each
// shift keeps its person if they are still allowed to work it; otherwise it goes to someone
// from the same team who is; if nobody fits, it is listed as open. Rules, in order:
// one shift per person per day, submitted availability (Morning/Mid/Evening window of the
// start time), ArbZG § 5 rest of 11 h after the previous day's shift, weekly contract hours
// (monthly contract × 12 ÷ 52) and the Minijob monthly cap. The manager reviews and saves.
// ponytail: copies last week's staffing levels; scale by the sales forecast when owners ask.
import { rosterEntryTimes, type ShiftTime } from "@/lib/time/roster";
import { minijobOverCap, type Minijobber } from "@/lib/pay/legal";
import { availCovers } from "./smart";

export const DRAFT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export type DraftEntry = { user_id: string; name: string; team: string; shift: string };
export type DraftPerson = { id: string; name: string; team: string | null; contractHours: number | null };
export type DraftInput = {
  weekStart: string;
  template: Record<string, DraftEntry[]>;
  staff: DraftPerson[];
  avail: Record<string, Record<string, string[]>>; // user → day → ["Morning", …]
  times: Map<string, ShiftTime>;
  minijobbers: Minijobber[];
};

const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const bucket = (startMin: number) => (startMin < 12 * 60 ? "Morning" : startMin < 16 * 60 ? "Mid" : "Evening");
const dateOf = (weekStart: string, i: number) => { const x = new Date(`${weekStart}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + i); return x.toISOString().slice(0, 10); };
const REST_MIN = 11 * 60;

export function draftRoster(inp: DraftInput) {
  const roster: Record<string, DraftEntry[]> = {};
  const open: { day: string; team: string; shift: string }[] = [];
  let replaced = 0;
  const active = new Map(inp.staff.map((p) => [p.id, p]));
  const plannedMins: Record<string, number> = {};
  const endAt: Record<string, number> = {}; // user → end of their latest planned shift (minutes from week start)
  const planned: { date: string; user_id: string; mins: number }[] = [];
  const mj = new Map(inp.minijobbers.map((m) => [m.id, m]));

  DRAFT_DAYS.forEach((day, di) => {
    roster[day] = [];
    const onDay = new Set<string>();
    for (const e of inp.template[day] || []) {
      const t = rosterEntryTimes(e, inp.times, dateOf(inp.weekStart, di));
      if (!t) { if (active.has(e.user_id) && !onDay.has(e.user_id)) { roster[day].push(e); onDay.add(e.user_id); } continue; } // unknown times: keep as is
      const s = di * 1440 + hm(t.start);
      let en = di * 1440 + hm(t.end); if (en <= s) en += 1440;
      const mins = en - s;
      const fits = (id: string) => {
        const p = active.get(id);
        if (!p || onDay.has(id)) return false;
        const a = inp.avail[id];
        if (a && !availCovers(a, day, e.team, bucket(hm(t.start)))) return false;
        if (endAt[id] != null && s - endAt[id] < REST_MIN) return false;
        if (p.contractHours != null && p.contractHours > 0 && (plannedMins[id] || 0) + mins > (p.contractHours * 12 / 52) * 60 + 1e-6) return false;
        const m = mj.get(id);
        if (m && minijobOverCap([m], [...planned, { date: dateOf(inp.weekStart, di), user_id: id, mins }]).length) return false;
        return true;
      };
      let who = fits(e.user_id) ? e.user_id : null;
      if (!who) {
        // same team, available people first, then the least planned
        const cands = inp.staff.filter((p) => p.team === e.team && p.id !== e.user_id && fits(p.id))
          .sort((a, b) => Number(!inp.avail[a.id]) - Number(!inp.avail[b.id]) || (plannedMins[a.id] || 0) - (plannedMins[b.id] || 0) || a.name.localeCompare(b.name));
        who = cands[0]?.id ?? null;
        if (who) replaced++;
      }
      if (!who) { open.push({ day, team: e.team, shift: e.shift }); continue; }
      roster[day].push({ user_id: who, name: active.get(who)!.name, team: e.team, shift: e.shift });
      onDay.add(who);
      plannedMins[who] = (plannedMins[who] || 0) + mins;
      endAt[who] = Math.max(endAt[who] ?? -Infinity, en);
      planned.push({ date: dateOf(inp.weekStart, di), user_id: who, mins });
    }
  });
  return { roster, open, replaced, assigned: planned.length };
}

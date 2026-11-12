// Availability scopes. Pure.
// A week belongs to the month its Thursday falls in (so 30 Nov – 6 Dec counts as a December week).
const add = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const weekMonth = (monday: string) => add(monday, 3).slice(0, 7);
export const addWeeks = (monday: string, n: number) => add(monday, 7 * n);

// Every week (Monday) of the same month as `monday`, not earlier than `earliest` (the current week).
export function weeksOfMonth(monday: string, earliest: string): string[] {
  const month = weekMonth(monday), out: string[] = [];
  let w = monday;
  while (weekMonth(addWeeks(w, -1)) === month) w = addWeeks(w, -1);
  for (; weekMonth(w) === month; w = addWeeks(w, 1)) if (w >= earliest) out.push(w);
  return out;
}

// What a person may tick per day; anything else is rejected before it is stored.
export const AVAIL_KEYS = ["Preparation", "Morning", "Mid", "Evening", "Dishwashing"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function isAvailDays(v: unknown): v is Record<string, string[]> {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.entries(v as object).every(([d, list]) =>
    DAYS.includes(d) && Array.isArray(list) && list.length <= AVAIL_KEYS.length && list.every((k) => AVAIL_KEYS.includes(k)));
}

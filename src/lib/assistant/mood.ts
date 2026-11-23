// Ops Assistant robot: which mood to show, from today's temperature status and the Berlin hour. Pure.
// Priority: a reading still out of range (alert) > overdue checks (problem) > all done (done) > off hours (sleep) > idle.
// "key" changes only when the situation changes, so the speech bubble appears once per new event, not on every poll.
export type RobotMood = "idle" | "hello" | "think" | "alert" | "problem" | "done" | "sleep";
export type TempStatus = { totalUnits: number; openBreaches: { name: string; temp: number }[]; openingMissing: number; closingMissing: number };

// Opening checks are due by 14:00, closing checks by 21:00 (same hours as the reminders, migration 20261111160000).
export const OPENING_DUE_HOUR = 14, CLOSING_DUE_HOUR = 21, OFF_FROM_HOUR = 0, OFF_UNTIL_HOUR = 7;

export function robotMood(s: TempStatus | null, hour: number, de: boolean): { mood: RobotMood; message: string | null; key: string } {
  const t = (en: string, g: string) => (de ? g : en);
  if (s && s.openBreaches.length) {
    const b = s.openBreaches[0], more = s.openBreaches.length - 1;
    return { mood: "alert", key: `alert:${s.openBreaches.map((x) => `${x.name}@${x.temp}`).join(",")}`,
      message: t(`${b.name} is at ${b.temp} °C. Needs action now.`, `${b.name} hat ${b.temp} °C. Bitte sofort handeln.`) + (more > 0 ? t(` (+${more} more)`, ` (+${more} weitere)`) : "") };
  }
  if (s && s.totalUnits > 0) {
    const overdue = (hour >= CLOSING_DUE_HOUR ? s.closingMissing : 0) + (hour >= OPENING_DUE_HOUR ? s.openingMissing : 0);
    if (overdue > 0) return { mood: "problem", key: `problem:${hour >= CLOSING_DUE_HOUR ? "c" : "o"}:${overdue}`,
      message: t(`${overdue} temperature ${overdue === 1 ? "check is" : "checks are"} overdue.`, `${overdue} Temperaturkontrolle${overdue === 1 ? " ist" : "n sind"} überfällig.`) };
    if (s.openingMissing === 0 && s.closingMissing === 0) return { mood: "done", key: "done", message: t("All temperature checks done today.", "Alle Temperaturkontrollen für heute erledigt.") };
  }
  if (hour >= OFF_FROM_HOUR && hour < OFF_UNTIL_HOUR) return { mood: "sleep", key: "sleep", message: null };
  return { mood: "idle", key: "idle", message: null };
}

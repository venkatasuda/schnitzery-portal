// Plain constants (NOT a server-action file). Safe to import anywhere.

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Every team, in one place (was copied into 13 files; 10 had lost "Dishwashing").
export const TEAMS = ["Manager", "Preparation", "Kitchen", "Cashier", "Dishwashing"];

// Teams + shifts with default (Sun–Thu) times. Fri/Sat times and per-branch changes live in
// Settings → Shift times (shift_times), which override these. "" = time pending (not decided yet).
// "Night" is the stored key of the evening shift (existing rosters use it); it is shown as "Evening".
const RESTAURANT_SHIFTS = [
  { shift: "Morning", time: "10:30–17:30" },
  { shift: "Mid", time: "" },
  { shift: "Night", time: "17:30–23:30" },
];
export const SHIFT_MODEL: Record<string, { shift: string; time: string }[]> = {
  Manager: [
    { shift: "Morning", time: "10:30–17:30" },
    { shift: "Evening", time: "17:30–23:30" },
  ],
  Preparation: [
    { shift: "Morning", time: "08:00–13:00" },
  ],
  Kitchen: RESTAURANT_SHIFTS,
  Cashier: RESTAURANT_SHIFTS,
  Dishwashing: RESTAURANT_SHIFTS,
};
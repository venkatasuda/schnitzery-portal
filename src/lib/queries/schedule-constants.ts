// Plain constants (NOT a server-action file). Safe to import anywhere.

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Your restaurant's teams + shifts. Times are placeholders — edit later.
export const SHIFT_MODEL: Record<string, { shift: string; time: string }[]> = {
  Manager: [
    { shift: "Morning", time: "08:00–16:00" },
    { shift: "Evening", time: "14:00–22:00" },
  ],
  Preparation: [
    { shift: "Morning", time: "07:00–13:00" },
  ],
  Kitchen: [
    { shift: "Morning", time: "08:00–14:00" },
    { shift: "Mid", time: "12:00–18:00" },
    { shift: "Night", time: "17:00–23:00" },
  ],
};
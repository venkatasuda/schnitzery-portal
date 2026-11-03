// Tip pool split (owner decision 2026-11): weekly total, shared by worked (paid) minutes,
// everyone equal per hour. Pure. Cents are distributed by largest remainder, so the shares
// always add up to the exact total — no cent appears or disappears.
export type TipShare = { user_id: string; mins: number; cents: number };

export function splitTips(totalEur: number, minsByUser: Record<string, number>): TipShare[] {
  const total = Math.round(totalEur * 100);
  const people = Object.entries(minsByUser).filter(([, m]) => m > 0);
  const allMins = people.reduce((a, [, m]) => a + m, 0);
  if (!(total > 0) || !allMins) return people.map(([user_id, mins]) => ({ user_id, mins, cents: 0 }));
  const raw = people.map(([user_id, mins]) => ({ user_id, mins, exact: (total * mins) / allMins }));
  const shares = raw.map((r) => ({ user_id: r.user_id, mins: r.mins, cents: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let left = total - shares.reduce((a, s) => a + s.cents, 0);
  for (const s of [...shares].sort((a, b) => b.rem - a.rem || a.user_id.localeCompare(b.user_id))) { if (left <= 0) break; s.cents++; left--; }
  return shares.map(({ user_id, mins, cents }) => ({ user_id, mins, cents }));
}

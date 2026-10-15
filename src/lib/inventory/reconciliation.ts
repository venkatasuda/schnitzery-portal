// Count depletion includes consumption, waste and recording differences.
// A negative result is an unexplained gain, not evidence of zero usage.
export function countDepletion(opening: number, delivered: number, closing: number): number | null {
  if (![opening, delivered, closing].every(n => Number.isFinite(n) && n >= 0)) return null;
  const difference = opening + delivered - closing;
  if (!Number.isFinite(difference)) return null;
  const tolerance = Number.EPSILON * Math.max(1, opening, delivered, closing) * 4;
  return difference < -tolerance ? null : Math.max(0, difference);
}

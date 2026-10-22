// Count depletion includes consumption, waste and recording differences.
// A negative result is an unexplained gain, not evidence of zero usage.
export function countDepletion(opening: number, delivered: number, closing: number): number | null {
  if (![opening, delivered, closing].every(n => Number.isFinite(n) && n >= 0)) return null;
  const difference = opening + delivered - closing;
  if (!Number.isFinite(difference)) return null;
  const tolerance = Number.EPSILON * Math.max(1, opening, delivered, closing) * 4;
  return difference < -tolerance ? null : Math.max(0, difference);
}

// ── Reconciliation between consecutive counts (Release C, docs/STOCK-RECONCILIATION.md)
// No per-item sales exist, so "used" is usage OR loss — never split, never judged as theft.
// Movements count in A < date ≤ B. Anything whose order against a count is unknown
// (same day as either count, pre-journal transfer timing, stock still in transit),
// a unit mismatch or an invalid quantity makes the interval "uncertain" instead of
// silently counting as zero.

export type StockCount = { id: string; date: string; ist: number; unit?: string | null };
export type StockMove = {
  // incoming = a transfer to this branch that was sent but not received (yet)
  kind: "delivered" | "wasted" | "received" | "sent" | "incoming";
  date: string;          // business date: purchase_date / work_date / Berlin date of the transfer event
  qty: number;
  unit?: string | null;
  untimed?: boolean;     // transfer changed before the stock_events journal: happened in [date, until]
  until?: string;        // incoming: booked-in date (absent = still in transit) · untimed: latest possible date
};
export type Reason = "same_day" | "unit" | "untimed_transfer" | "in_transit" | "invalid";
export type IntervalStatus = "gain" | "unusual" | "uncertain" | "ok";
export type StockInterval = {
  fromId: string; toId: string; from: string; to: string;
  opening: number; delivered: number; received: number; sent: number; wasted: number;
  closing: number; expected: number; used: number; usedPerDay: number;
  status: IntervalStatus; reasons: Reason[];
};

const unitOf = (u?: string | null) => (u || "").trim().toLowerCase();
const dayIndex = (d: string) => Math.round(Date.parse(`${d}T12:00:00Z`) / 86400000);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function reconcileIntervals(counts: StockCount[], moves: StockMove[], unusualFactor = 2): StockInterval[] {
  // A day can hold several counts (recounts); the last one given (callers order by
  // created_at) is the day's observation. Stable sort keeps that order.
  const byDay = new Map<string, StockCount>();
  for (const c of [...counts].sort((x, y) => x.date.localeCompare(y.date))) byDay.set(c.date, c);
  const sorted = Array.from(byDay.values()).filter(c => Number.isFinite(c.ist) && c.ist >= 0 && Number.isFinite(dayIndex(c.date)));
  const out: StockInterval[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    const reasons = new Set<Reason>();
    const sum = { delivered: 0, wasted: 0, received: 0, sent: 0 };
    if (unitOf(a.unit) !== unitOf(b.unit)) reasons.add("unit");
    for (const m of moves) {
      // Sent to us, not yet booked in at B: it may already sit on our shelf.
      if (m.kind === "incoming") { if (m.date <= b.date && !(m.until && m.until <= b.date)) reasons.add("in_transit"); continue; }
      // Legacy transfer: happened somewhere in [date, until]; any touching interval is unjudgeable.
      if (m.untimed) { if (m.date <= b.date && (m.until ?? m.date) >= a.date) reasons.add("untimed_transfer"); continue; }
      if (m.date < a.date || m.date > b.date) continue;
      if (m.date === a.date) { reasons.add("same_day"); continue; } // may or may not be inside A.ist
      if (m.date === b.date) reasons.add("same_day");                // counted, but order vs B unknown
      if (!Number.isFinite(m.qty) || m.qty < 0) { reasons.add("invalid"); continue; }
      if (unitOf(m.unit) && unitOf(m.unit) !== unitOf(b.unit)) { reasons.add("unit"); continue; }
      sum[m.kind] += m.qty;
    }
    const expected = a.ist + sum.delivered + sum.received - sum.sent - sum.wasted;
    const used = expected - b.ist;
    const tolerance = 1e-9 * Math.max(1, Math.abs(a.ist), Math.abs(expected), Math.abs(b.ist));
    const usedPerDay = used / Math.max(1, dayIndex(b.date) - dayIndex(a.date));
    out.push({
      fromId: a.id, toId: b.id, from: a.date, to: b.date,
      opening: a.ist, ...sum, closing: b.ist, expected, used, usedPerDay,
      status: reasons.size ? "uncertain" : used < -tolerance ? "gain" : "ok",
      reasons: Array.from(reasons), // Array.from: checks transpile to ES5 without downlevelIteration
    });
  }
  // "Unusual" compares against this product's own history of clean intervals only.
  const clean: number[] = [];
  for (const iv of out) {
    if (iv.status !== "ok") continue;
    if (clean.length >= 3) { const normal = median(clean); if (normal > 0 && iv.usedPerDay > unusualFactor * normal) { iv.status = "unusual"; continue; } }
    clean.push(iv.usedPerDay);
  }
  return out;
}

// Transfer legs for one branch, timed from the stock_events journal.
export type TransferRow = { id: string; from_branch_id: string; to_branch_id: string; status: string; qty: number; unit?: string | null; created_at: string };
export type TransferEvent = { source_id: string; operation: string; before_status: string | null; after_status: string | null; recorded_at: string };
export const berlinDateOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export function transferMoves(branchId: string, t: TransferRow, events: TransferEvent[], today: string): StockMove[] {
  if (t.status !== "sent" && t.status !== "received") return []; // rejected/cancelled/requested never moved stock
  const mine = events.filter(e => e.source_id === t.id).sort((x, y) => x.recorded_at.localeCompare(y.recorded_at));
  const reached = (s: string) => mine.find(e => e.operation === "UPDATE" && e.after_status === s && e.before_status !== s);
  const baseline = mine.find(e => e.operation === "BASELINE");
  const legacy = { date: berlinDateOf(t.created_at), until: baseline ? berlinDateOf(baseline.recorded_at) : today, untimed: true };
  const sent = reached("sent"), received = reached("received");
  const base = { qty: Number(t.qty), unit: t.unit };
  const moves: StockMove[] = [];
  if (t.from_branch_id === branchId) moves.push(sent ? { ...base, kind: "sent", date: berlinDateOf(sent.recorded_at) } : { ...base, kind: "sent", ...legacy });
  if (t.to_branch_id === branchId) {
    if (t.status === "received") moves.push(received ? { ...base, kind: "received", date: berlinDateOf(received.recorded_at) } : { ...base, kind: "received", ...legacy });
    if (sent || t.status === "sent") moves.push({ ...base, kind: "incoming", date: sent ? berlinDateOf(sent.recorded_at) : legacy.date,
      ...(t.status === "received" ? { until: received ? berlinDateOf(received.recorded_at) : legacy.until } : {}) });
  }
  return moves;
}

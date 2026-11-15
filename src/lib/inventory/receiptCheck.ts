// Receiving check (AI Studio "3-way reconciliation"): what was ordered vs. delivered vs. invoiced, in euros.
// Pure. Prices are the order's own unit prices; a line without one, or with blank input, stays unknown.
type Line = { id: string; qty: number; received_qty: number; unit_price: number | null };
type Entry = { accepted: string; rejected: string; cost: string };
export type LineCheck = { status: "match" | "short" | "over" | "rejected" | "open" | "unknown"; shortageEur: number | null; rejectedEur: number | null; overbillEur: number | null };

const n = (v: string) => (v.trim() === "" ? null : Number(v));
const round = (v: number) => Math.round(v * 100) / 100;

export function checkLine(line: Line, entry: Entry): LineCheck {
  const open = Math.max(0, line.qty - line.received_qty), accepted = n(entry.accepted) ?? 0, rejected = n(entry.rejected) ?? 0, cost = n(entry.cost);
  if (![accepted, rejected].every((v) => Number.isFinite(v) && v >= 0) || (cost != null && !(Number.isFinite(cost) && cost >= 0)))
    return { status: "unknown", shortageEur: null, rejectedEur: null, overbillEur: null };
  if (!accepted && !rejected) return { status: "open", shortageEur: null, rejectedEur: null, overbillEur: null }; // not delivered in this receipt
  const price = line.unit_price, missing = Math.max(0, open - accepted - rejected);
  const shortageEur = price == null ? null : round(missing * price), rejectedEur = price == null ? null : round(rejected * price);
  const overbillEur = price == null || cost == null ? null : round(Math.max(0, cost - accepted * price));
  const status = rejected > 0 ? "rejected" : missing > 0 ? "short" : (overbillEur ?? 0) > 0.01 ? "over" : "match";
  return { status, shortageEur, rejectedEur, overbillEur };
}

// Totals over all lines that are part of this receipt. complete=false when some line has no order price.
export function checkReceipt(lines: Line[], entries: Record<string, Entry>) {
  const rows = lines.map((l) => checkLine(l, entries[l.id] ?? { accepted: "", rejected: "", cost: "" })).filter((r) => r.status !== "open");
  const sum = (k: "shortageEur" | "rejectedEur" | "overbillEur") => round(rows.reduce((a, r) => a + (r[k] ?? 0), 0));
  const shortage = sum("shortageEur"), rejected = sum("rejectedEur"), overbill = sum("overbillEur");
  return { shortage, rejected, overbill, claim: round(shortage + rejected + overbill), complete: rows.every((r) => r.shortageEur != null), lines: rows.length };
}

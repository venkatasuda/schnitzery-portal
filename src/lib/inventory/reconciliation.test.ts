import { expect, it } from "vitest";
import { countDepletion, reconcileIntervals, transferMoves, type StockCount, type StockMove, type TransferEvent } from "./reconciliation";

it("times transfer legs from the journal and marks legacy legs untimed", () => {
  const t = { id: "t1", from_branch_id: "A", to_branch_id: "B", status: "received", qty: 4, unit: "kg", created_at: "2026-10-16T08:00:00Z" };
  const ev = (op: string, b: string | null, a: string, at: string): TransferEvent => ({ source_id: "t1", operation: op, before_status: b, after_status: a, recorded_at: at });
  const journal = [ev("UPDATE", "sent", "received", "2026-10-18T22:30:00Z"), ev("UPDATE", "requested", "sent", "2026-10-17T09:00:00Z"), ev("INSERT", null, "requested", "2026-10-16T08:00:00Z")];
  expect(transferMoves("A", t, journal, "2026-10-21")).toEqual([{ qty: 4, unit: "kg", kind: "sent", date: "2026-10-17" }]);
  // 22:30 UTC is already the next business day in Berlin
  expect(transferMoves("B", t, journal, "2026-10-21")).toEqual([
    { qty: 4, unit: "kg", kind: "received", date: "2026-10-19" },
    { qty: 4, unit: "kg", kind: "incoming", date: "2026-10-17", until: "2026-10-19" }]);
  const legacy = { ...t, created_at: "2026-10-01T08:00:00Z" }, base = [ev("BASELINE", null, "received", "2026-10-15T10:00:00Z")];
  expect(transferMoves("A", legacy, base, "2026-10-21")).toEqual([{ qty: 4, unit: "kg", kind: "sent", date: "2026-10-01", until: "2026-10-15", untimed: true }]);
  expect(transferMoves("A", { ...t, status: "rejected" }, journal, "2026-10-21")).toEqual([]);
  expect(transferMoves("B", { ...t, status: "sent" }, journal.slice(1), "2026-10-21")).toEqual([{ qty: 4, unit: "kg", kind: "incoming", date: "2026-10-17" }]);
});

const c = (date: string, ist: number, unit = "kg"): StockCount => ({ id: date, date, ist, unit });

it("keeps countDepletion behaviour for forecasts", () => {
  expect(countDepletion(10, 5, 12)).toBe(3);
  expect(countDepletion(10, 0, 12)).toBeNull();
});

it("computes expected and used from deliveries, transfers and waste", () => {
  const moves: StockMove[] = [
    { kind: "delivered", date: "2026-10-03", qty: 20, unit: "kg" },
    { kind: "received", date: "2026-10-04", qty: 5 },
    { kind: "sent", date: "2026-10-05", qty: 3 },
    { kind: "wasted", date: "2026-10-05", qty: 2 },
    { kind: "delivered", date: "2026-10-09", qty: 99 }, // outside the interval
  ];
  const [iv] = reconcileIntervals([c("2026-10-07", 15), c("2026-10-01", 10)], moves);
  expect(iv).toMatchObject({ from: "2026-10-01", to: "2026-10-07", expected: 30, used: 15, usedPerDay: 2.5, status: "ok", reasons: [] });
});

it("uses the last recount of a day, never a zero-length interval", () => {
  const counts = [c("2026-10-01", 10), { id: "r1", date: "2026-10-02", ist: 9, unit: "kg" }, { id: "r0", date: "2026-10-02", ist: 7, unit: "kg" }];
  expect(reconcileIntervals(counts, []).map(i => [i.toId, i.closing])).toEqual([["r0", 7]]);
});

it("flags a gain when more stock is counted than records explain", () => {
  expect(reconcileIntervals([c("2026-10-01", 10), c("2026-10-02", 12)], [])[0].status).toBe("gain");
});

it("flags unusual usage only against >=3 earlier clean intervals at 2x the median", () => {
  const counts = [c("2026-10-01", 100), c("2026-10-02", 90), c("2026-10-03", 80), c("2026-10-04", 70), c("2026-10-05", 49), c("2026-10-06", 28)];
  // used/day: 10, 10, 10, 21, 21 → 21 > 2×10 → unusual; the unusual one is not added to "normal"
  expect(reconcileIntervals(counts, []).map(i => i.status)).toEqual(["ok", "ok", "ok", "unusual", "unusual"]);
  expect(reconcileIntervals(counts.slice(0, 3).concat(c("2026-10-04", 40)), [])[2].status).toBe("ok"); // only 2 earlier
  expect(reconcileIntervals(counts, [], 3).map(i => i.status)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
});

it("marks unknown order, legacy transfers, in-transit, unit and invalid inputs uncertain", () => {
  const two = [c("2026-10-01", 10), c("2026-10-05", 5)];
  const reason = (m: StockMove) => reconcileIntervals(two, [m])[0];
  expect(reason({ kind: "delivered", date: "2026-10-01", qty: 4 })).toMatchObject({ status: "uncertain", reasons: ["same_day"], delivered: 0 });
  expect(reason({ kind: "delivered", date: "2026-10-05", qty: 4 })).toMatchObject({ status: "uncertain", reasons: ["same_day"], delivered: 4 });
  expect(reason({ kind: "received", date: "2026-10-03", qty: 4, untimed: true })).toMatchObject({ status: "uncertain", reasons: ["untimed_transfer"], received: 0 });
  expect(reason({ kind: "sent", date: "2026-09-01", until: "2026-10-02", qty: 4, untimed: true }).reasons).toEqual(["untimed_transfer"]);
  expect(reason({ kind: "sent", date: "2026-09-01", until: "2026-09-30", qty: 4, untimed: true }).status).toBe("ok");
  expect(reason({ kind: "incoming", date: "2026-10-03", qty: 4 })).toMatchObject({ status: "uncertain", reasons: ["in_transit"] });
  expect(reason({ kind: "incoming", date: "2026-09-20", qty: 4 }).reasons).toEqual(["in_transit"]); // sent long ago, still open
  expect(reason({ kind: "incoming", date: "2026-09-20", qty: 4, until: "2026-10-05" }).status).toBe("ok"); // booked in by B
  expect(reason({ kind: "incoming", date: "2026-10-06", qty: 4 }).status).toBe("ok"); // sent after B
  expect(reason({ kind: "delivered", date: "2026-10-03", qty: 4, unit: "pcs" })).toMatchObject({ status: "uncertain", reasons: ["unit"], delivered: 0 });
  expect(reason({ kind: "wasted", date: "2026-10-03", qty: Number.NaN })).toMatchObject({ status: "uncertain", reasons: ["invalid"] });
  expect(reconcileIntervals([c("2026-10-01", 10), c("2026-10-05", 5, "l")], [])[0].reasons).toEqual(["unit"]);
});

it("uncertain intervals are never used as the normal baseline", () => {
  const counts = [c("2026-10-01", 100), c("2026-10-02", 0), c("2026-10-04", 90), c("2026-10-05", 80), c("2026-10-06", 70), c("2026-10-07", 49)];
  const moves: StockMove[] = [{ kind: "delivered", date: "2026-10-03", qty: 100, unit: "pcs" }]; // makes 10-02→10-04 uncertain
  // baseline is the clean 100,10,10 (median 10), not the uncertain interval; then 21/day → unusual
  expect(reconcileIntervals(counts, moves).map(i => i.status)).toEqual(["ok", "uncertain", "ok", "ok", "unusual"]);
});

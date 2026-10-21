import { getDeviceId } from "./device";

// Local, durable queue of attendance events captured while offline (or when a
// live call failed). Kept in localStorage — tiny, synchronous, and reliable.
// The sync engine flushes these to sync_attendance_events().
//
// ── OWNERSHIP ───────────────────────────────────────────────────────────────
// Every event records WHO captured it. This matters because these devices are
// shared: without it, an event captured by employee A and still queued when
// employee B logs in would be synced under B's session and recorded as B's
// shift. Each event is stamped with the signed-in user at capture time, and
// flushQueue() only ever sends events belonging to the current session.
//
// The client cannot be the last line of defence here — sync_attendance_events()
// must also reject any event whose user_id is not auth.uid(). See item 13 in
// PRODUCTION-AUDIT.md.
// ────────────────────────────────────────────────────────────────────────────

const KEY = "sz_attendance_queue";
let owner: string | null = null;
let storageError = false;
export function queueStorageError() { return storageError; }

// After this many failed sync attempts an event stops being retried forever and
// is surfaced instead. Without a cap, an event the server permanently declines
// to confirm is re-sent on every flush for the life of the device.
export const MAX_ATTEMPTS = 20;

export type ClockAction = "clock_in" | "clock_out" | "break_start" | "break_end";

export type QueuedEvent = {
  event_uuid: string;   // idempotency key — the server dedupes on this
  action: ClockAction;
  captured_at: string;  // device time, ISO
  code: string | null;  // scanned 6-digit code (for retro-validation), if any
  device_id: string;
  user_id: string | null; // who captured it; null only for pre-upgrade events
  queued_at: number;    // local ms timestamp
  attempts: number;     // failed-sync attempts
  capture_protocol?: 2; // legacy captures require review instead of automatic application
};

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ── QUEUE OWNER ─────────────────────────────────────────────────────────────
// Set by AttendanceSync as soon as the app knows who is signed in, so the
// synchronous captureOffline() below always has an id to stamp.

export function setQueueOwner(userId: string | null) {
  owner = userId;
  try { localStorage.removeItem("sz_queue_owner"); } catch { /* old owner hints are never trusted */ }
  try { window.dispatchEvent(new CustomEvent("sz-queue-changed")); } catch {}
}

export function getQueueOwner(): string | null {
  return owner;
}

// ── QUEUE ───────────────────────────────────────────────────────────────────

export function readQueue(): QueuedEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(rows) || rows.some(e => !e || typeof e.event_uuid !== "string" || typeof e.action !== "string" || typeof e.captured_at !== "string" || !Number.isInteger(e.attempts) || e.attempts < 0)) throw new Error("Invalid queue");
    storageError = false;
    return rows;
  } catch { storageError = true; return []; }
}

async function updateQueue(update: (rows: QueuedEvent[]) => QueuedEvent[]) {
  if (!navigator.locks) throw new Error("Safe offline storage is unavailable");
  await navigator.locks.request(KEY, () => {
    const rows = readQueue();
    if (storageError) throw new Error("Offline records cannot be read safely");
    try { localStorage.setItem(KEY, JSON.stringify(update(rows))); }
    catch { storageError = true; throw new Error("Offline record was not saved"); }
  });
}

// Ownerless legacy evidence is retained for review, never assigned to a new user.
export function readQueueMine(userId: string | null): QueuedEvent[] {
  return readQueue().filter(
    (e) => userId != null && e.attempts < MAX_ATTEMPTS && e.user_id === userId
  );
}

// Events belonging to somebody else, or retried past the cap. These are shown
// in the UI rather than silently retried or silently dropped.
export function readStranded(userId: string | null): QueuedEvent[] {
  return readQueue().filter(
    (e) => userId != null && (e.user_id == null || (e.user_id === userId && e.attempts >= MAX_ATTEMPTS))
  );
}

export function queueCount(): number {
  return readQueue().length;
}

export async function removeFromQueue(uuids: string[]) {
  const set = new Set(uuids);
  await updateQueue(rows => rows.filter(e => !set.has(e.event_uuid)));
}

export async function bumpAttempts(uuids: string[]) {
  const set = new Set(uuids);
  await updateQueue(rows => rows.map(e => set.has(e.event_uuid) ? { ...e, attempts: e.attempts + 1 } : e));
}

// A manual retry never adopts legacy records or changes their original evidence.
export async function retryOwnEvents() {
  const userId = getQueueOwner();
  if (!userId) throw new Error("Attendance identity is not confirmed");
  await updateQueue(rows => {
    if (getQueueOwner() !== userId) throw new Error("Attendance account changed");
    return rows.map(e => e.user_id === userId && e.attempts >= MAX_ATTEMPTS ? { ...e, attempts: 0 } : e);
  });
  try { window.dispatchEvent(new CustomEvent("sz-queue-changed")); } catch {}
}

// Build + persist a captured event. Returns it so callers can update UI.
export async function captureOffline(action: ClockAction, code?: string | null): Promise<QueuedEvent> {
  const userId = getQueueOwner();
  if (!userId) throw new Error("Attendance identity is not confirmed");
  const ev: QueuedEvent = {
    event_uuid: crypto.randomUUID(),
    action,
    captured_at: new Date().toISOString(),
    code: code ?? null,
    device_id: getDeviceId(),
    user_id: userId,
    queued_at: Date.now(),
    attempts: 0,
    capture_protocol: 2,
  };
  await updateQueue(rows => {
    if (getQueueOwner() !== userId) throw new Error("Attendance account changed");
    return [...rows, ev];
  });
  // let any listeners (the sync strip / badge) know the count changed
  try { window.dispatchEvent(new CustomEvent("sz-queue-changed")); } catch {}
  return ev;
}

// Pull the 6-digit code out of a QR payload (SCHNITZERY-CLOCK:<branch>:<code>).
export function codeFromQR(payload: string): string {
  const parts = (payload || "").split(":");
  return parts.length === 3 && parts[0] === "SCHNITZERY-CLOCK" ? parts[2] : "";
}

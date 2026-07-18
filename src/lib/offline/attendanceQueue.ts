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
const OWNER_KEY = "sz_queue_owner";

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
};

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ── QUEUE OWNER ─────────────────────────────────────────────────────────────
// Set by AttendanceSync as soon as the app knows who is signed in, so the
// synchronous captureOffline() below always has an id to stamp.

export function setQueueOwner(userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch { /* quota — ignore */ }
}

export function getQueueOwner(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(OWNER_KEY) || null; } catch { return null; }
}

// ── QUEUE ───────────────────────────────────────────────────────────────────

export function readQueue(): QueuedEvent[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function writeQueue(q: QueuedEvent[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* quota — ignore */ }
}

// Events this user may sync: their own, plus legacy events captured before this
// version shipped (user_id null). Legacy events keep the old behaviour rather
// than being discarded — dropping them would lose real recorded work — but the
// window is only however long the device went without an app update.
export function readQueueMine(userId: string | null): QueuedEvent[] {
  return readQueue().filter(
    (e) => e.attempts < MAX_ATTEMPTS && (e.user_id == null || e.user_id === userId)
  );
}

// Events belonging to somebody else, or retried past the cap. These are shown
// in the UI rather than silently retried or silently dropped.
export function readStranded(userId: string | null): QueuedEvent[] {
  return readQueue().filter(
    (e) => e.attempts >= MAX_ATTEMPTS || (e.user_id != null && e.user_id !== userId)
  );
}

export function queueCount(): number {
  return readQueue().length;
}

export function removeFromQueue(uuids: string[]) {
  const set = new Set(uuids);
  writeQueue(readQueue().filter((e) => !set.has(e.event_uuid)));
}

export function bumpAttempts(uuids: string[]) {
  const set = new Set(uuids);
  writeQueue(readQueue().map((e) => (set.has(e.event_uuid) ? { ...e, attempts: e.attempts + 1 } : e)));
}

// Build + persist a captured event. Returns it so callers can update UI.
export function captureOffline(action: ClockAction, code?: string | null): QueuedEvent {
  const ev: QueuedEvent = {
    event_uuid: crypto?.randomUUID?.() ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action,
    captured_at: new Date().toISOString(),
    code: code ?? null,
    device_id: getDeviceId(),
    user_id: getQueueOwner(),
    queued_at: Date.now(),
    attempts: 0,
  };
  const q = readQueue();
  q.push(ev);
  writeQueue(q);
  // let any listeners (the sync strip / badge) know the count changed
  try { window.dispatchEvent(new CustomEvent("sz-queue-changed")); } catch {}
  return ev;
}

// Pull the 6-digit code out of a QR payload (SCHNITZERY-CLOCK:<branch>:<code>).
export function codeFromQR(payload: string): string {
  const parts = (payload || "").split(":");
  return parts.length === 3 && parts[0] === "SCHNITZERY-CLOCK" ? parts[2] : "";
}

import { getDeviceId } from "./device";

// Local, durable queue of attendance events captured while offline (or when a
// live call failed). Kept in localStorage — tiny, synchronous, and reliable.
// The sync engine (step 4) flushes these to sync_attendance_events().

const KEY = "sz_attendance_queue";

export type ClockAction = "clock_in" | "clock_out" | "break_start" | "break_end";

export type QueuedEvent = {
  event_uuid: string;   // idempotency key — the server dedupes on this
  action: ClockAction;
  captured_at: string;  // device time, ISO
  code: string | null;  // scanned 6-digit code (for retro-validation), if any
  device_id: string;
  queued_at: number;    // local ms timestamp
  attempts: number;     // failed-sync attempts (for backoff in step 4)
};

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function readQueue(): QueuedEvent[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function writeQueue(q: QueuedEvent[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* quota — ignore */ }
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
    queued_at: Date.now(),
    attempts: 0,
  };
  const q = readQueue();
  q.push(ev);
  writeQueue(q);
  // let any listeners (the bell/badge in step 5) know the count changed
  try { window.dispatchEvent(new CustomEvent("sz-queue-changed")); } catch {}
  return ev;
}

// Pull the 6-digit code out of a QR payload (SCHNITZERY-CLOCK:<branch>:<code>).
export function codeFromQR(payload: string): string {
  const parts = (payload || "").split(":");
  return parts.length === 3 && parts[0] === "SCHNITZERY-CLOCK" ? parts[2] : "";
}
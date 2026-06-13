import { readQueue, removeFromQueue, bumpAttempts } from "./attendanceQueue";
import { syncOfflineEvents } from "@/lib/queries/attendance-sync";

let syncing = false;

export type FlushResult = { ok: boolean; synced: number; remaining: number; offline?: boolean };

// Send the queued offline events to the server. Anything the server confirms
// (applied | duplicate | recorded_with_error) is removed from the local queue —
// all three mean the server has the event, so it's safe to drop. Only genuine
// transmission/server failures stay queued (attempts bumped) for a later retry,
// so nothing is ever lost.
export async function flushQueue(): Promise<FlushResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, offline: true, synced: 0, remaining: readQueue().length };
  }
  if (syncing) return { ok: true, synced: 0, remaining: readQueue().length };

  const q = readQueue();
  if (q.length === 0) return { ok: true, synced: 0, remaining: 0 };

  syncing = true;
  try {
    const payload = q.map((e) => ({
      event_uuid: e.event_uuid, action: e.action, captured_at: e.captured_at, code: e.code, device_id: e.device_id,
    }));
    const res = await syncOfflineEvents(payload);

    if (!res.ok) {
      bumpAttempts(q.map((e) => e.event_uuid)); // server/transmission error → keep, retry later
      return { ok: false, synced: 0, remaining: readQueue().length };
    }

    const confirmed: string[] = (res.results || []).map((r: any) => r.event_uuid);
    removeFromQueue(confirmed);

    const confirmedSet = new Set(confirmed);
    const notConfirmed = q.filter((e) => !confirmedSet.has(e.event_uuid)).map((e) => e.event_uuid);
    if (notConfirmed.length) bumpAttempts(notConfirmed);

    try { window.dispatchEvent(new CustomEvent("sz-queue-changed")); } catch {}
    return { ok: true, synced: confirmed.length, remaining: readQueue().length };
  } catch {
    bumpAttempts(q.map((e) => e.event_uuid));
    return { ok: false, synced: 0, remaining: readQueue().length };
  } finally {
    syncing = false;
  }
}
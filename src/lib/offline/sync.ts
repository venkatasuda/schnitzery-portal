import { readQueueMine, removeFromQueue, bumpAttempts, getQueueOwner } from "./attendanceQueue";
import { syncOfflineEvents } from "@/lib/queries/attendance-sync";
import { createClient } from "@/lib/supabase/client";

let syncing = false;

// Cap per flush so a device that has been offline for a long time cannot post a
// single enormous payload. Anything above this simply goes in the next round.
const BATCH_LIMIT = 100;

export type FlushResult = { ok: boolean; synced: number; remaining: number; offline?: boolean; needsReview?: number };

// Send the queued offline events to the server. Anything the server confirms
// (applied | duplicate | recorded_with_error) is removed from the local queue —
// all three mean the server has the event, so it's safe to drop. Only genuine
// transmission/server failures stay queued (attempts bumped) for a later retry.
//
// Only sends events belonging to the CURRENT session. These devices are shared,
// and the server attributes an event to whoever is signed in at sync time — so
// flushing somebody else's queued clock-in would record it as this user's shift.
// Events belonging to another user stay put until that user signs back in.
export async function flushQueue(): Promise<FlushResult> {
  const remaining = () => readQueueMine(getQueueOwner()).length;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, offline: true, synced: 0, remaining: remaining() };
  }
  if (syncing) return { ok: true, synced: 0, remaining: remaining() };
  syncing = true;
  let mine: ReturnType<typeof readQueueMine> = [];

  // Who is signed in right now? Without an answer we cannot safely attribute
  // anything, so we do nothing rather than risk writing to the wrong person.
  try {
    const { data: { user } } = await createClient().auth.getUser();
    const userId = user?.id;
    if (!userId || getQueueOwner() !== userId) return { ok: false, synced: 0, remaining: remaining() };
    mine = readQueueMine(userId).slice(0, BATCH_LIMIT);
    if (mine.length === 0) return { ok: true, synced: 0, remaining: remaining() };
    const payload = mine.map((e) => ({
      event_uuid: e.event_uuid,
      action: e.action,
      captured_at: e.captured_at,
      code: e.code,
      device_id: e.device_id,
      // Sent so the server can verify it against auth.uid() and refuse a
      // mismatch. The server must not trust this value — it must compare it.
      user_id: userId,
      capture_protocol: e.capture_protocol === 2 ? 2 : 1,
    }));
    const res = await syncOfflineEvents(payload);

    if (!res.ok) {
      await bumpAttempts(mine.map(e => e.event_uuid));
      return { ok: false, synced: 0, remaining: remaining() };
    }

    // `res.results` comes back untyped from the server action, so cast the
    // array first — otherwise map/filter infer `any` and noImplicitAny trips.
    const sent = new Set(mine.map(e => e.event_uuid));
    const results = (Array.isArray(res.results) ? res.results : []) as { event_uuid?: string; status?: string }[];
    const acknowledged = results.filter(r => r && typeof r.event_uuid === "string" && sent.has(r.event_uuid)
      && ["applied", "duplicate", "recorded_with_error"].includes(r.status || ""));
    const confirmed = [...new Set(acknowledged.map(r => r.event_uuid!))];
    const needsReview = new Set(acknowledged.filter(r => r.status === "recorded_with_error").map(r => r.event_uuid)).size;
    await removeFromQueue(confirmed);

    const confirmedSet = new Set(confirmed);
    const notConfirmed = mine.filter((e) => !confirmedSet.has(e.event_uuid)).map((e) => e.event_uuid);
    if (notConfirmed.length) await bumpAttempts(notConfirmed);

    try { window.dispatchEvent(new CustomEvent("sz-queue-changed", { detail: { needsReview } })); } catch {}
    return { ok: notConfirmed.length === 0, synced: confirmed.length - needsReview, needsReview, remaining: remaining() };
  } catch {
    try { if (mine.length) await bumpAttempts(mine.map(e => e.event_uuid)); } catch { /* keep durable evidence */ }
    return { ok: false, synced: 0, remaining: remaining() };
  } finally {
    syncing = false;
  }
}

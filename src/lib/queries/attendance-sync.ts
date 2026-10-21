"use server";

import { createClient } from "@/lib/supabase/server";
import { isCalendarDate } from "@/lib/time/berlinDate";

// Receives a batch of offline-captured events and hands them to the
// sync_attendance_events RPC (dedupe + retro-validate + apply). Returns a
// per-event result so the client knows which to clear from its local queue.

const MAX_EVENTS = 100;
const ACTIONS = ["clock_in", "clock_out", "break_start", "break_end"];

type IncomingEvent = {
  event_uuid?: unknown; action?: unknown; captured_at?: unknown;
  code?: unknown; device_id?: unknown; user_id?: unknown;
  capture_protocol?: unknown;
};

// Keep only well-formed events and strip anything we don't expect, so an
// arbitrary JSON blob can never reach the database function.
function sanitize(e: IncomingEvent, callerId: string) {
  if (!e || typeof e !== "object") return null;
  if (e.capture_protocol !== 1 && e.capture_protocol !== 2) return null;
  if (typeof e.event_uuid !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(e.event_uuid)) return null;
  if (typeof e.action !== "string" || !ACTIONS.includes(e.action)) return null;
  if (typeof e.captured_at !== "string" || e.captured_at.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(e.captured_at)
    || !isCalendarDate(e.captured_at.slice(0,10)) || !Number.isFinite(Date.parse(e.captured_at))) return null;

  const code = typeof e.code === "string" && /^\d{6}$/.test(e.code) ? e.code : null;
  const deviceId = typeof e.device_id === "string" ? e.device_id.slice(0, 64) : null;

  return {
    event_uuid: e.event_uuid,
    action: e.action,
    captured_at: e.captured_at,
    code,
    device_id: deviceId,
    // Always the authenticated caller — never the value the client sent. If the
    // client claimed a different owner, that is a bug or an attack; either way
    // the event is dropped below rather than misattributed.
    user_id: callerId,
    capture_protocol: e.capture_protocol,
  };
}

export async function syncOfflineEvents(events: unknown) {
  if (!Array.isArray(events) || events.length === 0) {
    return { ok: true, results: [] as any[] };
  }
  if (events.length > MAX_EVENTS) {
    return { ok: false, error: "Too many events in one batch.", results: [] as any[] };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in.", results: [] as any[] };

  const clean = (events as IncomingEvent[])
    // Refuse anything the client attributes to somebody other than the caller.
    // The client filters these out too, but this is the check that counts.
    .filter((e) => e?.user_id === user.id)
    .map((e) => sanitize(e, user.id))
    .filter((e): e is NonNullable<ReturnType<typeof sanitize>> => e !== null);

  if (clean.length === 0) return { ok: true, results: [] as any[] };

  const { data, error } = await supabase.rpc("sync_attendance_events", { p_events: clean });
  if (error) return { ok: false, error: error.message, results: [] as any[] };
  return { ok: true, results: data?.results || [] };
}

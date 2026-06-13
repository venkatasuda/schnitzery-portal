"use server";

import { createClient } from "@/lib/supabase/server";

// Receives a batch of offline-captured events and hands them to the
// sync_attendance_events RPC (dedupe + retro-validate + apply). Returns a
// per-event result so the client knows which to clear from its local queue.
export async function syncOfflineEvents(events: any[]) {
  if (!events || events.length === 0) return { ok: true, results: [] as any[] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_attendance_events", { p_events: events });
  if (error) return { ok: false, error: error.message, results: [] as any[] };
  return { ok: true, results: data?.results || [] };
}
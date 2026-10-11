"use server";

import { createClient } from "@/lib/supabase/server";

import { allowedPushEndpoint } from "./validation";

type SubInput = { endpoint: string; p256dh: string; auth: string; userAgent?: string };

export async function savePushSubscription(sub: SubInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!sub || typeof sub.endpoint !== "string" || typeof sub.p256dh !== "string" || typeof sub.auth !== "string" || !sub.p256dh || !sub.auth || sub.p256dh.length > 256 || sub.auth.length > 256) return { ok: false, error: "Invalid subscription." };
  if (!allowedPushEndpoint(sub.endpoint)) return { ok: false, error: "Unsupported push service." };
  if (sub.userAgent !== undefined && (typeof sub.userAgent !== "string" || sub.userAgent.length > 1024)) return { ok: false, error: "Invalid user agent." };

  // Own-row RLS on push_subscriptions enforces user_id = auth.uid().
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    user_agent: sub.userAgent ?? null,
    last_used_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: true };
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

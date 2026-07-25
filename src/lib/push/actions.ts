"use server";

// ============================================================================
// PUSH NOTIFICATIONS — server side. NOT WIRED IN YET.
//
// save/remove: store a device's subscription against the signed-in user.
// sendPushToUser: deliver a notification to all of a user's devices.
//
// Requires:
//   • npm i web-push
//   • env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (a mailto: or URL)
//     plus NEXT_PUBLIC_VAPID_PUBLIC_KEY (same public key, exposed to the client)
//   • migration 05_push_subscriptions.sql applied
// See PUSH-NOTIFICATIONS-SETUP.md for the full setup.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type SubInput = { endpoint: string; p256dh: string; auth: string; userAgent?: string };

export async function savePushSubscription(sub: SubInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) return { ok: false, error: "Invalid subscription." };

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

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: true };
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: true };
}

// ── Delivery ────────────────────────────────────────────────────────────────
// Sends to every device the user has registered. Uses the service-role key so
// it can read subscriptions across users (RLS would otherwise scope it to the
// caller). Prunes dead endpoints (410/404) so the table doesn't rot.
//
// This is the piece you call from wherever a notification should fire — e.g.
// alongside the existing notify() DB inserts for approvals / announcements /
// expiring docs. Wire those triggers up only after a manual test works.
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<{ ok: boolean; sent: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!url || !serviceKey || !pub || !priv || !subject) return { ok: false, sent: 0 };

  // Imported lazily so the app builds/runs even before `web-push` is installed
  // and this feature is turned on.
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(subject, pub, priv);

  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: subs } = await admin
    .from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);

  let sent = 0;
  const dead: string[] = [];
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) dead.push(s.endpoint); // gone — prune
    }
  }
  if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);

  return { ok: true, sent };
}

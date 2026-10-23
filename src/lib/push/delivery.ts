import "server-only";
import { allowedPushEndpoint } from "./validation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function sendPushToUser(
  userId: string,
  // `de`: German text; the service worker shows it on German-language devices.
  payload: { title: string; body: string; url?: string; de?: { title: string; body: string } },
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
  const { data: subs, error } = await admin
    .from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  if (error) return { ok: false, sent: 0 };

  let sent = 0;
  const dead: string[] = [];
  for (const s of subs || []) {
    if (!allowedPushEndpoint(s.endpoint)) { dead.push(s.endpoint); continue; }
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

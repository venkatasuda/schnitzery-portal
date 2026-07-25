"use client";

// ============================================================================
// PUSH NOTIFICATIONS — browser side. NOT WIRED IN YET.
//
// Call subscribeToPush() from a button (e.g. in ProfileSettings) after the user
// opts in. It asks the browser for permission, creates a Web Push subscription
// against your VAPID public key, and hands it to the server to store.
//
// Requires:
//   • NEXT_PUBLIC_VAPID_PUBLIC_KEY in the environment
//   • the push handlers added to public/sw.js (see PUSH-NOTIFICATIONS-SETUP.md)
//   • savePushSubscription / removePushSubscription server actions (./actions)
// ============================================================================

import { savePushSubscription, removePushSubscription } from "./actions";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  // Back the array with a fresh ArrayBuffer (not ArrayBufferLike) so it satisfies
  // the DOM BufferSource type under TS 5's stricter buffer typing.
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function currentPushState(): Promise<"unsupported" | "denied" | "subscribed" | "unsubscribed"> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "subscribed" : "unsubscribed";
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: "This device doesn't support notifications." };

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { ok: false, error: "Notifications aren't configured on the server yet." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Notification permission was not granted." };

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });

    const json = sub.toJSON();
    const res = await savePushSubscription({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      userAgent: navigator.userAgent,
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not subscribe." };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  if (!pushSupported()) return { ok: true };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  }
  return { ok: true };
}

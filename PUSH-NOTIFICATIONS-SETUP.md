# Push notifications — setup guide

The code is written but **deliberately not wired in**. Nothing sends or requests
a notification until you complete these steps. That keeps production safe: if you
never finish, the app behaves exactly as it does today.

Files already in place:
- `supabase/pending/05_push_subscriptions.sql` — the device-subscription table
- `src/lib/push/client.ts` — browser: ask permission, subscribe, unsubscribe
- `src/lib/push/actions.ts` — server: store subscriptions, send a push
- (you add) push handlers in `public/sw.js`
- (you add) a toggle in the Profile page

---

## 1. Generate VAPID keys (once)

VAPID keys identify your server to the browser push services. Generate a pair:

```
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**.

## 2. Add environment variables

In `.env.local` (and in Vercel → Project → Settings → Environment Variables):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the public key>
VAPID_PUBLIC_KEY=<the same public key>
VAPID_PRIVATE_KEY=<the private key>
VAPID_SUBJECT=mailto:you@schnitzery-stuttgart.de
```

The private key is a secret — it is server-only and must never be committed.
`.env*` is already gitignored.

## 3. Install the sender library

```
npm i web-push
```

`actions.ts` imports it lazily, so the app keeps building even before this step.

## 4. Apply the table

Backup, then run `supabase/pending/05_push_subscriptions.sql` in the SQL Editor.

## 5. Add the service-worker handlers

Append this to `public/sw.js` (it does not touch the existing fetch logic) and
bump `CACHE_VERSION` so devices pick up the new worker:

```js
// ── Push ────────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "Schnitzery", body: "", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url.includes(url) && "focus" in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
```

## 6. Add an opt-in toggle

In `src/components/ProfileSettings.tsx`, add a button that calls
`subscribeToPush()` / `unsubscribeFromPush()` from `@/lib/push/client` and shows
`currentPushState()`. Keep it opt-in — never subscribe silently.

## 7. Fire pushes where they matter

Call `sendPushToUser(userId, { title, body, url })` from the places that already
create in-app notifications — for example next to the existing `notify()` inserts
for approvals, announcements and expiring documents. Suggested first three:

- Leave / swap decision → the requester (`url: "/leave"`)
- New announcement → each branch member (`url: "/announcements"`)
- Document expiring soon → the owner + the doc holder (`url: "/expiring-docs"`)

## 8. Test before relying on it

1. On your phone, open the app, toggle notifications on, accept the prompt.
2. From a quick script or a temporary admin action, call
   `sendPushToUser(yourUserId, { title: "Test", body: "It works", url: "/" })`.
3. Confirm it arrives with the app closed. Tapping it should open the app at `url`.

Only wire step 7 into the live flows once this manual test passes.

---

### Why it's built this way

Every piece that could break the running app (the service worker, the Profile
toggle, the notify() triggers) is left for you to add explicitly. The parts that
are safe to have sitting in the repo (the table, the helpers) are done. So the
feature can't half-work: it's off until you turn it on, end to end.

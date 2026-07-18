"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/components/LanguageProvider";
import { flushQueue } from "@/lib/offline/sync";

// Signs the user out (clears the Supabase auth cookie) then does a hard
// navigation to /login so the server re-reads the now-empty session.
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const { t } = useLang();

  async function logout() {
    if (busy) return;
    setBusy(true);

    // 1. Push any attendance events captured offline BEFORE we drop the session.
    //    They are attributed to whoever is signed in at sync time, so they must
    //    go up while this user still holds the session — otherwise the next
    //    person to log in on a shared tablet would sync them as their own.
    try { await flushQueue(); } catch { /* best effort — never block sign-out */ }

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* even if the call fails, still send them to login */
    }

    // 2. Drop every service-worker cache. On a shared device these can hold
    //    rendered pages from this user's session; they must not outlive it.
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* best effort */ }

    window.location.href = "/login";
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      style={{
        width: "100%",
        marginTop: 14,
        padding: "13px",
        background: "transparent",
        border: "1px solid rgba(192,57,43,0.5)",
        borderRadius: 12,
        color: "***REMOVED***e74c3c",
        fontSize: 15,
        fontWeight: 700,
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? t("auth.signingOut") : "↪  " + t("auth.logOut")}
    </button>
  );
}
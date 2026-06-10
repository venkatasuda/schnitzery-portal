"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/components/LanguageProvider";

// Signs the user out (clears the Supabase auth cookie) then does a hard
// navigation to /login so the server re-reads the now-empty session.
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const { t } = useLang();

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* even if the call fails, still send them to login */
    }
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
        color: "#e74c3c",
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
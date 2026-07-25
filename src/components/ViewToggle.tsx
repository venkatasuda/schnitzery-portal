"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLang } from "@/components/LanguageProvider";

// Pill toggle shown only to brand owners / super admins (see layout.tsx).
// Flips the sz_view cookie between HQ oversight and the single-branch toolkit,
// then refreshes so the server re-renders the home + nav for the chosen mode.
export default function ViewToggle({ mode }: { mode: "hq" | "branch" }) {
  const router = useRouter();
  const { t } = useLang();
  const [busy, setBusy] = useState(false);

  function switchTo(next: "hq" | "branch") {
    if (next === mode || busy) return;
    // 1 year, site-wide.
    document.cookie = `sz_view=${next}; path=/; max-age=31536000; samesite=lax`;
    setBusy(true);
    router.refresh();
  }

  const btn = (m: "hq" | "branch", label: string) => (
    <button
      onClick={() => switchTo(m)}
      disabled={busy}
      aria-pressed={mode === m}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        border: "none",
        cursor: busy ? "default" : "pointer",
        fontSize: 12,
        fontWeight: 700,
        background: mode === m ? "var(--gold)" : "transparent",
        color: mode === m ? "#1a0e0e" : "var(--gray)",
        transition: "background .15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={t("view.label")}
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      {btn("hq", t("view.hq"))}
      {btn("branch", t("view.branch"))}
    </div>
  );
}

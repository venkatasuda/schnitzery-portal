"use client";

import { useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import AgentChat from "@/components/AgentChat";

// Floating ops-assistant launcher: a robot button fixed bottom-right that opens
// the chat in a popover. Rendered app-wide (managers+ only, flag on) by the
// layout, so the assistant is reachable from every screen without a nav tab.
export default function AgentWidget() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <>
          {/* click-away backdrop */}
          <div onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998, background: "transparent" }} />
          <div style={{
            position: "fixed", zIndex: 999, right: 20, bottom: 96,
            width: "min(380px, calc(100vw - 32px))",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{t("assistant.title")}</strong>
              <button aria-label={t("common.close")} onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "inherit", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4 }}>×</button>
            </div>
            <AgentChat />
          </div>
        </>
      )}

      <button
        aria-label={t("assistant.title")}
        onClick={() => setOpen((v) => !v)}
        className="agent-fab"
        style={{
          position: "fixed", zIndex: 999, right: 20, bottom: 88,
          width: 60, height: 60, borderRadius: "50%", cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.15)",
          background: "linear-gradient(145deg, var(--red), var(--red-dark))",
          boxShadow: "var(--shadow-red)", color: "var(--gold-light)",
          display: "grid", placeItems: "center",
        }}
      >
        <RobotIcon />
      </button>
    </>
  );
}

// Generic robot glyph (original — not any brand mascot).
function RobotIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V4" /><circle cx="12" cy="3" r="1.3" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9.5 16.5h5" />
      <path d="M4 12H2.5M20 12h1.5" />
    </svg>
  );
}

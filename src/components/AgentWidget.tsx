"use client";

import { useState, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import AgentChat from "@/components/AgentChat";
import { MessageCircle } from "lucide-react";

// Floating ops-assistant launcher: a robot button fixed bottom-right that opens
// the chat in a popover. Rendered app-wide (managers+ only, flag on) by the
// layout, so the assistant is reachable from every screen without a nav tab.
export default function AgentWidget() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); launcher.current?.focus(); };

  return (
    <>
      {open && (
        <>
          {/* click-away backdrop */}
          <div onClick={close}
            style={{ position: "fixed", inset: 0, zIndex: 998, background: "transparent" }} />
          <div id="assistant-dialog" className="assistant-popover" role="dialog" aria-label={t("assistant.title")} onKeyDown={e => { if (e.key === "Escape") close(); }}>
            <div className="d-flex ai-c jc-sb mb-2">
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{t("assistant.title")}</strong>
              <button autoFocus aria-label={t("common.close")} onClick={close}
                style={{ background: "none", border: "none", color: "inherit", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4 }}>×</button>
            </div>
            <AgentChat />
          </div>
        </>
      )}

      <button
        ref={launcher}
        aria-haspopup="dialog"
        aria-controls={open ? "assistant-dialog" : undefined}
        aria-label={t("assistant.title")}
        onClick={() => setOpen((v) => !v)}
        className="agent-fab assistant-launcher"
        aria-expanded={open}
      >
        <MessageCircle size={20} aria-hidden="true" /> {t("assistant.title")}
      </button>
    </>
  );
}

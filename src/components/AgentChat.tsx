"use client";

import { useState, useRef, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";

// Minimal read-only chat panel for the ops assistant. Posts the running
// transcript to /api/agent/chat and renders the reply. No streaming (v1).
type Msg = { role: "user" | "assistant"; content: string; sources?: { tool: string; asOf?: string; scope?: string; from?: string; to?: string }[] };

export default function AgentChat() {
  const { t } = useLang();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs.slice(-18), { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: res.ok && data.ok ? data.reply : (data.error || t("assistant.error")), sources: res.ok && data.ok ? data.sources : undefined }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: t("assistant.error") }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 420 }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, maxHeight: "55vh" }}>
        {msgs.length === 0 && <div className="assistant-start"><h2>{t("assistant.empty")}</h2><p>{t("business.assistantNote")}</p><div className="assistant-prompts">{["askBusiness", "askStock", "askWaste"].map(key => <button className="btn-secondary" key={key} onClick={() => setInput(t(`business.${key}`))}>{t(`business.${key}`)}</button>)}</div></div>}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            <div style={{
              padding: "10px 14px", borderRadius: 14, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5,
              background: m.role === "user" ? "var(--action)" : "var(--dark2)",
              color: m.role === "user" ? "var(--on-action)" : "var(--white)",
              border: "1px solid var(--border)",
            }}>{m.content}</div>
            {m.sources?.map((source, n) => <small className="assistant-source" key={n}>{t(`business.${source.tool}`)} · {source.from ? `${source.from} – ${source.to}` : source.asOf}{source.scope ? ` · ${source.scope}` : ""}</small>)}
            {m.sources?.length === 0 && <small className="assistant-source">{t("business.noSource")}</small>}
          </div>
        ))}
        {busy && <div style={{ alignSelf: "flex-start", opacity: 0.6, fontSize: 13, padding: "4px 6px" }}>{t("assistant.thinking")}</div>}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          aria-label={t("business.question")}
          maxLength={1600}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t("assistant.placeholder")}
          disabled={busy}
          style={{ flex: 1 }}
        />
        <button className="btn-gold" onClick={send} disabled={busy || !input.trim()}>{t("assistant.send")}</button>
      </div>
    </div>
  );
}

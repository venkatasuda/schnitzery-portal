"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLang } from "@/components/LanguageProvider";
import AgentChat from "@/components/AgentChat";
import RobotMascot from "@/components/RobotMascot";
import { MessageCircle } from "lucide-react";
import { getTempSummary } from "@/lib/queries/temp";
import { robotMood, type RobotMood } from "@/lib/assistant/mood";
import { berlinToday } from "@/lib/time/berlinDate";

// Floating ops-assistant launcher, fixed bottom-right; opens the chat in a popover. Rendered app-wide (managers+ only,
// flag on) by the layout. The launcher is the animated robot (RobotMascot); its mood follows today's temperature
// status (src/lib/assistant/mood.ts) and "thinking" while a reply is on the way. A short bubble appears once per new
// event for 5 s. Profile → "Animated assistant robot" off = the plain button.
const POLL_MS = 5 * 60_000, BUBBLE_MS = 5_000, HELLO_MS = 4_000;
const berlinHour = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(new Date())) % 24;
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } } };

export default function AgentWidget() {
  const { t, locale } = useLang();
  const [open, setOpen] = useState(false);
  const [robot, setRobot] = useState(true);
  const [base, setBase] = useState<{ mood: RobotMood; message: string | null; key: string }>({ mood: "idle", message: null, key: "idle" });
  const [hello, setHello] = useState(false), [busy, setBusy] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); launcher.current?.focus(); };

  // Off switch from Profile (same tab via event, other tabs via storage).
  useEffect(() => {
    const read = () => setRobot(store.get("sz-robot") !== "off");
    read(); window.addEventListener("sz-robot-changed", read); window.addEventListener("storage", read);
    return () => { window.removeEventListener("sz-robot-changed", read); window.removeEventListener("storage", read); };
  }, []);

  // Wave once a day.
  useEffect(() => {
    if (!robot || store.get("sz-robot-hello") === berlinToday()) return;
    store.set("sz-robot-hello", berlinToday()); setHello(true);
    const id = setTimeout(() => setHello(false), HELLO_MS); return () => clearTimeout(id);
  }, [robot]);

  // Mood from today's temperature status; polled, and refreshed when the tab comes back.
  const refresh = useCallback(async () => {
    const r = await getTempSummary().catch(() => null);
    const s = r && r.ok && "openBreaches" in r ? { totalUnits: r.totalUnits ?? 0, openBreaches: r.openBreaches ?? [], openingMissing: r.openingMissing ?? 0, closingMissing: r.closingMissing ?? 0 } : null;
    setBase(robotMood(s, berlinHour(), locale === "de"));
  }, [locale]);
  useEffect(() => {
    if (!robot) return;
    void refresh();
    const id = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [robot, refresh]);

  // Bubble: only for a new situation (not on every poll, not again after a reload the same day).
  useEffect(() => {
    if (!robot || !base.message || open) return;
    const seen = `${berlinToday()}|${base.key}`;
    if (store.get("sz-robot-seen") === seen) return;
    store.set("sz-robot-seen", seen); setBubble(base.message);
  }, [robot, base, open]);
  useEffect(() => { if (!bubble) return; const id = setTimeout(() => setBubble(null), BUBBLE_MS); return () => clearTimeout(id); }, [bubble]);

  const mood: RobotMood = busy ? "think" : hello && base.mood === "idle" ? "hello" : base.mood;
  const label = base.message ? `${t("assistant.title")}: ${base.message}` : t("assistant.title");

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
            <AgentChat onBusy={setBusy} />
          </div>
        </>
      )}

      {robot && bubble && !open && <div className="assistant-bubble" role="status">{bubble}</div>}

      <button
        ref={launcher}
        aria-haspopup="dialog"
        aria-controls={open ? "assistant-dialog" : undefined}
        aria-label={label}
        onClick={() => { setOpen((v) => !v); setBubble(null); }}
        className={`agent-fab assistant-launcher${robot ? " is-robot" : ""}`}
        aria-expanded={open}
      >
        {robot ? <RobotMascot mood={mood} /> : <><MessageCircle size={20} aria-hidden="true" /> {t("assistant.title")}</>}
      </button>
    </>
  );
}

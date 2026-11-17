"use client";
// One clock in/out implementation for every screen (Attendance page, Home hero card).
// Server-stamped actions; best-effort geolocation (the database decides per branch gps_mode); when offline the
// action goes to the device queue and is shown as "saved offline" until it syncs — never as server-confirmed.
import { useEffect, useRef, useState } from "react";
import { getMyStatus, clockIn, clockOut, startBreak, endBreak } from "@/lib/queries/attendance";
import { clockInWithCode, clockOutWithCode, clockWithQR } from "@/lib/queries/clockcode";
import { serverText } from "@/lib/i18n/serverMessages";
import { isOnline, captureOffline, readQueueMine, getQueueOwner, codeFromQR, type ClockAction } from "@/lib/offline/attendanceQueue";
import { useLang } from "@/components/LanguageProvider";

// A session always has a clock-in; no session = not clocked in today.
type Session = { clock_in: string; clock_out: string | null; breaks: unknown; duration_mins: number | null } | null;
type Result = { ok: boolean; error?: string };

// Break math shared by the Attendance page and the Home clock card.
export function parseBreaks(raw: unknown): Array<{ start: string; end: string | null }> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(String(raw)); } catch { return []; }
}
export function computeBreakMs(raw: unknown): number {
  let ms = 0;
  for (const b of parseBreaks(raw)) if (b.start && b.end) ms += Math.max(0, new Date(b.end).getTime() - new Date(b.start).getTime());
  return ms;
}

// Best-effort device location; null when unavailable, denied or slow.
export function getGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export function useClock() {
  const { t, locale } = useLang();
  const [loading, setLoading] = useState(true), [working, setWorking] = useState(false);
  const [clockedIn, setClockedIn] = useState(false), [onBreak, setOnBreak] = useState(false);
  const [session, setSession] = useState<Session>(null), [message, setMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false), [elapsed, setElapsed] = useState(0);

  async function refresh() {
    try {
      const res = await getMyStatus();
      if (!res.ok) throw Error();
      setClockedIn(res.clockedIn || false); setOnBreak(res.onBreak || false); setSession(res.session as Session); setStatusError(false);
      window.dispatchEvent(new Event("sz-clock-changed")); // e.g. Today's team reloads right away
    } catch { setStatusError(true); setMessage(t("att.couldNotLoad")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When queued offline records have synced, reload the server's status.
  const messageRef = useRef(message); messageRef.current = message;
  useEffect(() => {
    const onQueue = () => { if (messageRef.current !== t("att.savedOffline") || readQueueMine(getQueueOwner()).length) return; setMessage(null); void refresh(); };
    window.addEventListener("sz-queue-changed", onQueue);
    return () => window.removeEventListener("sz-queue-changed", onQueue);
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live timer: total time since clock-in (breaks included).
  useEffect(() => {
    if (!clockedIn || !session?.clock_in) { setElapsed(0); return; }
    const start = new Date(session.clock_in).getTime(), tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick(); const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockedIn, session]);

  // Offline capture shows the expected state locally; the real state syncs later.
  function applyOptimistic(action: ClockAction) {
    if (action === "clock_in") { setClockedIn(true); setOnBreak(false); setSession({ clock_in: new Date().toISOString(), clock_out: null, breaks: [], duration_mins: null }); }
    else if (action === "clock_out") { setClockedIn(false); setOnBreak(false); setSession(null); }
    else if (action === "break_start") setOnBreak(true);
    else if (action === "break_end") setOnBreak(false);
  }
  async function saveForSync(action: ClockAction, code?: string) {
    try { await captureOffline(action, code); applyOptimistic(action); setMessage(t("att.savedOffline")); return true; }
    catch { setMessage(t("att.offlineNotSaved")); return false; }
  }
  async function run(fn: () => Promise<Result>, okMsg: string, offlineAction: ClockAction) {
    setWorking(true); setMessage(null);
    if (!isOnline()) { await saveForSync(offlineAction); setWorking(false); return; }
    try {
      const res = await fn();
      setMessage(res.ok ? okMsg : res.error || t("att.failed"));
      await refresh().catch(() => setMessage(t("att.couldNotLoad")));
    } catch { await saveForSync(offlineAction); }
    setWorking(false);
  }
  const located = async (locate: boolean) => { if (locate) setMessage(t("att.locating")); return isOnline() ? getGeo() : null; };
  const actions = {
    clockIn: async () => { const g = await located(true); await run(() => clockIn(undefined, g?.lat, g?.lng), t("att.clockedIn"), "clock_in"); },
    clockOut: async () => { const g = await located(true); await run(() => clockOut(undefined, g?.lat, g?.lng), t("att.clockedOut"), "clock_out"); },
    startBreak: async () => { const g = await located(false); await run(() => startBreak(g?.lat, g?.lng), t("att.breakStarted"), "break_start"); },
    endBreak: async () => { const g = await located(false); await run(() => endBreak(g?.lat, g?.lng), t("att.breakEnded"), "break_end"); },
  };
  // Kiosk code (6 digits) or kiosk QR — the same rules on every screen. Returns an error text, or null when done
  // (clocked, or saved offline to sync later).
  async function byCode(mode: "in" | "out", code: string): Promise<string | null> {
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6) return t("att.enter6");
    const action: ClockAction = mode === "out" ? "clock_out" : "clock_in";
    setWorking(true);
    try {
      if (!isOnline()) return (await saveForSync(action, clean)) ? null : t("att.offlineNotSaved");
      const g = await getGeo();
      const res = await (mode === "out" ? clockOutWithCode : clockInWithCode)(clean, g?.lat, g?.lng);
      if (!res.ok) return res.error || t("att.failedShort");
      setMessage(mode === "out" ? t("att.outCode") : t("att.inCode"));
      await refresh().catch(() => setMessage(t("att.couldNotLoad")));
      return null;
    } catch { return (await saveForSync(action, clean)) ? null : t("att.offlineNotSaved"); }
    finally { setWorking(false); }
  }
  async function byQR(mode: "in" | "out", payload: string) {
    const action: ClockAction = mode === "out" ? "clock_out" : "clock_in";
    setWorking(true);
    try {
      if (!isOnline()) { await saveForSync(action, codeFromQR(payload)); return; }
      setMessage(t("att.readingQR"));
      const g = await getGeo();
      const res = await clockWithQR(payload, mode, g?.lat, g?.lng);
      if (res.ok) { setMessage(mode === "out" ? t("att.outQR") : t("att.inQR")); await refresh().catch(() => setMessage(t("att.couldNotLoad"))); }
      else setMessage(serverText(res.error ?? "", locale) || t("att.qrFailed"));
    } catch { await saveForSync(action, codeFromQR(payload)); }
    finally { setWorking(false); }
  }
  return { loading, working, setWorking, clockedIn, onBreak, session, message, setMessage, statusError, elapsed, refresh, saveForSync, byCode, byQR, ...actions };
}

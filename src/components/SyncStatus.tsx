"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import { readQueueMine, readStranded } from "@/lib/offline/attendanceQueue";
import { flushQueue } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/Toast";

// Live reliability indicator. Stays hidden when online with an empty queue
// (no noise); shows an amber "N waiting to sync" strip with a Sync-now button
// when events are queued, and a red "Offline" strip when the connection drops.
export default function SyncStatus() {
  const { t } = useLang();
  const [pending, setPending] = useState(0);
  const [stranded, setStranded] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let uid: string | null = null;
    const update = () => {
      setPending(readQueueMine(uid).length);
      setStranded(readStranded(uid).length);
      setOnline(navigator.onLine);
    };

    createClient().auth.getUser()
      .then(({ data: { user } }) => { uid = user?.id ?? null; setUserId(uid); update(); })
      .catch(() => update());

    update();
    window.addEventListener("sz-queue-changed", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const iv = setInterval(update, 5000);
    return () => {
      window.removeEventListener("sz-queue-changed", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      clearInterval(iv);
    };
  }, []);

  async function syncNow() {
    setSyncing(true);
    const r = await flushQueue();
    setSyncing(false);
    const mine = readQueueMine(userId).length;
    setPending(mine);
    setStranded(readStranded(userId).length);
    if (r.offline) toast(t("sync.offlineToast"), "error");
    else if (r.synced > 0) toast(t("sync.syncedN", { n: r.synced }), "success");
    else if (mine === 0) toast(t("sync.allSynced"), "success");
  }

  if (online && pending === 0 && stranded === 0) return null;

  return (
    <>
      {(pending > 0 || !online) && (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 12, borderRadius: 12,
        background: online ? "rgba(232,163,90,0.12)" : "rgba(236,112,99,0.12)",
        border: `1px solid ${online ? "rgba(232,163,90,0.4)" : "rgba(236,112,99,0.4)"}`,
      }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: online ? "***REMOVED***e8a35a" : "***REMOVED***ec7063", flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12.5, color: "var(--white)" }}>
        {!online && <span style={{ fontWeight: 700 }}>{t("sync.offline")}</span>}
        {!online && pending > 0 && " · "}
        {pending > 0 ? t("sync.pending", { n: pending }) : (online ? t("sync.online") : "")}
      </div>
      {pending > 0 && online && (
        <button onClick={syncNow} disabled={syncing} style={{
          padding: "6px 12px", background: "var(--gold)", color: "***REMOVED***1a0e0e", border: "none",
          borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: syncing ? 0.6 : 1, flexShrink: 0,
        }}>
          {syncing ? t("sync.syncing") : t("sync.syncNow")}
        </button>
      )}
      </div>
      )}

      {/* Records captured by someone else on this shared device, or retried past
          the cap. They are deliberately NOT synced under this session — they
          would be recorded as this user's shift. Shown so they can't sit
          invisible forever. */}
      {stranded > 0 && (
        <div style={{
          padding: "10px 12px", marginBottom: 12, borderRadius: 12,
          background: "rgba(232,163,90,0.10)", border: "1px solid rgba(232,163,90,0.35)",
        }}>
          <div style={{ fontSize: 12.5, color: "var(--white)", fontWeight: 700 }}>
            {t("sync.stranded", { n: stranded })}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
            {t("sync.strandedHelp")}
          </div>
        </div>
      )}
    </>
  );
}
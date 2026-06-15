"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import { isOnline, queueCount } from "@/lib/offline/attendanceQueue";
import { getKioskHealth } from "@/lib/queries/status";

// ============================================================================
// LIVE STATUS STRIP — compact, always-current health chips for managers:
//  • Connection — online/offline (covers Supabase connectivity)
//  • Sync — synced or N attendance records waiting to upload (offline queue)
//  • Kiosks — how many branch kiosks are online (an online kiosk is rotating QR)
// Updates instantly on connection/queue changes and refreshes every 60s.
// ============================================================================

export default function StatusStrip() {
  const { t } = useLang();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [kiosk, setKiosk] = useState<{ online: number; offline: number; total: number } | null>(null);

  useEffect(() => {
    const upd = () => { setOnline(isOnline()); setPending(queueCount()); };
    const fetchK = () => { getKioskHealth().then((r) => { if (r.ok) setKiosk({ online: r.online, offline: r.offline, total: r.total }); }).catch(() => {}); };
    upd(); fetchK();
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    window.addEventListener("sz-queue-changed", upd);
    const iv = setInterval(() => { upd(); fetchK(); }, 60000);
    return () => {
      window.removeEventListener("online", upd);
      window.removeEventListener("offline", upd);
      window.removeEventListener("sz-queue-changed", upd);
      clearInterval(iv);
    };
  }, []);

  const GREEN = "#58d68d", AMBER = "#e8a35a", RED = "#ec7063";
  const chips: { dot: string; label: string }[] = [
    { dot: online ? GREEN : RED, label: online ? t("livestat.online") : t("livestat.offline") },
    { dot: pending > 0 ? AMBER : GREEN, label: pending > 0 ? `${pending} ${t("livestat.pending")}` : t("livestat.synced") },
  ];
  if (kiosk && kiosk.total > 0) chips.push({ dot: kiosk.offline > 0 ? AMBER : GREEN, label: `${kiosk.online}/${kiosk.total} ${t("livestat.kiosks")}` });

  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 0 12px", WebkitOverflowScrolling: "touch" }}>
      {chips.map((c, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0, padding: "5px 11px", borderRadius: 999, background: "var(--dark3)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "var(--white)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, boxShadow: `0 0 6px ${c.dot}` }} />
          {c.label}
        </span>
      ))}
    </div>
  );
}
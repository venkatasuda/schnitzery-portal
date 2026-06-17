"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getNotificationHistory, markAllNotificationsRead } from "@/lib/queries/notifications";
import { CardSkeleton } from "@/components/Skeleton";

const NOTIF: Record<string, { key: string; icon: string; href: string; cat: string }> = {
  doc_pending: { key: "notif.docPending", icon: "📑", href: "/expiring-docs", cat: "mine" },
  doc_approved: { key: "notif.docApproved", icon: "✅", href: "/profile", cat: "mine" },
  doc_rejected: { key: "notif.docRejected", icon: "❌", href: "/profile", cat: "mine" },
  correction_approved: { key: "notif.correctionApproved", icon: "✅", href: "/attendance/corrections", cat: "mine" },
  correction_rejected: { key: "notif.correctionRejected", icon: "❌", href: "/attendance/corrections", cat: "mine" },
  forgot_checkout: { key: "notif.forgotCheckout", icon: "🚪", href: "/attendance", cat: "mine" },
  missing_attendance: { key: "notif.missingAttendance", icon: "❓", href: "/attendance/corrections", cat: "mine" },
  upcoming_shift: { key: "notif.upcomingShift", icon: "📅", href: "/schedule", cat: "mine" },
  correction_pending: { key: "notif.correctionPending", icon: "✏️", href: "/approvals", cat: "team" },
  employee_late: { key: "notif.employeeLate", icon: "⏰", href: "/ops", cat: "team" },
  mgr_missing: { key: "notif.mgrMissing", icon: "🚫", href: "/ops", cat: "team" },
  staffing_shortage: { key: "notif.staffingShortage", icon: "📉", href: "/ops", cat: "team" },
  kiosk_offline: { key: "notif.kioskOffline", icon: "🖥️", href: "/kiosks", cat: "system" },
  sync_failure: { key: "notif.syncFailure", icon: "🔄", href: "/ops", cat: "system" },
  attendance_anomaly: { key: "notif.attendanceAnomaly", icon: "⚠️", href: "/ops", cat: "system" },
  system_error: { key: "notif.systemError", icon: "🛠️", href: "/dashboard", cat: "system" },
};

export default function NotificationsPage() {
  const { t } = useLang();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<"all" | "mine" | "team" | "system">("all");

  async function load() {
    setLoading(true);
    const res = await getNotificationHistory(150);
    if (res.ok) setItems(res.items || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function markRead() {
    await markAllNotificationsRead();
    setItems((cur) => cur.map((n) => ({ ...n, is_read: true })));
  }

  function relTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return t("notif.justNow") || "now";
    if (min < 60) return `${min}m`;
    const h = Math.round(min / 60); if (h < 24) return `${h}h`;
    const d = Math.round(h / 24); if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short" });
  }
  function groupOf(iso: string) {
    const d = new Date(iso); const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (sameDay) return t("notif.today");
    if (d.toDateString() === y.toDateString()) return t("notif.yesterday");
    return t("notif.earlier");
  }

  const filtered = items.filter((n) => cat === "all" || (NOTIF[n.type]?.cat || "mine") === cat);
  const count = (c: string) => items.filter((n) => (NOTIF[n.type]?.cat || "mine") === c).length;
  const unread = items.filter((n) => !n.is_read).length;

  // ordered groups
  const groups: { label: string; rows: any[] }[] = [];
  for (const n of filtered) {
    const g = groupOf(n.created_at);
    let bucket = groups.find((x) => x.label === g);
    if (!bucket) { bucket = { label: g, rows: [] }; groups.push(bucket); }
    bucket.rows.push(n);
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="🔔" size={22} /> {t("notif.center")}</div>
        </div>
        {unread > 0 && <button onClick={markRead} style={{ padding: "8px 12px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.22)", borderRadius: 10, color: "var(--gold)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{t("notif.markAllRead")}</button>}
      </div>

      <div className="hub-tabs" style={{ marginTop: 10 }}>
        <button className={`hub-tab${cat === "all" ? " active" : ""}`} onClick={() => setCat("all")}>{t("notif.catAll")} {items.length || ""}</button>
        <button className={`hub-tab${cat === "mine" ? " active" : ""}`} onClick={() => setCat("mine")}>{t("notif.catMine")} {count("mine") || ""}</button>
        <button className={`hub-tab${cat === "team" ? " active" : ""}`} onClick={() => setCat("team")}>{t("notif.catTeam")} {count("team") || ""}</button>
        <button className={`hub-tab${cat === "system" ? " active" : ""}`} onClick={() => setCat("system")}>{t("notif.catSystem")} {count("system") || ""}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, fontSize: 13 }}><Icon e="🎉" size={16} color="#58d68d" style={{ verticalAlign: "-2px", marginRight: 6 }} /> {t("notif.caughtUp")}</div>
      ) : (
        groups.map((g) => (
          <div key={g.label} style={{ marginBottom: 12 }}>
            <div className="section-label">{g.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.rows.map((n) => {
                const meta = NOTIF[n.type] || { key: "notif.title", icon: "🔔", href: "/" };
                return (
                  <Link key={n.id} href={meta.href} className="card" style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 12, textDecoration: "none" }}>
                    <Icon e={meta.icon} size={18} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: "var(--white)" }}>{t(meta.key)}</div>
                      {n.message && <div style={{ fontSize: 11.5, color: "var(--gray)", marginTop: 2 }}>{n.message}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--gray)", whiteSpace: "nowrap", marginTop: 2 }}>{relTime(n.created_at)}</span>
                    {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--gold)", marginTop: 4, flexShrink: 0 }} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getManagerAlerts } from "@/lib/queries/alerts";
import { getMyNotifications, markAllNotificationsRead } from "@/lib/queries/notifications";

const DOC_TYPE_KEYS = ["id_card", "tax_id", "contract", "health_certificate", "visa", "work_permit", "training_certificate", "certificate", "other"];

// Live manager ops alerts (computed) by type → label key + icon + link.
const OPS: Record<string, { key: string; icon: string; href: string }> = {
  approval:     { key: "notif.approvalsWaiting", icon: "✅", href: "/approvals" },
  incident:     { key: "notif.openIncidents",    icon: "🚨", href: "/incidents" },
  stock:        { key: "notif.lowStock",         icon: "📦", href: "/inventory" },
  availability: { key: "notif.notSubmitted",     icon: "📋", href: "/noshow" },
  docs:         { key: "notif.docsExpiring",     icon: "📑", href: "/expiring-docs" },
};
// Persisted doc notifications by type → label key + icon + link.
const NOTIF: Record<string, { key: string; icon: string; href: string }> = {
  doc_pending:  { key: "notif.docPending",  icon: "📑", href: "/expiring-docs" },
  doc_approved: { key: "notif.docApproved", icon: "✅", href: "/profile" },
  doc_rejected: { key: "notif.docRejected", icon: "❌", href: "/profile" },
  correction_pending:  { key: "notif.correctionPending",  icon: "✏️", href: "/approvals" },
  correction_approved: { key: "notif.correctionApproved", icon: "✅", href: "/attendance/corrections" },
  correction_rejected: { key: "notif.correctionRejected", icon: "❌", href: "/attendance/corrections" },
  // employee
  forgot_checkout:     { key: "notif.forgotCheckout",    icon: "🚪", href: "/attendance" },
  missing_attendance:  { key: "notif.missingAttendance", icon: "❓", href: "/attendance/corrections" },
  upcoming_shift:      { key: "notif.upcomingShift",     icon: "📅", href: "/schedule" },
  // manager
  employee_late:       { key: "notif.employeeLate",      icon: "⏰", href: "/ops" },
  mgr_missing:         { key: "notif.mgrMissing",        icon: "🚫", href: "/ops" },
  staffing_shortage:   { key: "notif.staffingShortage",  icon: "📉", href: "/ops" },
  // admin
  kiosk_offline:       { key: "notif.kioskOffline",      icon: "🖥️", href: "/kiosks" },
  sync_failure:        { key: "notif.syncFailure",       icon: "🔄", href: "/ops" },
  attendance_anomaly:  { key: "notif.attendanceAnomaly", icon: "⚠️", href: "/ops" },
  system_error:        { key: "notif.systemError",       icon: "🛠️", href: "/dashboard" },
};

const CORR_KEY: Record<string, string> = { forgot_in: "typeForgotIn", forgot_out: "typeForgotOut", missing: "typeMissing", incorrect: "typeIncorrect" };

export default function NotificationBell() {
  const { t } = useLang();
  const docLabel = (k: string) => t("documents.type_" + (DOC_TYPE_KEYS.includes(k) ? k : "other"));
  const [open, setOpen] = useState(false);
  const [ops, setOps] = useState<any[]>([]);
  const [opsTotal, setOpsTotal] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const [a, n] = await Promise.all([getManagerAlerts(), getMyNotifications()]);
    if (a.ok) { setOps(a.items || []); setOpsTotal(a.total || 0); }
    if (n.ok) setNotes(n.items || []);
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const unread = notes.filter((n) => !n.is_read).length;
  const total = opsTotal + unread;

  async function openMenu() {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      await markAllNotificationsRead();
      setNotes((cur) => cur.map((n) => ({ ...n, is_read: true })));
    }
  }

  // Build the detail line for a persisted notification.
  function detailOf(n: any): string {
    if (n.type && n.type.startsWith("correction_")) {
      const ct = t("corr." + (CORR_KEY[n.title] || "typeMissing"));
      if (n.type === "correction_rejected") return n.message ? `${ct}: ${n.message}` : ct;
      if (n.type === "correction_pending") return n.message ? `${ct} · ${n.message}` : ct;
      return ct;
    }
    if (n.type && n.type.startsWith("doc_")) {
      const label = docLabel(n.title);
      if (n.type === "doc_rejected") return n.message ? `${label}: ${n.message}` : label;
      if (n.type === "doc_pending") return n.message ? `${label} · ${n.message}` : label;
      return label;
    }
    return n.message || "";   // phase-7 types carry human text in message
  }

  const hasAny = notes.length > 0 || ops.length > 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={openMenu} className="theme-btn" aria-label={t("notif.title")} style={{ position: "relative" }}>
        <Icon e="🔔" size={20} />
        {total > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: "#e74c3c", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxShadow: "0 0 0 2px var(--dark)" }}>
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: 46, width: 300, background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 200, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(128,128,128,0.15)", fontSize: 13, fontWeight: 700, color: "var(--white)" }}>
            {t("notif.title")}{total > 0 ? ` · ${total}` : ""}
          </div>

          {!loaded ? (
            <div style={{ padding: 22, textAlign: "center", color: "var(--gray)", fontSize: 13 }}>{t("notif.loading")}</div>
          ) : !hasAny ? (
            <div style={{ padding: 26, textAlign: "center", color: "var(--gray)", fontSize: 13 }}><Icon e="🎉" size={15} color="#58d68d" style={{ verticalAlign: "-2px", marginRight: 6 }} /> {t("notif.caughtUp")}</div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {/* personal notifications */}
              {notes.map((n) => {
                const meta = NOTIF[n.type] || { key: "notif.title", icon: "🔔", href: "/" };
                return (
                  <Link key={n.id} href={meta.href} onClick={() => setOpen(false)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 14px", borderBottom: "1px solid rgba(128,128,128,0.1)", textDecoration: "none" }}>
                    <Icon e={meta.icon} size={16} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: "var(--white)" }}>{t(meta.key)}</div>
                      <div style={{ fontSize: 11.5, color: "var(--gray)", marginTop: 1 }}>{detailOf(n)}</div>
                    </div>
                    {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--gold)", marginTop: 4, flexShrink: 0 }} />}
                  </Link>
                );
              })}

              {/* live ops alerts (managers) */}
              {ops.map((it, i) => {
                const meta = OPS[it.type] || { key: "notif.title", icon: "🔔", href: "/" };
                return (
                  <Link key={`ops-${i}`} href={meta.href} onClick={() => setOpen(false)}
                    style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderBottom: i < ops.length - 1 ? "1px solid rgba(128,128,128,0.1)" : "none", textDecoration: "none" }}>
                    <Icon e={meta.icon} size={16} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--white)" }}>{t(meta.key, { n: it.count })}</span>
                    <span style={{ color: "var(--gray)", fontSize: 16 }}>›</span>
                  </Link>
                );
              })}
            </div>
          )}
          <Link href="/notifications" onClick={() => setOpen(false)}
            style={{ display: "block", textAlign: "center", padding: "11px 14px", borderTop: "1px solid rgba(128,128,128,0.15)", color: "var(--gold)", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
            {t("notif.viewAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
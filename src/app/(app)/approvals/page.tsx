"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPendingApprovals, decideLeave, decideSwap } from "@/lib/queries/leave";
import { getAttendanceApprovals, setAttendanceApproval } from "@/lib/queries/live-attendance";
import { getCorrectionApprovals, decideCorrection } from "@/lib/queries/corrections";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";

type Kind = "leave" | "swap" | "attendance" | "correction";
type Item = { kind: Kind; id: string; icon: string; name: string; detail: string };
type Filter = "all" | Kind;

const fmtH = (m: number) => `${Math.floor((m || 0) / 60)}h ${String((m || 0) % 60).padStart(2, "0")}m`;
const fmtD = (d?: string | null) => (d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short" }) : "—");
const fmtT = (v?: string | null) => (v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

const CORR_KEY: Record<string, string> = { forgot_in: "typeForgotIn", forgot_out: "typeForgotOut", missing: "typeMissing", incorrect: "typeIncorrect" };

export default function ApprovalsPage() {
  const { t } = useLang();
  const dayLabel = (k: string) => (k && ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].includes(k.toLowerCase()) ? t("days." + k.toLowerCase()) : (k || "?"));
  const corrLabel = (k: string) => t("corr." + (CORR_KEY[k] || "typeMissing"));
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<Item | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setLoading(true);
    const [pa, att, corr] = await Promise.all([getPendingApprovals(), getAttendanceApprovals(), getCorrectionApprovals()]);
    if (!pa.ok && pa.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }

    const out: Item[] = [];
    for (const l of (pa.ok && pa.leave) || []) {
      out.push({ kind: "leave", id: l.id, icon: "🌴", name: (l as any).users?.full_name || t("approvals.someone"), detail: `${t("approvals.timeOff")} · ${fmtD(l.from_date)} → ${fmtD(l.to_date)}${l.reason ? ` · ${l.reason}` : ""}` });
    }
    for (const s of (pa.ok && pa.swaps) || []) {
      const other = (s as any).other?.full_name;
      out.push({ kind: "swap", id: s.id, icon: "🔄", name: (s as any).requester?.full_name || t("approvals.someone"), detail: `${t("approvals.swap")} · ${dayLabel(s.my_day)} ↔ ${dayLabel(s.their_day)}${other ? ` ${t("approvals.with")} ${other}` : ""}` });
    }
    for (const r of (att.ok && att.rows) || []) {
      out.push({ kind: "attendance", id: r.id, icon: "🕐", name: r.name, detail: `${fmtD(r.work_date)} · ${fmtH(r.duration_mins)}${r.late_mins > 0 ? ` · ${r.late_mins}${t("approvals.mLate")}` : ""}${r.overtime ? ` · ${t("approvals.overtime")}` : ""}` });
    }
    for (const c of (corr.ok && (corr as any).items) || []) {
      const req = `${fmtT(c.requested_clock_in)} → ${fmtT(c.requested_clock_out)}`;
      const orig = (c.origIn || c.origOut) ? ` (${t("corr.origWas")} ${fmtT(c.origIn)} → ${fmtT(c.origOut)})` : "";
      out.push({ kind: "correction", id: c.id, icon: "✏️", name: c.name, detail: `${corrLabel(c.type)} · ${fmtD(c.target_date)} · ${req}${orig} · ${c.reason}` });
    }
    setItems(out);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function remove(item: Item) {
    setItems((cur) => cur.filter((x) => !(x.kind === item.kind && x.id === item.id)));
  }

  async function decide(item: Item, approve: boolean) {
    // corrections reject opens a reason modal first
    if (item.kind === "correction" && !approve) { setRejectItem(item); setRejectReason(""); return; }
    setBusyId(item.kind + item.id);
    let res: { ok: boolean; error?: string };
    if (item.kind === "leave") res = await decideLeave(item.id, approve ? "approved" : "denied");
    else if (item.kind === "swap") res = await decideSwap(item.id, approve ? "approved" : "denied");
    else if (item.kind === "correction") res = await decideCorrection(item.id, true);
    else res = await setAttendanceApproval(item.id, approve ? "approved" : "rejected");
    setBusyId(null);
    if (res.ok) { remove(item); toast(approve ? t("approvals.approved") : t("approvals.rejected"), "success"); }
    else toast(res.error || t("approvals.actionFailed"), "error");
  }

  async function confirmReject() {
    if (!rejectItem) return;
    const item = rejectItem;
    setBusyId(item.kind + item.id);
    const res = await decideCorrection(item.id, false, rejectReason.trim() || undefined);
    setBusyId(null);
    setRejectItem(null);
    if (res.ok) { remove(item); toast(t("approvals.rejected"), "success"); }
    else toast(res.error || t("approvals.actionFailed"), "error");
  }

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const shown = items.filter((i) => filter === "all" || i.kind === filter);
  const count = (k: Kind) => items.filter((i) => i.kind === k).length;

  return (
    <div className="fade-up">
      <div className="page-title">✅ {t("approvals.title")}</div>
      <div className="page-sub">{t("approvals.subtitle")}</div>

      <div className="hub-tabs">
        <button className={`hub-tab${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>{t("approvals.tabAll")} {items.length > 0 ? `· ${items.length}` : ""}</button>
        <button className={`hub-tab${filter === "leave" ? " active" : ""}`} onClick={() => setFilter("leave")}>🌴 {t("approvals.tabLeave")} {count("leave") || ""}</button>
        <button className={`hub-tab${filter === "swap" ? " active" : ""}`} onClick={() => setFilter("swap")}>🔄 {t("approvals.tabSwaps")} {count("swap") || ""}</button>
        <button className={`hub-tab${filter === "attendance" ? " active" : ""}`} onClick={() => setFilter("attendance")}>🕐 {t("approvals.tabTime")} {count("attendance") || ""}</button>
        <button className={`hub-tab${filter === "correction" ? " active" : ""}`} onClick={() => setFilter("correction")}>✏️ {t("corr.inbox")} {count("correction") || ""}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : shown.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 34 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🎉</div>
          <div style={{ color: "#58d68d", fontSize: 15, fontWeight: 700 }}>{t("approvals.nothing")}</div>
          <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 6 }}>{t("approvals.caughtUp")}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((item) => {
            const busy = busyId === item.kind + item.id;
            return (
              <div key={item.kind + item.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "var(--gray)" }}>{item.detail}</div>
                </div>
                <button onClick={() => decide(item, true)} disabled={busy} style={{ padding: "8px 12px", background: "#1e6b3f", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>✓</button>
                <button onClick={() => decide(item, false)} disabled={busy} style={{ padding: "8px 12px", background: "var(--dark3)", color: "#ec7063", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>

      {/* Reject-with-reason modal (corrections) */}
      {rejectItem && (
        <div onClick={() => setRejectItem(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 420, width: "100%", padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--white)", marginBottom: 4 }}>{t("corr.rejectTitle")}</div>
            <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>{rejectItem.name} · {rejectItem.detail}</div>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder={t("corr.rejectPlaceholder")}
              style={{ width: "100%", padding: "10px 11px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 13, boxSizing: "border-box", resize: "vertical", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRejectItem(null)} style={{ flex: 1, padding: 11, background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--gray)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("corr.dismiss")}</button>
              <button onClick={confirmReject} style={{ flex: 1, padding: 11, background: "#a93226", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t("corr.confirmReject")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPendingApprovals, decideLeave, decideSwap } from "@/lib/queries/leave";
import { getAttendanceApprovals, setAttendanceApproval } from "@/lib/queries/live-attendance";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

type Kind = "leave" | "swap" | "attendance";
type Item = { kind: Kind; id: string; icon: string; name: string; detail: string };
type Filter = "all" | Kind;

const fmtH = (m: number) => `${Math.floor((m || 0) / 60)}h ${String((m || 0) % 60).padStart(2, "0")}m`;
const fmtD = (d?: string | null) => (d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short" }) : "—");

export default function ApprovalsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [pa, att] = await Promise.all([getPendingApprovals(), getAttendanceApprovals()]);
    if (!pa.ok && pa.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }

    const out: Item[] = [];
    for (const l of (pa.ok && pa.leave) || []) {
      out.push({ kind: "leave", id: l.id, icon: "🌴", name: (l as any).users?.full_name || "Someone", detail: `Time off · ${fmtD(l.from_date)} → ${fmtD(l.to_date)}${l.reason ? ` · ${l.reason}` : ""}` });
    }
    for (const s of (pa.ok && pa.swaps) || []) {
      const other = (s as any).other?.full_name;
      out.push({ kind: "swap", id: s.id, icon: "🔄", name: (s as any).requester?.full_name || "Someone", detail: `Swap · ${s.my_day || "?"} ↔ ${s.their_day || "?"}${other ? ` with ${other}` : ""}` });
    }
    for (const r of (att.ok && att.rows) || []) {
      out.push({ kind: "attendance", id: r.id, icon: "🕐", name: r.name, detail: `${fmtD(r.work_date)} · ${fmtH(r.duration_mins)}${r.late_mins > 0 ? ` · ${r.late_mins}m late` : ""}${r.overtime ? " · overtime" : ""}` });
    }
    setItems(out);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function decide(item: Item, approve: boolean) {
    setBusyId(item.kind + item.id);
    let res: { ok: boolean; error?: string };
    if (item.kind === "leave") res = await decideLeave(item.id, approve ? "approved" : "denied");
    else if (item.kind === "swap") res = await decideSwap(item.id, approve ? "approved" : "denied");
    else res = await setAttendanceApproval(item.id, approve ? "approved" : "rejected");
    setBusyId(null);
    if (res.ok) {
      setItems((cur) => cur.filter((x) => !(x.kind === item.kind && x.id === item.id)));
      toast(approve ? "Approved." : "Rejected.", "success");
    } else toast(res.error || "Action failed.", "error");
  }

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  const shown = items.filter((i) => filter === "all" || i.kind === filter);
  const count = (k: Kind) => items.filter((i) => i.kind === k).length;

  return (
    <div className="fade-up">
      <div className="page-title">✅ Approvals</div>
      <div className="page-sub">Everything needing your decision · one place</div>

      <div className="hub-tabs">
        <button className={`hub-tab${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>All {items.length > 0 ? `· ${items.length}` : ""}</button>
        <button className={`hub-tab${filter === "leave" ? " active" : ""}`} onClick={() => setFilter("leave")}>🌴 Leave {count("leave") || ""}</button>
        <button className={`hub-tab${filter === "swap" ? " active" : ""}`} onClick={() => setFilter("swap")}>🔄 Swaps {count("swap") || ""}</button>
        <button className={`hub-tab${filter === "attendance" ? " active" : ""}`} onClick={() => setFilter("attendance")}>🕐 Time {count("attendance") || ""}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : shown.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 34 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🎉</div>
          <div style={{ color: "#58d68d", fontSize: 15, fontWeight: 700 }}>Nothing to approve</div>
          <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 6 }}>You&apos;re all caught up.</div>
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

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>‹ Back to dashboard</Link>
    </div>
  );
}
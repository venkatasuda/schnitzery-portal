"use client";

import { useEffect, useState } from "react";
import { getPendingApprovals, decideLeave, decideSwap } from "@/lib/queries/leave";

export default function ApprovalsPage() {
  const [leave, setLeave] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await getPendingApprovals();
    if (!res.ok) {
      if (res.error?.includes("Managers")) setDenied(true);
      setLoading(false);
      return;
    }
    setLeave(res.leave);
    setSwaps(res.swaps);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleLeave(id: string, decision: "approved" | "denied") {
    setBusyId(id);
    const res = await decideLeave(id, decision);
    setBusyId(null);
    if (res.ok) { setMsg(`Leave ${decision}.`); load(); }
    else setMsg(res.error || "Failed.");
  }

  async function handleSwap(id: string, decision: "approved" | "denied") {
    setBusyId(id);
    const res = await decideSwap(id, decision);
    setBusyId(null);
    if (res.ok) { setMsg(`Swap ${decision}.`); load(); }
    else setMsg(res.error || "Failed.");
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short" }) : "—";

  if (denied) {
    return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>Only managers can view approvals.</div>;
  }

  const total = leave.length + swaps.length;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>✅ Approvals</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>
        {loading ? "Loading…" : total === 0 ? "Nothing pending — all caught up." : `${total} pending request${total !== 1 ? "s" : ""}`}
      </p>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

      {!loading && (
        <>
          {/* LEAVE */}
          {leave.length > 0 && (
            <>
              <SectionTitle>🌴 Leave Requests</SectionTitle>
              {leave.map((r) => (
                <div key={r.id} style={{ ...card, marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.users?.full_name || "Staff"}</div>
                  <div style={{ fontSize: 13, color: "#9a8f8f", margin: "4px 0" }}>
                    {fmtDate(r.from_date)} → {fmtDate(r.to_date)}{r.reason ? ` · ${r.reason}` : ""}
                  </div>
                  <DecisionButtons busy={busyId === r.id} onApprove={() => handleLeave(r.id, "approved")} onDeny={() => handleLeave(r.id, "denied")} />
                </div>
              ))}
            </>
          )}

          {/* SWAPS */}
          {swaps.length > 0 && (
            <>
              <SectionTitle>🔄 Shift Swaps</SectionTitle>
              {swaps.map((s) => (
                <div key={s.id} style={{ ...card, marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {s.requester?.full_name || "Staff"} ↔ {s.other?.full_name || "Colleague"}
                  </div>
                  <div style={{ fontSize: 13, color: "#9a8f8f", margin: "4px 0" }}>
                    Gives <b style={{ color: "#fff" }}>{s.my_day}</b>, wants <b style={{ color: "#fff" }}>{s.their_day}</b>
                  </div>
                  <DecisionButtons busy={busyId === s.id} onApprove={() => handleSwap(s.id, "approved")} onDeny={() => handleSwap(s.id, "denied")} />
                </div>
              ))}
            </>
          )}

          {total === 0 && (
            <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 40 }}>
              🎉<br />No pending requests.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: any) {
  return <div style={{ fontSize: 12, letterSpacing: 1, color: "#9a8f8f", margin: "16px 0 8px" }}>{children}</div>;
}
function DecisionButtons({ busy, onApprove, onDeny }: any) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <button onClick={onApprove} disabled={busy} style={{ flex: 1, padding: "10px", background: busy ? "#555" : "#27ae60", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>✓ Approve</button>
      <button onClick={onDeny} disabled={busy} style={{ flex: 1, padding: "10px", background: "transparent", color: "#ec7063", border: "1px solid rgba(231,76,60,0.4)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>✕ Deny</button>
    </div>
  );
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
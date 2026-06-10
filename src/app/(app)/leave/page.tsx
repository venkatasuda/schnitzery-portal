"use client";

import { useEffect, useState } from "react";
import { submitLeave, getMyLeave } from "@/lib/queries/leave";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

export default function LeavePage() {
  const [tab, setTab] = useState<"request" | "mine">("request");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadMine() {
    setLoading(true);
    const res = await getMyLeave();
    if (res.ok) setRequests(res.requests);
    setLoading(false);
  }

  useEffect(() => { loadMine(); }, []);

  async function submit() {
    setWorking(true);
    const res = await submitLeave(fromDate, toDate, reason);
    setWorking(false);
    if (res.ok) {
      toast("Leave request submitted", "success");
      setFromDate(""); setToDate(""); setReason("");
      loadMine();
    } else toast(res.error || "Failed to submit.", "error");
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const statusStyle = (s: string) => ({
    fontSize: 11, padding: "3px 10px", borderRadius: 12,
    background: s === "approved" ? "rgba(39,174,96,0.15)" : s === "denied" ? "rgba(231,76,60,0.15)" : "rgba(212,168,71,0.15)",
    color: s === "approved" ? "#58d68d" : s === "denied" ? "#ec7063" : "#d4a847",
  });

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>🌴 Time Off</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Request leave and track your requests.</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 }}>
        <TabBtn active={tab === "request"} onClick={() => setTab("request")}>Request Leave</TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => { setTab("mine"); loadMine(); }}>My Requests</TabBtn>
      </div>

      {tab === "request" && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Request Time Off</div>
          <Field label="From date">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={input} />
          </Field>
          <Field label="To date">
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={input} />
          </Field>
          <Field label="Reason (optional)">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Family event" rows={3} style={{ ...input, resize: "vertical" }} />
          </Field>
          <button onClick={submit} disabled={working} style={primaryBtn}>{working ? "Submitting…" : "Submit Request"}</button>
        </div>
      )}

      {tab === "mine" && (
        <div>
          {loading ? <CardSkeleton rows={3} />
          : requests.length === 0 ? <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>No leave requests yet.</div>
          : requests.map((r) => (
            <div key={r.id} style={{ ...card, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</div>
                <span style={statusStyle(r.status)}>{r.status}</span>
              </div>
              {r.reason && <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 6 }}>{r.reason}</div>}
              {r.decided_by && r.status !== "pending" && (
                <div style={{ fontSize: 11, color: "#6f6565", marginTop: 6 }}>Decided by {r.decided_by}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ flex: 1, padding: "9px", background: active ? "#d4a847" : "transparent", color: active ? "#1a0e0e" : "#9a8f8f", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
function Field({ label, children }: any) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, color: "#9a8f8f", marginBottom: 6 }}>{label}</label>{children}</div>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };
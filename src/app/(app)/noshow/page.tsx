"use client";

import { useEffect, useState } from "react";
import { getNoShows, getMissingAvailability, getNextWeekStart } from "@/lib/queries/availability";

export default function NoShowPage() {
  const [tab, setTab] = useState<"noshow" | "missing">("noshow");
  const [denied, setDenied] = useState(false);

  // no-show
  const [date, setDate] = useState("");
  const [noShows, setNoShows] = useState<any[]>([]);
  const [rosteredCount, setRosteredCount] = useState(0);
  const [nsChecked, setNsChecked] = useState(false);
  const [nsLoading, setNsLoading] = useState(false);

  // missing availability
  const [missing, setMissing] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState<any[]>([]);
  const [missLoading, setMissLoading] = useState(false);

  useEffect(() => {
    const d = new Date().toISOString().slice(0, 10);
    setDate(d);
  }, []);

  async function checkNoShows() {
    setNsLoading(true); setNsChecked(false);
    const res = await getNoShows(date);
    if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setNsLoading(false); return; }
    setNoShows(res.noShows); setRosteredCount(res.rosteredCount || 0); setNsChecked(true);
    setNsLoading(false);
  }

  async function loadMissing() {
    setMissLoading(true);
    const res = await getMissingAvailability();
    if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setMissLoading(false); return; }
    setMissing(res.missing); setSubmitted(res.submitted);
    setMissLoading(false);
  }

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>⚠️ Attendance Checks</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>No-shows and missing availability.</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 }}>
        <TabBtn active={tab === "noshow"} onClick={() => setTab("noshow")}>No-Shows</TabBtn>
        <TabBtn active={tab === "missing"} onClick={() => { setTab("missing"); loadMissing(); }}>Missing Availability</TabBtn>
      </div>

      {tab === "noshow" && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Check no-shows for a date</div>
          <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 12 }}>Who was rostered but didn&apos;t clock in.</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, flex: 1 }} />
            <button onClick={checkNoShows} disabled={nsLoading} style={{ ...primaryBtn, width: "auto", padding: "0 20px" }}>{nsLoading ? "…" : "Check"}</button>
          </div>
          {nsChecked && (
            rosteredCount === 0 ? (
              <div style={{ color: "#9a8f8f", fontSize: 13, textAlign: "center", padding: 16 }}>No one was rostered that day.</div>
            ) : noShows.length === 0 ? (
              <div style={{ color: "#58d68d", fontSize: 13, textAlign: "center", padding: 16 }}>🎉 Everyone rostered clocked in!</div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: "#ec7063", marginBottom: 8 }}>{noShows.length} of {rosteredCount} rostered did not clock in:</div>
                {noShows.map((n, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{n.name}</span>
                    <span style={{ fontSize: 12, color: "#9a8f8f" }}>{n.team} · {n.shift}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {tab === "missing" && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Missing availability — next week</div>
          <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 14 }}>Who hasn&apos;t submitted their availability yet.</div>
          {missLoading ? (
            <div style={{ color: "#9a8f8f", fontSize: 13, textAlign: "center", padding: 16 }}>Loading…</div>
          ) : (
            <>
              {missing.length === 0 ? (
                <div style={{ color: "#58d68d", fontSize: 13, textAlign: "center", padding: 16 }}>🎉 Everyone has submitted!</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "#ec7063", marginBottom: 8 }}>{missing.length} not submitted:</div>
                  {missing.map((m) => (
                    <div key={m.id} style={{ padding: "8px 0", fontSize: 14, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{m.full_name}</div>
                  ))}
                </>
              )}
              {submitted.length > 0 && (
                <div style={{ marginTop: 14, fontSize: 12, color: "#9a8f8f" }}>
                  ✅ Submitted: {submitted.map((s) => s.full_name).join(", ")}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ flex: 1, padding: "9px", background: active ? "#d4a847" : "transparent", color: active ? "#1a0e0e" : "#9a8f8f", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 };
const input: React.CSSProperties = { padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { padding: "12px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
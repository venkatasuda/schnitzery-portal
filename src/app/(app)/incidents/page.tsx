"use client";

import { useEffect, useState } from "react";
import { reportIncident, getIncidents, resolveIncident } from "@/lib/queries/operations";

const CATEGORIES = ["Safety", "Equipment", "Hygiene", "Customer", "Security", "Other"];
const SEVERITIES = ["low", "medium", "high"];
const SEV_COLOR: Record<string, string> = { low: "#3498db", medium: "#d4a847", high: "#e74c3c" };

export default function IncidentsPage() {
  const [list, setList] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // report form
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("Safety");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [posting, setPosting] = useState(false);

  // resolve
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  async function load() {
    setLoading(true);
    const res = await getIncidents();
    if (res.ok) { setList(res.incidents); setCanManage(res.canManage); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!description.trim()) { setMsg("Describe what happened."); return; }
    setPosting(true); setMsg(null);
    const res = await reportIncident(category, severity, description);
    setPosting(false);
    if (res.ok) { setMsg("✅ Incident reported."); setDescription(""); setCategory("Safety"); setSeverity("medium"); setShowForm(false); load(); }
    else setMsg(res.error || "Failed.");
  }

  async function doResolve(id: string) {
    const res = await resolveIncident(id, resolveNote);
    if (res.ok) { setResolveId(null); setResolveNote(""); load(); }
    else setMsg(res.error || "Failed.");
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>🚨 Incidents</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Report accidents, hazards & issues.</p>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

      <button onClick={() => setShowForm(!showForm)} style={{ ...primaryBtn, width: "100%", marginBottom: 14 }}>
        {showForm ? "Close" : "➕ Report an Incident"}
      </button>

      {showForm && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="Category"><select value={category} onChange={(e) => setCategory(e.target.value)} style={input}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field></div>
            <div style={{ flex: 1 }}><Field label="Severity"><select value={severity} onChange={(e) => setSeverity(e.target.value)} style={input}>{SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field></div>
          </div>
          <Field label="What happened?"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} placeholder="Describe the incident…" /></Field>
          <button onClick={submit} disabled={posting} style={primaryBtn}>{posting ? "Reporting…" : "Submit Report"}</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 40 }}>✅<br />No incidents reported.</div>
      ) : (
        list.map((inc) => (
          <div key={inc.id} style={{ ...card, marginBottom: 10, borderColor: inc.status === "open" ? "rgba(231,76,60,0.25)" : "rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: (SEV_COLOR[inc.severity] || "#666") + "26", color: SEV_COLOR[inc.severity] || "#aaa" }}>{(inc.severity || "").toUpperCase()}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{inc.category}</span>
              </div>
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: inc.status === "open" ? "rgba(231,76,60,0.15)" : "rgba(39,174,96,0.15)", color: inc.status === "open" ? "#ec7063" : "#58d68d" }}>{inc.status}</span>
            </div>
            <div style={{ fontSize: 14, color: "#e8e0e0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{inc.description}</div>
            <div style={{ fontSize: 11, color: "#6f6565", marginTop: 8 }}>
              {inc.reporter?.full_name || "Staff"} · {fmt(inc.created_at)}
              {inc.manager_note && <div style={{ color: "#58d68d", marginTop: 4 }}>✓ {inc.reviewed_by}: {inc.manager_note}</div>}
            </div>

            {canManage && inc.status === "open" && (
              resolveId === inc.id ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <input value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Resolution note (optional)" style={{ ...input, flex: 1 }} />
                  <button onClick={() => doResolve(inc.id)} style={{ ...primaryBtn, width: "auto", padding: "0 16px" }}>Resolve</button>
                  <button onClick={() => setResolveId(null)} style={{ ...primaryBtn, width: "auto", padding: "0 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>✕</button>
                </div>
              ) : (
                <button onClick={() => { setResolveId(inc.id); setResolveNote(""); }} style={{ ...primaryBtn, width: "auto", padding: "8px 16px", marginTop: 10 }}>Mark Resolved</button>
              )
            )}
          </div>
        ))
      )}
    </div>
  );
}

function Field({ label, children }: any) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, color: "#9a8f8f", marginBottom: 6 }}>{label}</label>{children}</div>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "12px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
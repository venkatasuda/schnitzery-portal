"use client";

import { useEffect, useState } from "react";
import { getAnnouncements, postAnnouncement, togglePin, deleteAnnouncement } from "@/lib/queries/announcements";

const CATEGORIES = ["General", "Urgent", "Schedule", "Policy", "Event"];
const CAT_COLORS: Record<string, string> = {
  General: "#3498db", Urgent: "#e74c3c", Schedule: "#27ae60", Policy: "#9b59b6", Event: "#d4a847",
};

export default function AnnouncementsPage() {
  const [list, setList] = useState<any[]>([]);
  const [canPost, setCanPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // post form
  const [showPost, setShowPost] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("General");
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await getAnnouncements();
    if (res.ok) { setList(res.announcements); setCanPost(res.canPost); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function post() {
    if (!message.trim()) { setMsg("Write a message first."); return; }
    setPosting(true); setMsg(null);
    const res = await postAnnouncement(title, message, category, pinned);
    setPosting(false);
    if (res.ok) {
      setMsg("✅ Posted!"); setTitle(""); setMessage(""); setCategory("General"); setPinned(false); setShowPost(false);
      load();
    } else setMsg(res.error || "Failed.");
  }

  async function pin(a: any) {
    setBusyId(a.id);
    await togglePin(a.id, !a.pinned);
    setBusyId(null);
    load();
  }

  async function del(id: string) {
    setBusyId(id);
    await deleteAnnouncement(id);
    setBusyId(null);
    load();
  }

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString([], { day: "2-digit", month: "short" });
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📣 Announcements</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>News and updates for the team.</p>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

      {canPost && (
        <>
          <button onClick={() => setShowPost(!showPost)} style={{ ...primaryBtn, width: "100%", marginBottom: 14 }}>
            {showPost ? "Close" : "✏️ Post Announcement"}
          </button>
          {showPost && (
            <div style={{ ...card, marginBottom: 16 }}>
              <Field label="Title (optional)"><input value={title} onChange={(e) => setTitle(e.target.value)} style={input} placeholder="e.g. Holiday hours" /></Field>
              <Field label="Message"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} placeholder="What do you want the team to know?" /></Field>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <Field label="Category">
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={input}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#9a8f8f", paddingBottom: 18, cursor: "pointer" }}>
                  <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 📌 Pin
                </label>
              </div>
              <button onClick={post} disabled={posting} style={primaryBtn}>{posting ? "Posting…" : "Post"}</button>
            </div>
          )}
        </>
      )}

      {loading ? (
        <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 40 }}>📭<br />No announcements yet.</div>
      ) : (
        list.map((a) => (
          <div key={a.id} style={{ ...card, marginBottom: 10, borderColor: a.pinned ? "rgba(212,168,71,0.35)" : "rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {a.pinned && <span style={{ fontSize: 12 }}>📌</span>}
                {a.category && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: "2px 8px", borderRadius: 10, background: (CAT_COLORS[a.category] || "#666") + "26", color: CAT_COLORS[a.category] || "#aaa" }}>{a.category.toUpperCase()}</span>}
                {a.title && <span style={{ fontSize: 15, fontWeight: 700 }}>{a.title}</span>}
              </div>
              <span style={{ fontSize: 11, color: "#6f6565", whiteSpace: "nowrap" }}>{fmtWhen(a.created_at)}</span>
            </div>
            <div style={{ fontSize: 14, color: "#e8e0e0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{a.message}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span style={{ fontSize: 11, color: "#9a8f8f" }}>— {a.author || "Manager"}</span>
              {canPost && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => pin(a)} disabled={busyId === a.id} style={miniBtn}>{a.pinned ? "Unpin" : "📌 Pin"}</button>
                  <button onClick={() => del(a.id)} disabled={busyId === a.id} style={{ ...miniBtn, color: "#ec7063" }}>Delete</button>
                </div>
              )}
            </div>
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
const primaryBtn: React.CSSProperties = { width: "100%", padding: "13px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
const miniBtn: React.CSSProperties = { padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#fff", fontSize: 12, cursor: "pointer" };
"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getStaffForNotes, addNote, getNotes } from "@/lib/queries/operations";

export default function NotesPage() {
  const { t } = useLang();
  const [notes, setNotes] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "recognition">("all");

  // add form
  const [userId, setUserId] = useState("");
  const [note, setNote] = useState("");
  const [isRec, setIsRec] = useState(false);
  const [posting, setPosting] = useState(false);

  async function load() {
    setLoading(true);
    const sRes = await getStaffForNotes();
    if (!sRes.ok) { if (sRes.error?.includes("Managers")) setDenied(true); setLoading(false); return; }
    setStaff(sRes.staff);
    const nRes = await getNotes();
    if (nRes.ok) setNotes(nRes.notes);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!userId || !note.trim()) { setMsg(t("notes.pickWrite")); return; }
    setPosting(true); setMsg(null);
    const res = await addNote(userId, note, isRec);
    setPosting(false);
    if (res.ok) { setMsg(t("notes.saved")); setNote(""); setUserId(""); setIsRec(false); load(); }
    else setMsg(res.error || t("notes.failed"));
  }

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const shown = tab === "recognition" ? notes.filter((n) => n.isRecognition) : notes;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short" });

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📝 {t("schedhub.notes")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>{t("notes.subtitle")}</p>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

      {/* add note */}
      <div style={{ ...card, marginBottom: 16 }}>
        <Field label={t("notes.staffMember")}>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} style={input}>
            <option value="">{t("roster.select")}</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
        <Field label={t("notes.note")}><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...input, resize: "vertical" }} placeholder={t("notes.whatHappened")} /></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9a8f8f", marginBottom: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={isRec} onChange={(e) => setIsRec(e.target.checked)} /> {t("notes.markRec")}
        </label>
        <button onClick={submit} disabled={posting} style={primaryBtn}>{posting ? t("common.saving") : t("notes.addNote")}</button>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 }}>
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>{t("notes.tabAll")}</TabBtn>
        <TabBtn active={tab === "recognition"} onClick={() => setTab("recognition")}>{t("notes.tabRec")}</TabBtn>
      </div>

      {loading ? <div style={{ color: "#9a8f8f", padding: 20, textAlign: "center" }}>{t("common.loading")}</div>
      : shown.length === 0 ? <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>{t("notes.empty")}</div>
      : shown.map((n) => (
        <div key={n.id} style={{ ...card, marginBottom: 8, borderColor: n.isRecognition ? "rgba(212,168,71,0.3)" : "rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{n.isRecognition && "🌟 "}{n.subject?.full_name || t("lc.staffFallback")}</span>
            <span style={{ fontSize: 11, color: "#6f6565" }}>{fmt(n.created_at)}</span>
          </div>
          <div style={{ fontSize: 14, color: "#e8e0e0", lineHeight: 1.5 }}>{n.cleanNote}</div>
        </div>
      ))}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ flex: 1, padding: "9px", background: active ? "#d4a847" : "transparent", color: active ? "#1a0e0e" : "#9a8f8f", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
function Field({ label, children }: any) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, color: "#9a8f8f", marginBottom: 6 }}>{label}</label>{children}</div>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "12px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
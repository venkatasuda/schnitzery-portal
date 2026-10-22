"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getStaffForNotes, addNote, getNotes } from "@/lib/queries/operations";
import { Field } from "@/components/ui";

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

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const shown = tab === "recognition" ? notes.filter((n) => n.isRecognition) : notes;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short" });

  return (
    <div className="workspace-page">
      <h1 className="page-title u-row"><Icon e="📝" size={22} /> {t("schedhub.notes")}</h1>
      <p className="ui-lede">{t("notes.subtitle")}</p>

      {msg && <div className="mb-4 t-sm tone-action u-center">{msg}</div>}

      {/* add note */}
      <div style={{ ...card, marginBottom: 16 }}>
        <Field label={t("notes.staffMember")}>
          <select className="form-input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">{t("roster.select")}</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
        <Field label={t("notes.note")}><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...input, resize: "vertical" }} placeholder={t("notes.whatHappened")} /></Field>
        <label className="d-flex ai-c gap-2 t-sm u-muted mb-3 c-p">
          <input type="checkbox" checked={isRec} onChange={(e) => setIsRec(e.target.checked)} /> {t("notes.markRec")}
        </label>
        <button className="btn-gold ui-block" onClick={submit} disabled={posting}>{posting ? t("common.saving") : t("notes.addNote")}</button>
      </div>

      {/* tabs */}
      <div className="ui-segmented" role="group">
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>{t("notes.tabAll")}</TabBtn>
        <TabBtn active={tab === "recognition"} onClick={() => setTab("recognition")}>{t("notes.tabRec")}</TabBtn>
      </div>

      {loading ? <div className="u-muted p-5 u-center">{t("common.loading")}</div>
      : shown.length === 0 ? <div className="card ui-empty-msg">{t("notes.empty")}</div>
      : shown.map((n) => (
        <div key={n.id} style={{ ...card, marginBottom: 8, borderColor: n.isRecognition ? "var(--accent-line)" : "rgba(255,255,255,0.08)" }}>
          <div className="d-flex jc-sb mb-1">
            <span className="ui-strong">{n.isRecognition && <Icon e="🌟" size={13} color="var(--action)" style={{ verticalAlign: "-2px", marginRight: 4 }} />}{n.subject?.full_name || t("lc.staffFallback")}</span>
            <span className="ui-muted">{fmt(n.created_at)}</span>
          </div>
          <div className="t-md u-text lh-15">{n.cleanNote}</div>
        </div>
      ))}
    </div>
  );
}

// Segmented switch: styling from .ui-segmented (docs/DESIGN-SYSTEM.md).
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick}>{children}</button>;
}
const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
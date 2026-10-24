"use client";

import { appLocale } from "@/lib/format";
import { useEffect, useState } from "react";
import { getAnnouncements, postAnnouncement, togglePin, deleteAnnouncement } from "@/lib/queries/announcements";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { Field } from "@/components/ui";

const CATEGORIES = ["General", "Urgent", "Schedule", "Policy", "Event"];
const CAT_COLORS: Record<string, string> = {
  General: "var(--info)", Urgent: "var(--danger)", Schedule: "var(--success)", Policy: "#9b59b6", Event: "var(--gold-ink)",
};

export default function AnnouncementsPage() {
  const { t } = useLang();
  const catLabel = (c: string) => (CATEGORIES.includes(c) ? t("annCat." + c) : c);
  const [list, setList] = useState<any[]>([]);
  const [canPost, setCanPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // post form
  const [showPost, setShowPost] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("General");
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  async function load() {
    // A failed request must end the skeleton and say so, not spin forever.
    try {
    setLoading(true);
    const res = await getAnnouncements();
    if (res.ok) { setList(res.announcements); setCanPost(res.canPost); }
    setLoading(false);
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function post() {
    if (!message.trim()) { toast(t("announcements.writeFirst"), "error"); return; }
    setPosting(true);
    const res = await postAnnouncement(title, message, category, pinned);
    setPosting(false);
    if (res.ok) {
      toast(t("announcements.posted"), "success"); setTitle(""); setMessage(""); setCategory("General"); setPinned(false); setShowPost(false);
      load();
    } else toast(res.error || t("announcements.failPost"), "error");
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
    if (diffH < 1) return t("announcements.justNow");
    if (diffH < 24) return t("announcements.hoursAgo", { h: diffH });
    return d.toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin", day: "2-digit", month: "short" });
  };

  return (
    <div className="workspace-page">
      <h1 className="page-title u-row"><Icon e="📣" size={22} /> {t("announcements.title")}</h1>
      <p className="ui-lede">{t("announcements.subtitle")}</p>

      {canPost && (
        <>
          <button onClick={() => setShowPost(!showPost)} style={{ ...primaryBtn, width: "100%", marginBottom: 14 }}>
            {showPost ? t("common.close") : t("announcements.postBtn")}
          </button>
          {showPost && (
            <div style={{ ...card, marginBottom: 16 }}>
              <Field label={t("announcements.titleLabel")}><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("announcements.titlePlaceholder")} /></Field>
              <Field label={t("announcements.messageLabel")}><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} placeholder={t("announcements.messagePlaceholder")} /></Field>
              <div className="d-flex gap-3 ai-e">
                <div className="u-flex1">
                  <Field label={t("announcements.categoryLabel")}>
                    <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
                    </select>
                  </Field>
                </div>
                <label className="d-flex ai-c gap-2 t-sm u-muted pb-5 c-p">
                  <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> {t("announcements.pin")}
                </label>
              </div>
              <button className="btn-gold ui-block" onClick={post} disabled={posting}>{posting ? t("announcements.posting") : t("announcements.post")}</button>
            </div>
          )}
        </>
      )}

      {loading ? (
        <CardSkeleton rows={3} />
      ) : list.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "var(--gray)", padding: 40 }}><Icon e="📭" size={30} color="var(--gray)" /><br />{t("announcements.empty")}</div>
      ) : (
        list.map((a) => (
          <div key={a.id} style={{ ...card, marginBottom: 10, borderColor: a.pinned ? "var(--accent-line)" : "rgba(255,255,255,0.08)" }}>
            <div className="d-flex jc-sb ai-s mb-2">
              <div className="d-flex ai-c gap-2 f-wrap">
                {a.pinned && <Icon e="📌" size={13} color="var(--gold)" />}
                {a.category && <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, padding: "2px 8px", borderRadius: 10, background: (CAT_COLORS[a.category] || "#666") + "26", color: CAT_COLORS[a.category] || "#aaa" }}>{catLabel(a.category).toUpperCase()}</span>}
                {a.title && <span className="t-lg fw-7">{a.title}</span>}
              </div>
              <span className="t-xs u-muted ws-nw">{fmtWhen(a.created_at)}</span>
            </div>
            <div style={{ fontSize: 14, color: "var(--white)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{a.message}</div>
            <div className="d-flex jc-sb ai-c mt-3">
              <span className="ui-muted">— {a.author || "Manager"}</span>
              {canPost && (
                <div className="u-hstack">
                  <button onClick={() => pin(a)} disabled={busyId === a.id} style={miniBtn}>{a.pinned ? t("announcements.unpin") : t("announcements.pin")}</button>
                  <button onClick={() => del(a.id)} disabled={busyId === a.id} style={{ ...miniBtn, color: "var(--danger)" }}>{t("common.delete")}</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "13px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
const miniBtn: React.CSSProperties = { padding: "6px 12px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--white)", fontSize: 12, cursor: "pointer" };
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadDocumentVersion, listMyDocuments, getDocumentUrl, archiveDocument } from "@/lib/queries/documents";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import NativeDialog from "@/components/NativeDialog";
import Icon from "@/components/Icon";

const DOC_TYPES = [
  { key: "id_card", icon: "🪪" },
  { key: "tax_id", icon: "🧾" },
  { key: "contract", icon: "📄" },
  { key: "health_certificate", icon: "🩺" },
  { key: "visa", icon: "🛂" },
  { key: "work_permit", icon: "💼" },
  { key: "training_certificate", icon: "📜" },
  { key: "certificate", icon: "🎓" },
  { key: "other", icon: "📁" },
];
const iconOf = (k: string) => DOC_TYPES.find((t) => t.key === k)?.icon || "📁";

type Tf = (k: string, v?: Record<string, string | number>) => string;

// Map an effective status to a coloured badge.
function statusBadge(eff: string, t: Tf): { label: string; color: string } {
  switch (eff) {
    case "approved":  return { label: t("docw.statusApproved"),  color: "#58d68d" };
    case "pending":   return { label: t("docw.statusPending"),   color: "#e8a35a" };
    case "rejected":  return { label: t("docw.statusRejected"),  color: "var(--danger)" };
    case "expiring":  return { label: t("docw.statusExpiring"),  color: "#e8a35a" };
    case "expired":   return { label: t("docw.statusExpired"),   color: "var(--danger)" };
    default:          return { label: t("docw.statusArchived"),  color: "var(--gray)" };
  }
}
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "";

export default function DocumentsSection() {
  const { t } = useLang();
  const docLabel = (k: string) => t("documents.type_" + (DOC_TYPES.some((x) => x.key === k) ? k : "other"));
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed,setLoadFailed]=useState(false);
  const [openHist, setOpenHist] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(false);
  const [stage, setStage] = useState<"type" | "details">("type");
  const [chosenType, setChosenType] = useState("other");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try { const res=await listMyDocuments(); if(!res.ok)throw Error(); setDocs(res.docs||[]); }
    catch {setDocs([]);setLoadFailed(true);}
    finally {setLoading(false);}
  }
  useEffect(() => { load(); }, []);

  function openSheet() { setStage("type"); setIssueDate(""); setExpiryDate(""); setSheet(true); }
  function pickType(k: string) { setChosenType(k); setStage("details"); }
  function toggleHist(k: string) {
    setOpenHist((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast(t("documents.tooBig"), "error"); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();
      const path = `${user.id}/${Date.now()}_${chosenType}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      const res = await uploadDocumentVersion(chosenType, path, file.name, issueDate, expiryDate);
      if (!res.ok) throw new Error(res.error || "Save failed");
      setSheet(false);
      toast(t("documents.uploaded"), "success");
      await load();
    } catch (e: any) {
      toast(t("documents.uploadFailed") + (e?.message || "unknown error"), "error");
    }
    setBusy(false);
  }

  async function view(filePath: string) {
    const res = await getDocumentUrl(filePath);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else toast(res.error || t("documents.couldNotOpen"), "error");
  }

  async function archive(id: string) {
    if (!confirm(t("docw.archiveConfirm"))) return;
    const res = await archiveDocument(id);
    if (res.ok) { toast(t("docw.archived"), "success"); await load(); }
    else toast(res.error || t("documents.deleteFailed"), "error");
  }

  // Group by doc_type; first of each group is the latest version.
  const groups: Record<string, any[]> = {};
  for (const d of docs) (groups[d.doc_type] ||= []).push(d);
  const groupKeys = Object.keys(groups);
  if(loadFailed)return <div role="alert" className="card"><p>{t("documents.loadFailed")}</p><button className="btn-secondary" onClick={load}>{t("business.retry")}</button></div>;

  return (
    <>
      <div className="doc-head">
        <div className="section-label u-m0">{t("documents.title")}</div>
        <button onClick={openSheet} className="doc-upload">{t("documents.upload")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={2} />
      ) : groupKeys.length === 0 ? (
        <div className="card ui-empty-msg">
          {t("documents.none")}<br />{t("documents.noneHint")}
        </div>
      ) : (
        <div className="d-flex f-col gap-3">
          {groupKeys.map((type) => {
            const versions = groups[type];
            const cur = versions[0];
            const badge = statusBadge(cur.eff, t);
            const older = versions.slice(1);
            const histOpen = openHist.has(type);
            return (
              <div key={type} className="card p-3">
                <div className="d-flex ai-c gap-3">
                  <span className="t-2xl">{iconOf(type)}</span>
                  <div className="u-grow">
                    <div className="ui-strong">{docLabel(type)}</div>
                    <div className="doc-meta u-ellipsis">{cur.file_name}</div>
                  </div>
                  <span className="doc-pill" style={{ color: badge.color }}>{badge.label}</span>
                </div>

                {cur.expiry_date && (
                  <div className="t-xs u-muted mt-2">
                    {t("documents.expires")}: {fmtDate(cur.expiry_date)}
                  </div>
                )}
                {cur.eff === "rejected" && cur.rejection_reason && (
                  <div className="doc-error" role="alert">
                    {t("docw.rejReasonLabel")} {cur.rejection_reason}
                  </div>
                )}

                <div className="d-flex gap-2 mt-3 ai-c">
                  <button onClick={() => view(cur.file_path)} className="doc-btn">{t("documents.view")}</button>
                  <button onClick={() => archive(cur.id)} className="doc-btn quiet">{t("docw.archive")}</button>
                  {older.length > 0 && (
                    <button onClick={() => toggleHist(type)} className="doc-btn quiet link">
                      {t("docw.versionHistory")} ({older.length}) {histOpen ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {histOpen && older.map((v) => {
                  const vb = statusBadge(v.eff, t);
                  return (
                    <div className="d-flex ai-c gap-3 mt-2 pt-2 bt-1" key={v.id}>
                      <div className="u-grow">
                        <div className="t-xs u-text">{t("docw.version", { n: v.version_no })} · <span style={{ color: vb.color }}>{vb.label}</span></div>
                        <div className="doc-meta">{t("docw.uploadedOn", { date: fmtDate(v.created_at) })}</div>
                      </div>
                      <button onClick={() => view(v.file_path)} className="doc-btn">{t("documents.view")}</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {sheet && (
        <NativeDialog title={t("documents.uploadTitle")} busy={busy} onClose={() => setSheet(false)}>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={onFile} className="ui-hidden" />

            {stage === "type" ? (
              <>
                <div className="doc-sheet-title">{t("documents.uploadTitle")}</div>
                <div className="t-xs u-muted mb-4">{t("documents.typeHint")}</div>
                {DOC_TYPES.map((dt) => (
                  <button key={dt.key} onClick={() => pickType(dt.key)} className="doc-type">
                    <span className="t-xl">{dt.icon}</span>
                    <span className="u-flex1 u-left t-md fw-6 u-text">{docLabel(dt.key)}</span>
                    <span className="u-muted">›</span>
                  </button>
                ))}
                <button onClick={() => setSheet(false)} className="ui-link-quiet">{t("common.cancel")}</button>
              </>
            ) : busy ? (
              <div className="ui-empty-msg" role="status"><div className="spinner mx-auto mb-3" />{t("documents.uploading")}</div>
            ) : (
              <>
                <div className="doc-sheet-title"><Icon e={iconOf(chosenType)} size={16} /> {docLabel(chosenType)}</div>
                <div className="t-xs u-muted mb-4">{t("documents.datesHint")}</div>
                <div className="d-flex gap-3 mb-3">
                  <label className="u-flex1">
                    <div className="ui-field-label">{t("documents.issued")}</div>
                    <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="form-input" />
                  </label>
                  <label className="u-flex1">
                    <div className="ui-field-label">{t("documents.expires")}</div>
                    <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="form-input" />
                  </label>
                </div>
                <button className="btn-gold ui-block" onClick={() => fileRef.current?.click()}>
                  {t("documents.chooseUpload")}
                </button>
                <button onClick={() => setStage("type")} className="ui-link-quiet">‹ {t("common.back")}</button>
              </>
            )}
        </NativeDialog>
      )}
    </>
  );
}


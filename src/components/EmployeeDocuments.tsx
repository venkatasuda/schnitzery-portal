"use client";

import { appLocale } from "@/lib/format";
import { useState, useEffect } from "react";
import { getRequiredChecklist, listEmployeeDocuments, approveDocument, rejectDocument, getDocumentUrl } from "@/lib/queries/documents";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import NativeDialog from "@/components/NativeDialog";

const ICON: Record<string, string> = {
  id_card: "🪪", tax_id: "🧾", contract: "📄", health_certificate: "🩺",
  visa: "🛂", work_permit: "💼", training_certificate: "📜", certificate: "🎓", other: "📁",
};
const iconOf = (k: string) => ICON[k] || "📁";

type Tf = (k: string, v?: Record<string, string | number>) => string;

function statusInfo(status: string, t: Tf): { label: string; color: string } {
  switch (status) {
    case "approved":  return { label: t("docw.statusApproved"),  color: "#58d68d" };
    case "pending":   return { label: t("docw.statusPending"),   color: "#e8a35a" };
    case "rejected":  return { label: t("docw.statusRejected"),  color: "var(--danger)" };
    case "expiring":  return { label: t("docw.statusExpiring"),  color: "#e8a35a" };
    case "expired":   return { label: t("docw.statusExpired"),   color: "var(--danger)" };
    case "missing":   return { label: t("docw.statusMissing"),   color: "var(--gray)" };
    default:          return { label: t("docw.statusArchived"),  color: "var(--gray)" };
  }
}
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin", day: "2-digit", month: "short", year: "numeric" }) : "";

export default function EmployeeDocuments({ userId }: { userId: string }) {
  const { t } = useLang();
  const docLabel = (k: string) => t("documents.type_" + (k in ICON ? k : "other"));
  const [items, setItems] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed,setLoadFailed]=useState(false);
  const [openHist, setOpenHist] = useState<Set<string>>(new Set());
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {const [cl,dl]=await Promise.all([getRequiredChecklist(userId),listEmployeeDocuments(userId)]);
      if(!cl.ok||!dl.ok)throw Error(); setItems(cl.items||[]);setDocs(dl.docs||[]);
    } catch {setItems([]);setDocs([]);setLoadFailed(true);}finally{setLoading(false);}
  }
  useEffect(() => { load(); }, [userId]);

  function toggleHist(k: string) {
    setOpenHist((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  async function view(fp: string) {
    const r = await getDocumentUrl(fp);
    if (r.ok && r.url) window.open(r.url, "_blank");
    else toast(r.error || t("documents.couldNotOpen"), "error");
  }
  async function approve(id: string) {
    setBusy(true);
    try {
    const r = await approveDocument(id);
    if (r.ok) { toast(t("docw.approved"), "success"); load(); }
    else toast(r.error || t("docw.approveFailed"), "error");
    } catch { toast(t("docw.approveFailed"), "error"); } finally { setBusy(false); }
  }
  async function doReject() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
    const r = await rejectDocument(rejectId!, reason);
    if (r.ok) { toast(t("docw.rejected"), "success"); setRejectId(null); setReason(""); load(); }
    else toast(r.error || t("docw.rejectFailed"), "error");
    } catch { toast(t("docw.rejectFailed"), "error"); } finally { setBusy(false); }
  }

  const groups: Record<string, any[]> = {};
  for (const d of docs) (groups[d.doc_type] ||= []).push(d);
  const groupKeys = Object.keys(groups);

  if(loadFailed)return <div role="alert" className="card"><p>{t("documents.loadFailed")}</p><button className="btn-secondary" onClick={load}>{t("business.retry")}</button></div>;
  if (loading) return <><div className="section-label">{t("docw.checklist")}</div><CardSkeleton rows={3} /></>;

  return (
    <>
      {/* REQUIRED-DOC CHECKLIST */}
      <div className="section-label">{t("docw.checklist")}</div>
      <div className="card p-2 mb-2">
        {items.map((it) => {
          const info = statusInfo(it.status, t);
          const color = it.status === "missing" && it.isRequired ? "#ec7063" : info.color;
          return (
            <div key={it.docType} className="doc-row">
              <span className="t-xl">{iconOf(it.docType)}</span>
              <div className="u-grow">
                <div className="t-sm fw-6 u-text">{docLabel(it.docType)}</div>
                <div className="doc-meta">{it.isRequired ? t("docw.required") : t("docw.optional")}</div>
              </div>
              <span className="doc-pill" style={{ color }}>{info.label}</span>
            </div>
          );
        })}
      </div>

      {/* DOCUMENTS + APPROVE/REJECT */}
      <div className="section-label">{t("staffd.documents")}</div>
      {groupKeys.length === 0 ? (
        <div className="card ui-empty-msg">{t("staffd.noDocuments")}</div>
      ) : (
        <div className="d-flex f-col gap-3">
          {groupKeys.map((type) => {
            const versions = groups[type];
            const cur = versions[0];
            const info = statusInfo(cur.eff, t);
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
                  <span className="doc-pill" style={{ color: info.color }}>{info.label}</span>
                </div>

                {cur.expiry_date && (
                  <div className="t-xs u-muted mt-2">{t("documents.expires")}: {fmtDate(cur.expiry_date)}</div>
                )}
                {cur.status === "rejected" && cur.rejection_reason && (
                  <div className="doc-error" role="alert">
                    {t("docw.rejReasonLabel")} {cur.rejection_reason}
                  </div>
                )}

                <div className="d-flex gap-2 mt-3 ai-c f-wrap">
                  <button onClick={() => view(cur.file_path)} className="doc-btn">{t("documents.view")}</button>
                  {cur.status === "pending" && (
                    <>
                      <button onClick={() => approve(cur.id)} disabled={busy} className="doc-btn approve">{t("docw.approve")}</button>
                      <button onClick={() => { setRejectId(cur.id); setReason(""); }} disabled={busy} className="doc-btn reject">{t("docw.reject")}</button>
                    </>
                  )}
                  {older.length > 0 && (
                    <button onClick={() => toggleHist(type)} className="doc-btn link">
                      {t("docw.versionHistory")} ({older.length}) {histOpen ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {histOpen && older.map((v) => {
                  const vb = statusInfo(v.eff, t);
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

      {/* REJECT REASON MODAL */}
      {rejectId && (
        <NativeDialog title={t("docw.rejectTitle")} busy={busy} onClose={() => setRejectId(null)}>
            <div className="t-lg fw-7 u-text mb-1">{t("docw.rejectTitle")}</div>
            <div className="ui-sub">{t("docw.rejectReason")}</div>
            <textarea className="form-input" autoFocus aria-label={t("docw.rejectReason")} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={t("docw.rejectReasonPlaceholder")}
              />
            <div className="d-flex gap-2 mt-4">
              <button disabled={busy} onClick={() => setRejectId(null)} className="doc-btn u-flex1">{t("common.cancel")}</button>
              <button onClick={doReject} disabled={busy || !reason.trim()} className="doc-btn reject u-flex1">{t("docw.confirmReject")}</button>
            </div>
        </NativeDialog>
      )}
    </>
  );
}


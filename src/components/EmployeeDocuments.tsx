"use client";

import { useState, useEffect } from "react";
import { getRequiredChecklist, listEmployeeDocuments, approveDocument, rejectDocument, getDocumentUrl } from "@/lib/queries/documents";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";

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
    case "rejected":  return { label: t("docw.statusRejected"),  color: "#ec7063" };
    case "expiring":  return { label: t("docw.statusExpiring"),  color: "#e8a35a" };
    case "expired":   return { label: t("docw.statusExpired"),   color: "#ec7063" };
    case "missing":   return { label: t("docw.statusMissing"),   color: "#9a8f8f" };
    default:          return { label: t("docw.statusArchived"),  color: "#9a8f8f" };
  }
}
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "";

export default function EmployeeDocuments({ userId }: { userId: string }) {
  const { t } = useLang();
  const docLabel = (k: string) => t("documents.type_" + (k in ICON ? k : "other"));
  const [items, setItems] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openHist, setOpenHist] = useState<Set<string>>(new Set());
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [cl, dl] = await Promise.all([getRequiredChecklist(userId), listEmployeeDocuments(userId)]);
    if (cl.ok) setItems(cl.items || []);
    if (dl.ok) setDocs(dl.docs || []);
    setLoading(false);
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
    const r = await approveDocument(id);
    setBusy(false);
    if (r.ok) { toast(t("docw.approved"), "success"); load(); }
    else toast(r.error || t("docw.approveFailed"), "error");
  }
  async function doReject() {
    if (!reason.trim()) return;
    setBusy(true);
    const r = await rejectDocument(rejectId!, reason);
    setBusy(false);
    if (r.ok) { toast(t("docw.rejected"), "success"); setRejectId(null); setReason(""); load(); }
    else toast(r.error || t("docw.rejectFailed"), "error");
  }

  const groups: Record<string, any[]> = {};
  for (const d of docs) (groups[d.doc_type] ||= []).push(d);
  const groupKeys = Object.keys(groups);

  if (loading) return <><div className="section-label">{t("docw.checklist")}</div><CardSkeleton rows={3} /></>;

  return (
    <>
      {/* REQUIRED-DOC CHECKLIST */}
      <div className="section-label">{t("docw.checklist")}</div>
      <div className="card" style={{ padding: 8, marginBottom: 6 }}>
        {items.map((it, i) => {
          const info = statusInfo(it.status, t);
          const color = it.status === "missing" && it.isRequired ? "#ec7063" : info.color;
          return (
            <div key={it.docType} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: i < items.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
              <span style={{ fontSize: 18 }}>{iconOf(it.docType)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{docLabel(it.docType)}</div>
                <div style={{ fontSize: 10, color: "var(--gray)" }}>{it.isRequired ? t("docw.required") : t("docw.optional")}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}22`, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{info.label}</span>
            </div>
          );
        })}
      </div>

      {/* DOCUMENTS + APPROVE/REJECT */}
      <div className="section-label">{t("staffd.documents")}</div>
      {groupKeys.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("staffd.noDocuments")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groupKeys.map((type) => {
            const versions = groups[type];
            const cur = versions[0];
            const info = statusInfo(cur.eff, t);
            const older = versions.slice(1);
            const histOpen = openHist.has(type);
            return (
              <div key={type} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{iconOf(type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{docLabel(type)}</div>
                    <div style={{ fontSize: 11, color: "var(--gray)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur.file_name}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: info.color, background: `${info.color}22`, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{info.label}</span>
                </div>

                {cur.expiry_date && (
                  <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8 }}>{t("documents.expires")}: {fmtDate(cur.expiry_date)}</div>
                )}
                {cur.status === "rejected" && cur.rejection_reason && (
                  <div style={{ fontSize: 12, color: "#ec7063", marginTop: 8, background: "rgba(236,112,99,0.1)", borderRadius: 8, padding: "8px 10px" }}>
                    {t("docw.rejReasonLabel")} {cur.rejection_reason}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => view(cur.file_path)} style={btn}>{t("documents.view")}</button>
                  {cur.status === "pending" && (
                    <>
                      <button onClick={() => approve(cur.id)} disabled={busy} style={{ ...btn, background: "#1e8449", borderColor: "#1e8449", color: "#fff" }}>{t("docw.approve")}</button>
                      <button onClick={() => { setRejectId(cur.id); setReason(""); }} disabled={busy} style={{ ...btn, background: "#922b21", borderColor: "#922b21", color: "#fff" }}>{t("docw.reject")}</button>
                    </>
                  )}
                  {older.length > 0 && (
                    <button onClick={() => toggleHist(type)} style={{ ...btn, marginLeft: "auto", color: "var(--gold)" }}>
                      {t("docw.versionHistory")} ({older.length}) {histOpen ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {histOpen && older.map((v) => {
                  const vb = statusInfo(v.eff, t);
                  return (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(128,128,128,0.12)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "var(--white)" }}>{t("docw.version", { n: v.version_no })} · <span style={{ color: vb.color }}>{vb.label}</span></div>
                        <div style={{ fontSize: 10, color: "var(--gray)" }}>{t("docw.uploadedOn", { date: fmtDate(v.created_at) })}</div>
                      </div>
                      <button onClick={() => view(v.file_path)} style={btn}>{t("documents.view")}</button>
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
        <div onClick={() => !busy && setRejectId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--dark2)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--white)", marginBottom: 4 }}>{t("docw.rejectTitle")}</div>
            <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>{t("docw.rejectReason")}</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={t("docw.rejectReasonPlaceholder")}
              style={{ width: "100%", padding: "10px 11px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setRejectId(null)} style={{ ...btn, flex: 1 }}>{t("common.cancel")}</button>
              <button onClick={doReject} disabled={busy || !reason.trim()} style={{ ...btn, flex: 1, background: "#922b21", borderColor: "#922b21", color: "#fff", opacity: !reason.trim() ? 0.5 : 1 }}>{t("docw.confirmReject")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const btn: React.CSSProperties = { padding: "7px 13px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, color: "var(--white)", fontSize: 12, fontWeight: 600, cursor: "pointer" };
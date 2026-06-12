"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadDocumentVersion, listMyDocuments, getDocumentUrl, archiveDocument } from "@/lib/queries/documents";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";

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
    case "rejected":  return { label: t("docw.statusRejected"),  color: "#ec7063" };
    case "expiring":  return { label: t("docw.statusExpiring"),  color: "#e8a35a" };
    case "expired":   return { label: t("docw.statusExpired"),   color: "#ec7063" };
    default:          return { label: t("docw.statusArchived"),  color: "#9a8f8f" };
  }
}
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "";

export default function DocumentsSection() {
  const { t } = useLang();
  const docLabel = (k: string) => t("documents.type_" + (DOC_TYPES.some((x) => x.key === k) ? k : "other"));
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    const res = await listMyDocuments();
    if (res.ok) setDocs(res.docs || []);
    setLoading(false);
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

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px" }}>
        <div className="section-label" style={{ margin: 0 }}>{t("documents.title")}</div>
        <button onClick={openSheet} style={uploadBtn}>{t("documents.upload")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={2} />
      ) : groupKeys.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13, lineHeight: 1.6 }}>
          {t("documents.none")}<br />{t("documents.noneHint")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groupKeys.map((type) => {
            const versions = groups[type];
            const cur = versions[0];
            const badge = statusBadge(cur.eff, t);
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
                  <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, background: `${badge.color}22`, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{badge.label}</span>
                </div>

                {cur.expiry_date && (
                  <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8 }}>
                    {t("documents.expires")}: {fmtDate(cur.expiry_date)}
                  </div>
                )}
                {cur.eff === "rejected" && cur.rejection_reason && (
                  <div style={{ fontSize: 12, color: "#ec7063", marginTop: 8, background: "rgba(236,112,99,0.1)", borderRadius: 8, padding: "8px 10px" }}>
                    {t("docw.rejReasonLabel")} {cur.rejection_reason}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                  <button onClick={() => view(cur.file_path)} style={viewBtn}>{t("documents.view")}</button>
                  <button onClick={() => archive(cur.id)} style={archiveBtn}>{t("docw.archive")}</button>
                  {older.length > 0 && (
                    <button onClick={() => toggleHist(type)} style={{ ...archiveBtn, marginLeft: "auto", color: "var(--gold)" }}>
                      {t("docw.versionHistory")} ({older.length}) {histOpen ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {histOpen && older.map((v) => {
                  const vb = statusBadge(v.eff, t);
                  return (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(128,128,128,0.12)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "var(--white)" }}>{t("docw.version", { n: v.version_no })} · <span style={{ color: vb.color }}>{vb.label}</span></div>
                        <div style={{ fontSize: 10, color: "var(--gray)" }}>{t("docw.uploadedOn", { date: fmtDate(v.created_at) })}</div>
                      </div>
                      <button onClick={() => view(v.file_path)} style={viewBtn}>{t("documents.view")}</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={onFile} style={{ display: "none" }} />

      {sheet && (
        <div onClick={() => !busy && setSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 820, background: "var(--dark2)", borderRadius: "18px 18px 0 0", padding: "10px 16px calc(20px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, background: "rgba(128,128,128,0.4)", borderRadius: 2, margin: "6px auto 14px" }} />

            {stage === "type" ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--white)" }}>{t("documents.uploadTitle")}</div>
                <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 14 }}>{t("documents.typeHint")}</div>
                {DOC_TYPES.map((dt) => (
                  <button key={dt.key} onClick={() => pickType(dt.key)} style={typeRow}>
                    <span style={{ fontSize: 20 }}>{dt.icon}</span>
                    <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{docLabel(dt.key)}</span>
                    <span style={{ color: "var(--gray)" }}>›</span>
                  </button>
                ))}
                <button onClick={() => setSheet(false)} style={cancelBtn}>{t("common.cancel")}</button>
              </>
            ) : busy ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--gray)", fontSize: 13 }}><div className="spinner" style={{ margin: "0 auto 10px" }} />{t("documents.uploading")}</div>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--white)" }}>{iconOf(chosenType)} {docLabel(chosenType)}</div>
                <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 14 }}>{t("documents.datesHint")}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={lbl}>{t("documents.issued")}</div>
                    <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} style={input} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={lbl}>{t("documents.expires")}</div>
                    <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={input} />
                  </div>
                </div>
                <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: 13, background: "var(--gold)", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {t("documents.chooseUpload")}
                </button>
                <button onClick={() => setStage("type")} style={cancelBtn}>‹ {t("common.back")}</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const uploadBtn: React.CSSProperties = { padding: "8px 16px", background: "var(--dark3)", border: "1px solid rgba(212,168,71,0.3)", borderRadius: 20, color: "var(--gold)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const viewBtn: React.CSSProperties = { padding: "6px 12px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 8, color: "var(--white)", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const archiveBtn: React.CSSProperties = { padding: "6px 12px", background: "none", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 8, color: "var(--gray)", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const typeRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 12px", marginBottom: 8, background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.15)", borderRadius: 12, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { width: "100%", padding: 12, marginTop: 8, background: "none", border: "none", color: "var(--gray)", fontSize: 14, cursor: "pointer" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
const input: React.CSSProperties = { width: "100%", padding: "10px 11px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 13 };
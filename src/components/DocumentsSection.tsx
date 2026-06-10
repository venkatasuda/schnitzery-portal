"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDocument, listMyDocuments, getDocumentUrl, deleteDocument } from "@/lib/queries/profile-uploads";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";

const DOC_TYPES = [
  { key: "id_card", label: "ID Card / Passport", icon: "🪪" },
  { key: "visa", label: "Visa / Residence Permit", icon: "🛂" },
  { key: "work_permit", label: "Work Permit", icon: "💼" },
  { key: "contract", label: "Contract", icon: "📄" },
  { key: "certificate", label: "Certificate", icon: "🎓" },
  { key: "other", label: "Other", icon: "📁" },
];
const iconOf = (k: string) => DOC_TYPES.find((t) => t.key === k)?.icon || "📁";

// Shared expiry-status helper (used here and on the staff detail page).
export function expiryStatus(expiry?: string | null): { label: string; color: string } | null {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, color: "#ec7063" };
  if (days <= 60) return { label: `Expires in ${days}d`, color: "#e8a35a" };
  return { label: `Valid until ${new Date(expiry).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}`, color: "#58d68d" };
}

export default function DocumentsSection() {
  const { t } = useLang();
  const docLabel = (k: string) => t("documents.type_" + (DOC_TYPES.some((x) => x.key === k) ? k : "other"));
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      const res = await addDocument(chosenType, path, file.name, issueDate, expiryDate);
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

  async function remove(id: string, filePath: string) {
    if (!confirm(t("documents.confirmDelete"))) return;
    const res = await deleteDocument(id, filePath);
    if (res.ok) { setDocs((d) => d.filter((x) => x.id !== id)); toast(t("documents.deleted"), "success"); }
    else toast(res.error || t("documents.deleteFailed"), "error");
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px" }}>
        <div className="section-label" style={{ margin: 0 }}>{t("documents.title")}</div>
        <button onClick={openSheet} style={uploadBtn}>{t("documents.upload")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={2} />
      ) : docs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13, lineHeight: 1.6 }}>
          {t("documents.none")}<br />{t("documents.noneHint")}
        </div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {docs.map((d, i) => {
            const st = expiryStatus(d.expiry_date);
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < docs.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                <span style={{ fontSize: 20 }}>{iconOf(d.doc_type)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{docLabel(d.doc_type)}</div>
                  <div style={{ fontSize: 11, color: "var(--gray)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.file_name}</div>
                  {st && <div style={{ fontSize: 11, color: st.color, fontWeight: 600, marginTop: 2 }}>{st.label}</div>}
                </div>
                <button onClick={() => view(d.file_path)} style={viewBtn}>{t("documents.view")}</button>
                <button onClick={() => remove(d.id, d.file_path)} style={{ background: "none", border: "none", color: "#ec7063", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={onFile} style={{ display: "none" }} />

      {sheet && (
        <div onClick={() => !busy && setSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 820, background: "var(--dark2)", borderRadius: "18px 18px 0 0", padding: "10px 16px calc(20px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}>
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
const typeRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 12px", marginBottom: 8, background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.15)", borderRadius: 12, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { width: "100%", padding: 12, marginTop: 8, background: "none", border: "none", color: "var(--gray)", fontSize: 14, cursor: "pointer" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
const input: React.CSSProperties = { width: "100%", padding: "10px 11px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 13 };
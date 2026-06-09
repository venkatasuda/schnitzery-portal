"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDocument, listMyDocuments, getDocumentUrl, deleteDocument } from "@/lib/queries/profile-uploads";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

const DOC_TYPES = [
  { key: "id_card", label: "ID Card / Passport", icon: "🪪" },
  { key: "visa", label: "Visa / Residence Permit", icon: "🛂" },
  { key: "work_permit", label: "Work Permit", icon: "💼" },
  { key: "contract", label: "Contract", icon: "📄" },
  { key: "certificate", label: "Certificate", icon: "🎓" },
  { key: "other", label: "Other", icon: "📁" },
];
const labelOf = (k: string) => DOC_TYPES.find((t) => t.key === k)?.label || "Document";
const iconOf = (k: string) => DOC_TYPES.find((t) => t.key === k)?.icon || "📁";

export default function DocumentsSection() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const typeRef = useRef<string>("other");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await listMyDocuments();
    if (res.ok) setDocs(res.docs || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function pickType(typeKey: string) {
    typeRef.current = typeKey;
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast("File must be under 5 MB.", "error"); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();
      const path = `${user.id}/${Date.now()}_${typeRef.current}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      const res = await addDocument(typeRef.current, path, file.name);
      if (!res.ok) throw new Error(res.error || "Save failed");
      setSheet(false);
      toast("Document uploaded.", "success");
      await load();
    } catch (e: any) {
      toast("Upload failed: " + (e?.message || "unknown error"), "error");
    }
    setBusy(false);
  }

  async function view(filePath: string) {
    const res = await getDocumentUrl(filePath);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else toast(res.error || "Could not open document.", "error");
  }

  async function remove(id: string, filePath: string) {
    if (!confirm("Delete this document?")) return;
    const res = await deleteDocument(id, filePath);
    if (res.ok) { setDocs((d) => d.filter((x) => x.id !== id)); toast("Document deleted.", "success"); }
    else toast(res.error || "Delete failed.", "error");
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px" }}>
        <div className="section-label" style={{ margin: 0 }}>My Documents</div>
        <button onClick={() => setSheet(true)} style={uploadBtn}>+ Upload</button>
      </div>

      {loading ? (
        <CardSkeleton rows={2} />
      ) : docs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13, lineHeight: 1.6 }}>
          No documents yet.<br />Tap <b style={{ color: "var(--gold)" }}>+ Upload</b> to add visa, ID, contract, etc.
        </div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {docs.map((d, i) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < docs.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
              <span style={{ fontSize: 20 }}>{iconOf(d.doc_type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{labelOf(d.doc_type)}</div>
                <div style={{ fontSize: 11, color: "var(--gray)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.file_name}</div>
              </div>
              <button onClick={() => view(d.file_path)} style={viewBtn}>View</button>
              <button onClick={() => remove(d.id, d.file_path)} style={{ background: "none", border: "none", color: "#ec7063", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={onFile} style={{ display: "none" }} />

      {sheet && (
        <div onClick={() => !busy && setSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 820, background: "var(--dark2)", borderRadius: "18px 18px 0 0", padding: "10px 16px calc(20px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ width: 40, height: 4, background: "rgba(128,128,128,0.4)", borderRadius: 2, margin: "6px auto 14px" }} />
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--white)" }}>Upload Document</div>
            <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 14 }}>Select the type — max 5 MB · PDF / JPG / PNG / HEIC</div>
            {busy ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--gray)", fontSize: 13 }}><div className="spinner" style={{ margin: "0 auto 10px" }} />Uploading…</div>
            ) : (
              DOC_TYPES.map((t) => (
                <button key={t.key} onClick={() => pickType(t.key)} style={typeRow}>
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{t.label}</span>
                  <span style={{ color: "var(--gray)" }}>›</span>
                </button>
              ))
            )}
            {!busy && <button onClick={() => setSheet(false)} style={{ width: "100%", padding: 12, marginTop: 8, background: "none", border: "none", color: "var(--gray)", fontSize: 14, cursor: "pointer" }}>Cancel</button>}
          </div>
        </div>
      )}
    </>
  );
}

const uploadBtn: React.CSSProperties = { padding: "8px 16px", background: "var(--dark3)", border: "1px solid rgba(212,168,71,0.3)", borderRadius: 20, color: "var(--gold)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const viewBtn: React.CSSProperties = { padding: "6px 12px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 8, color: "var(--white)", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const typeRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 12px", marginBottom: 8, background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.15)", borderRadius: 12, cursor: "pointer" };
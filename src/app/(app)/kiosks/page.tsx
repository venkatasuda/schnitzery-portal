"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { listKiosks, createKiosk, renameKiosk, setKioskActive } from "@/lib/queries/kiosks";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

export default function KiosksPage() {
  const { t } = useLang();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  async function load() {
    setLoading(true);
    const res = await listKiosks();
    if (!res.ok && res.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }
    if (res.ok) setItems(res.items || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!newLabel.trim()) return;
    setBusy(true);
    const res = await createKiosk(newLabel);
    setBusy(false);
    if (res.ok) { setNewLabel(""); toast(t("kioskadm.added"), "success"); load(); }
    else toast(res.error || t("kioskadm.addFailed"), "error");
  }
  async function toggle(k: any) {
    const res = await setKioskActive(k.id, !k.is_active);
    if (res.ok) load(); else toast(res.error || t("kioskadm.addFailed"), "error");
  }
  async function saveName(id: string) {
    const res = await renameKiosk(id, editLabel);
    setEditId(null);
    if (res.ok) { toast(t("kioskadm.saved"), "success"); load(); }
    else toast(res.error || t("kioskadm.addFailed"), "error");
  }

  if (denied) return <div className="card ui-denied">{t("kioskadm.denied")}</div>;

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🖥️" size={22} /> {t("kioskadm.title")}</h1>
      <div className="page-sub">{t("kioskadm.subtitle")}</div>

      {/* add */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input aria-label={t("kioskadm.addPlaceholder")} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t("kioskadm.addPlaceholder")}
          style={{ flex: 1, padding: "11px 12px", background: "var(--dark3)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--white)", fontSize: 13, boxSizing: "border-box" }} />
        <button onClick={add} disabled={busy || !newLabel.trim()} style={{ padding: "11px 16px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy || !newLabel.trim() ? 0.6 : 1, whiteSpace: "nowrap" }}>{t("kioskadm.add")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : items.length === 0 ? (
        <div className="card ui-empty-msg">{t("kioskadm.none")}</div>
      ) : (
        <div className="u-stack">
          {items.map((k) => (
            <div key={k.id} className="card" style={{ padding: 12, opacity: k.is_active ? 1 : 0.6 }}>
              <div className="u-row">
                <div className="u-grow">
                  {editId === k.id ? (
                    <input aria-label={t("kioskadm.addPlaceholder")} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onBlur={() => saveName(k.id)} onKeyDown={(e) => e.key === "Enter" && saveName(k.id)} autoFocus
                      style={{ width: "100%", padding: "6px 8px", background: "var(--dark3)", border: "1px solid var(--gold)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" }} />
                  ) : (
                    <button type="button" onClick={() => { setEditId(k.id); setEditLabel(k.label); }} aria-label={`${t("common.edit")}: ${k.label}`} style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", cursor: "pointer", background: "none", border: 0, padding: 0, textAlign: "left" }}>{k.label}</button>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: k.is_active ? "var(--success)" : "var(--gray)", background: k.is_active ? "rgba(88,214,141,0.15)" : "rgba(128,128,128,0.12)", padding: "3px 9px", borderRadius: 20 }}>
                  {k.is_active ? t("kioskadm.active") : t("kioskadm.inactive")}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <a href={`/kiosk?k=${k.id}`} target="_blank" rel="noreferrer" style={btn}>{t("kioskadm.openDisplay")}</a>
                <button onClick={() => toggle(k)} style={{ ...btn, color: k.is_active ? "var(--danger)" : "var(--success)", borderColor: k.is_active ? "rgba(236,112,99,0.3)" : "rgba(88,214,141,0.3)" }}>
                  {k.is_active ? t("kioskadm.deactivate") : t("kioskadm.activate")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: "var(--gray)", marginTop: 14, lineHeight: 1.5 }}><Icon className="u-icon-inline" e="💡" size={13} /> {t("kioskadm.revokeHint")}</div>
      <Link href="/schedule-hub" style={{ display: "block", textAlign: "center", marginTop: 14, color: "var(--action)", fontSize: 13, textDecoration: "none" }}>← {t("schedhub.title")}</Link>
    </div>
  );
}

const btn: React.CSSProperties = { flex: 1, textAlign: "center", padding: "8px 10px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 12.5, fontWeight: 600, textDecoration: "none", cursor: "pointer" };
"use client";

import { useEffect, useState } from "react";
import { reportIncident, getIncidents, resolveIncident } from "@/lib/queries/operations";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

const CATEGORIES = ["Safety", "Equipment", "Hygiene", "Customer", "Security", "Other"];
const SEVERITIES = ["low", "medium", "high"];
const SEV_COLOR: Record<string, string> = { low: "#3498db", medium: "#d4a847", high: "#e74c3c" };

export default function IncidentsPage() {
  const { t } = useLang();
  const catLabel = (c: string) => (CATEGORIES.includes(c) ? t("incCat." + c) : c);
  const sevLabel = (sv: string) => (SEVERITIES.includes(sv) ? t("incSev." + sv) : sv);
  const statusLabel = (st: string) => (["open", "resolved"].includes(st) ? t("incStatus." + st) : st);
  const [list, setList] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  // report form
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("Safety");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [posting, setPosting] = useState(false);

  // resolve
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  async function load() {
    setLoading(true);
    const res = await getIncidents();
    if (res.ok) { setList(res.incidents); setCanManage(res.canManage); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!description.trim()) { toast(t("incidents.describeFirst"), "error"); return; }
    setPosting(true);
    const res = await reportIncident(category, severity, description);
    setPosting(false);
    if (res.ok) { toast(t("incidents.reported"), "success"); setDescription(""); setCategory("Safety"); setSeverity("medium"); setShowForm(false); load(); }
    else toast(res.error || t("incidents.failReport"), "error");
  }

  async function doResolve(id: string) {
    const res = await resolveIncident(id, resolveNote);
    if (res.ok) { toast(t("incidents.resolved"), "success"); setResolveId(null); setResolveNote(""); load(); }
    else toast(res.error || t("incidents.failResolve"), "error");
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="🚨" size={22} /> {t("incidents.title")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>{t("incidents.subtitle")}</p>

      <button onClick={() => setShowForm(!showForm)} style={{ ...primaryBtn, width: "100%", marginBottom: 14 }}>
        {showForm ? t("common.close") : t("incidents.reportBtn")}
      </button>

      {showForm && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label={t("incidents.category")}><select value={category} onChange={(e) => setCategory(e.target.value)} style={input}>{CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</select></Field></div>
            <div style={{ flex: 1 }}><Field label={t("incidents.severity")}><select value={severity} onChange={(e) => setSeverity(e.target.value)} style={input}>{SEVERITIES.map((s) => <option key={s} value={s}>{sevLabel(s)}</option>)}</select></Field></div>
          </div>
          <Field label={t("incidents.whatHappened")}><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} placeholder={t("incidents.descPlaceholder")} /></Field>
          <button onClick={submit} disabled={posting} style={primaryBtn}>{posting ? t("incidents.reporting") : t("incidents.submitReport")}</button>
        </div>
      )}

      {loading ? (
        <CardSkeleton rows={3} />
      ) : list.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 40 }}><Icon e="✅" size={30} color="#9a8f8f" /><br />{t("incidents.empty")}</div>
      ) : (
        list.map((inc) => (
          <div key={inc.id} style={{ ...card, marginBottom: 10, borderColor: inc.status === "open" ? "rgba(231,76,60,0.25)" : "rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: (SEV_COLOR[inc.severity] || "#666") + "26", color: SEV_COLOR[inc.severity] || "#aaa" }}>{sevLabel(inc.severity || "").toUpperCase()}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{catLabel(inc.category)}</span>
              </div>
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: inc.status === "open" ? "rgba(231,76,60,0.15)" : "rgba(39,174,96,0.15)", color: inc.status === "open" ? "#ec7063" : "#58d68d" }}>{statusLabel(inc.status)}</span>
            </div>
            <div style={{ fontSize: 14, color: "#e8e0e0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{inc.description}</div>
            <div style={{ fontSize: 11, color: "#6f6565", marginTop: 8 }}>
              {inc.reporter?.full_name || t("incidents.reporterFallback")} · {fmt(inc.created_at)}
              {inc.manager_note && <div style={{ color: "#58d68d", marginTop: 4 }}><Icon e="✓" size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} /> {inc.reviewed_by}: {inc.manager_note}</div>}
            </div>

            {canManage && inc.status === "open" && (
              resolveId === inc.id ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <input value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder={t("incidents.resolveNotePlaceholder")} style={{ ...input, flex: 1 }} />
                  <button onClick={() => doResolve(inc.id)} style={{ ...primaryBtn, width: "auto", padding: "0 16px" }}>{t("incidents.resolve")}</button>
                  <button onClick={() => setResolveId(null)} style={{ ...primaryBtn, width: "auto", padding: "0 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}><Icon e="✕" size={15} /></button>
                </div>
              ) : (
                <button onClick={() => { setResolveId(inc.id); setResolveNote(""); }} style={{ ...primaryBtn, width: "auto", padding: "8px 16px", marginTop: 10 }}>{t("incidents.markResolved")}</button>
              )
            )}
          </div>
        ))
      )}
    </div>
  );
}

function Field({ label, children }: any) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, color: "#9a8f8f", marginBottom: 6 }}>{label}</label>{children}</div>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "12px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
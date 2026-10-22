"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getBranchSettings, saveBranchSettings } from "@/lib/queries/admin";

export default function SettingsPage() {
  const { t } = useLang();
  const [qrRequired, setQrRequired] = useState(false);
  const [gpsMode, setGpsMode] = useState("off");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setLoadError(null); setDenied(false);
    try {
      const res = await getBranchSettings();
      if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); else setLoadError(res.error || t("set.failed")); return; }
      setQrRequired(!!res.settings.qr_required);
      setGpsMode(res.settings.gps_mode || "off");
    } catch { setLoadError(t("staff.networkErr")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await saveBranchSettings(qrRequired, gpsMode);
      setMsg(res.ok ? t("set.saved") : res.error || t("set.failed"));
    } catch { setMsg(t("staff.networkErr")); }
    finally { setSaving(false); }
  }

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  return (
    <div className="workspace-page settings-workspace">
      <h1 className="page-title u-row"><Icon e="⚙️" size={22} /> {t("profile.branchSettings")}</h1>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 18 }}>{t("set.subtitle")}</p>

      {loading ? (
        <div style={{ color: "var(--gray)", padding: 30, textAlign: "center" }}>{t("common.loading")}</div>
      ) : loadError ? (
        <div className="card" role="alert"><p>{loadError}</p><button className="workspace-button" onClick={load}>{t("business.retry")}</button></div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: 12 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <div className="ui-strong">{t("set.qrTitle")}</div>
                <div className="ui-meta">{t("set.qrSub")}</div>
              </div>
              <input type="checkbox" checked={qrRequired} onChange={(e) => setQrRequired(e.target.checked)} style={{ width: 20, height: 20 }} />
            </label>
          </div>

          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t("set.gpsTitle")}</div>
            <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 10 }}>{t("set.gpsSub")}</div>
            <select aria-label={t("set.gpsTitle")} value={gpsMode} onChange={(e) => setGpsMode(e.target.value)} style={input}>
              <option value="off">{t("set.gpsOff")}</option>
              <option value="warn">{t("set.gpsWarn")}</option>
              <option value="required">{t("set.gpsRequired")}</option>
            </select>
          </div>

          <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? t("common.saving") : t("set.save")}</button>
          {msg && <div role="status" style={{ marginTop: 12, fontSize: 14, color: "var(--white)" }}>{msg}</div>}

          <div style={{ ...card, marginTop: 16, fontSize: 12, color: "var(--gray)" }}>
            {t("set.note")}
          </div>

          <div style={{ marginTop: 20, marginBottom: 8, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--gray)", textTransform: "uppercase" }}>{t("set.devicesLocation")}</div>
          <Link href="/kiosks" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#34495e,#5d6d7e)" }}><Icon e="🖥️" size={22} color="#fff" /></div>
            <div className="u-flex1"><div className="feature-title">{t("kioskadm.title")}</div><div className="feature-sub">{t("kioskadm.subtitle")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <Link href="/geofence" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1e6091,#2980b9)" }}><Icon e="📍" size={22} color="#fff" /></div>
            <div className="u-flex1"><div className="feature-title">{t("geo.title")}</div><div className="feature-sub">{t("geo.subtitle")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
        </>
      )}
    </div>
  );
}
const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };

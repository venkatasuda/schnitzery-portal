"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getBranchSettings, saveBranchSettings } from "@/lib/queries/admin";

export default function SettingsPage() {
  const { t } = useLang();
  const [qrRequired, setQrRequired] = useState(false);
  const [gpsMode, setGpsMode] = useState("off");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getBranchSettings();
      if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setLoading(false); return; }
      setQrRequired(!!res.settings.qr_required);
      setGpsMode(res.settings.gps_mode || "off");
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true); setMsg(null);
    const res = await saveBranchSettings(qrRequired, gpsMode);
    setSaving(false);
    setMsg(res.ok ? t("set.saved") : res.error || t("set.failed"));
  }

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>⚙️ {t("profile.branchSettings")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 18 }}>{t("set.subtitle")}</p>

      {loading ? (
        <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>{t("common.loading")}</div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: 12 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t("set.qrTitle")}</div>
                <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 2 }}>{t("set.qrSub")}</div>
              </div>
              <input type="checkbox" checked={qrRequired} onChange={(e) => setQrRequired(e.target.checked)} style={{ width: 20, height: 20 }} />
            </label>
          </div>

          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t("set.gpsTitle")}</div>
            <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 10 }}>{t("set.gpsSub")}</div>
            <select value={gpsMode} onChange={(e) => setGpsMode(e.target.value)} style={input}>
              <option value="off">{t("set.gpsOff")}</option>
              <option value="warn">{t("set.gpsWarn")}</option>
              <option value="required">{t("set.gpsRequired")}</option>
            </select>
          </div>

          <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? t("common.saving") : t("set.save")}</button>
          {msg && <div style={{ marginTop: 12, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

          <div style={{ ...card, marginTop: 16, fontSize: 12, color: "#6f6565" }}>
            {t("set.note")}
          </div>
        </>
      )}
    </div>
  );
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };
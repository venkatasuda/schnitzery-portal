"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getGeofence, setGeofence, listBranchStaff, grantOverride, getLocationFlags, type GeofenceMode } from "@/lib/queries/geofence";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

type Staff = { id: string; full_name: string; role: string };

export default function GeofencePage() {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(150);
  const [mode, setMode] = useState<GeofenceMode>("off");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [ovUser, setOvUser] = useState("");
  const [ovMin, setOvMin] = useState(15);
  const [ovBusy, setOvBusy] = useState(false);
  const [flags, setFlags] = useState<{ id: string; name: string; date: string; maxDistanceM: number }[]>([]);

  async function load() {
    setLoading(true);
    const res = await getGeofence();
    if (res.ok) {
      setCanEdit(res.canEdit); setBranchName(res.branchName);
      setLat(res.lat); setLng(res.lng); setRadius(res.radius); setMode(res.mode);
      if (res.canEdit) {
        const s = await listBranchStaff();
        if (s.ok) setStaff(s.staff);
        const f = await getLocationFlags();
        if (f.ok) setFlags(f.flags);
      }
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) { toast(t("geo.noGps"), "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(Number(pos.coords.latitude.toFixed(6))); setLng(Number(pos.coords.longitude.toFixed(6))); setLocating(false); toast(t("geo.located"), "success"); },
      () => { setLocating(false); toast(t("geo.locateFailed"), "error"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function save() {
    if (mode !== "off" && (lat == null || lng == null)) { toast(t("geo.needLocation"), "error"); return; }
    setSaving(true);
    const res = await setGeofence({ lat, lng, radius, mode });
    setSaving(false);
    if (res.ok) toast(t("geo.saved"), "success"); else toast(res.error || t("geo.saveFailed"), "error");
  }

  async function doGrant() {
    if (!ovUser) { toast(t("geo.pickStaff"), "error"); return; }
    setOvBusy(true);
    const res = await grantOverride(ovUser, ovMin);
    setOvBusy(false);
    if (res.ok) toast(t("geo.overrideGranted").replace("{min}", String(res.expiresInMin)), "success");
    else toast(res.error || t("geo.saveFailed"), "error");
  }

  const modes: { key: GeofenceMode; label: string; hint: string }[] = [
    { key: "off", label: t("geo.modeOff"), hint: t("geo.modeOffHint") },
    { key: "warn", label: t("geo.modeWarn"), hint: t("geo.modeWarnHint") },
    { key: "required", label: t("geo.modeRequired"), hint: t("geo.modeRequiredHint") },
  ];

  if (loading) return <div className="fade-up"><h1 className="page-title u-row"><Icon e="📍" size={22} /> {t("geo.title")}</h1><CardSkeleton rows={4} /></div>;

  if (!canEdit) return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="📍" size={22} /> {t("geo.title")}</h1>
      <div className="page-sub">{t("geo.subtitle")}</div>
      <div className="card p-4">{t("geo.managersOnly")}</div>
    </div>
  );

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--dark2)", color: "var(--white)", fontSize: 14 };

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="📍" size={22} /> {t("geo.title")}</h1>
      <div className="page-sub">{branchName} · {t("geo.subtitle")}</div>

      {/* MODE */}
      <div className="section-label">{t("geo.modeLabel")}</div>
      <div className="d-flex f-col gap-2 mb-5">
        {modes.map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)} className="card"
            style={{ padding: 12, textAlign: "left", cursor: "pointer",
              border: mode === m.key ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 600, color: mode === m.key ? "var(--gold)" : "var(--white)" }}>{m.label}</div>
            <div className="ui-meta">{m.hint}</div>
          </button>
        ))}
      </div>

      {/* LOCATION */}
      <div className="section-label">{t("geo.locationLabel")}</div>
      <div className="card p-4 mb-5">
        <button onClick={useMyLocation} disabled={locating} style={{ ...input, cursor: "pointer", background: "linear-gradient(135deg,#1e6091,#2980b9)", border: "none", fontWeight: 600, marginBottom: 12 }}>
          {locating ? t("geo.locating") : t("geo.useMyLocation")}
        </button>
        <div className="d-flex gap-2 mb-3">
          <div className="u-flex1">
            <div className="t-xs u-muted mb-1">{t("geo.lat")}</div>
            <input className="form-input" aria-label={t("geo.lat")} value={lat ?? ""} onChange={(e) => setLat(e.target.value === "" ? null : Number(e.target.value))} placeholder="48.7758" />
          </div>
          <div className="u-flex1">
            <div className="t-xs u-muted mb-1">{t("geo.lng")}</div>
            <input className="form-input" aria-label={t("geo.lng")} value={lng ?? ""} onChange={(e) => setLng(e.target.value === "" ? null : Number(e.target.value))} placeholder="9.1829" />
          </div>
        </div>
        <div className="t-xs u-muted mb-1">{t("geo.radius")}</div>
        <input className="form-input" aria-label={t("geo.radius")} type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value) || 0)} />
        {lat != null && lng != null && (
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
             style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--gold)", textDecoration: "none" }}>
            {t("geo.viewOnMap")} ↗
          </a>
        )}
      </div>

      <button className="btn-gold" onClick={save} disabled={saving}>
        {saving ? "…" : t("geo.save")}
      </button>

      {/* OVERRIDE */}
      <div className="section-label">{t("geo.overrideLabel")}</div>
      <div className="card p-4">
        <div className="ui-sub">{t("geo.overrideHint")}</div>
        <select aria-label={t("geo.pickStaff")} style={{ ...input, marginBottom: 10 }} value={ovUser} onChange={(e) => setOvUser(e.target.value)}>
          <option value="">{t("geo.pickStaff")}</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <div className="d-flex gap-2 ai-e">
          <div style={{ width: 110 }}>
            <div className="t-xs u-muted mb-1">{t("geo.minutes")}</div>
            <input className="form-input" aria-label={t("geo.minutes")} type="number" value={ovMin} onChange={(e) => setOvMin(Math.max(1, Math.min(240, Number(e.target.value) || 15)))} />
          </div>
          <button onClick={doGrant} disabled={ovBusy} style={{ ...input, flex: 1, cursor: "pointer", background: "linear-gradient(135deg,#b9770e,#e67e22)", border: "none", fontWeight: 600 }}>
            {ovBusy ? "…" : t("geo.grant")}
          </button>
        </div>
      </div>

      {/* RECENT LOCATION FLAGS */}
      <div className="section-label" style={{ marginTop: 26 }}>{t("geo.flagsLabel")}</div>
      <div className="card p-4">
        <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: flags.length ? 10 : 0 }}>{t("geo.flagsHint")}</div>
        {flags.length === 0 ? (
          <div className="ui-muted-md">{t("geo.noFlags")}</div>
        ) : (
          <div className="u-stack">
            {flags.map((f) => (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "var(--dark2)" }}>
                <div>
                  <div className="fw-6 t-md">{f.name}</div>
                  <div className="ui-muted">{f.date}</div>
                </div>
                <div className="t-sm fw-7 tone-warn"><Icon e="📍" size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} /> {t("geo.away").replace("{m}", String(f.maxDistanceM))}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link href="/schedule-hub" style={{ display: "block", textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--gold)", textDecoration: "none" }}>
        ← {t("geo.backToHub")}
      </Link>
    </div>
  );
}
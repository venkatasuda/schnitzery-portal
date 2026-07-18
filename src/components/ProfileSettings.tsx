"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/Toast";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

// Shared profile footer for every role: Light Mode (reuses the same theme
// mechanism as the header toggle) + a working Change Password via Supabase auth.
export default function ProfileSettings() {
  const { t } = useLang();
  // ── Light Mode (same source of truth as the header ThemeToggle) ──
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.classList.contains("light")); }, []);
  function toggleTheme() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try { localStorage.setItem("sch_theme", next ? "light" : "dark"); } catch { /* ignore */ }
  }

  // ── Change Password ──
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    if (pw.length < 8) { toast(t("settings.pwTooShort"), "error"); return; }
    if (pw !== pw2) { toast(t("settings.pwMismatch"), "error"); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast(t("settings.pwUpdated"), "success");
      setPw(""); setPw2(""); setOpen(false);
    } catch (e: any) {
      toast(e?.message || t("settings.pwError"), "error");
    }
    setBusy(false);
  }

  return (
    <>
      {/* PREFERENCES */}
      <div className="section-label">{t("settings.preferences")}</div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--white)" }}>{t("settings.lightMode")}</div>
            <div style={{ fontSize: 12, color: "var(--gray)" }}>{t("settings.lightModeSub")}</div>
          </div>
          <button
            onClick={toggleTheme}
            role="switch"
            aria-checked={light}
            aria-label="Toggle light mode"
            style={{ width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", padding: 3, background: light ? "var(--gold)" : "rgba(128,128,128,0.35)", transition: "background .2s", display: "flex", justifyContent: light ? "flex-end" : "flex-start" }}
          >
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </button>
        </div>
      </div>

      {/* ACCOUNT */}
      <div className="section-label">{t("settings.account")}</div>
      <div className="card" style={{ padding: 8 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 10px", background: "none", border: "none", cursor: "pointer", color: "var(--white)", fontSize: 14, fontWeight: 600 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon e="🔒" size={14} /> {t("settings.changePassword")}</span>
          <span style={{ color: "var(--gray)" }}>{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div style={{ padding: "6px 10px 10px" }}>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} placeholder={t("settings.newPwPlaceholder")} value={pw} onChange={(e) => setPw(e.target.value)} style={{ ...inputStyle, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("login.hidePassword") : t("login.showPassword")} title={showPw ? t("login.hidePassword") : t("login.showPassword")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--gray)", display: "flex", alignItems: "center" }}>
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
            <input type={showPw ? "text" : "password"} placeholder={t("settings.confirmPwPlaceholder")} value={pw2} onChange={(e) => setPw2(e.target.value)} style={inputStyle} />
            <button onClick={changePassword} disabled={busy} style={{ width: "100%", padding: 12, background: "var(--gold)", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
              {busy ? t("common.saving") : t("settings.updatePassword")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", marginBottom: 8, background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 14 };
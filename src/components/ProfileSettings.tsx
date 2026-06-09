"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Shared profile footer for every role: Light Mode (reuses the same theme
// mechanism as the header toggle) + a working Change Password via Supabase auth.
export default function ProfileSettings() {
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function changePassword() {
    setMsg(null);
    if (pw.length < 8) { setMsg({ type: "err", text: "Password must be at least 8 characters." }); return; }
    if (pw !== pw2) { setMsg({ type: "err", text: "The two passwords don't match." }); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setMsg({ type: "ok", text: "✅ Password updated." });
      setPw(""); setPw2(""); setOpen(false);
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Could not change password." });
    }
    setBusy(false);
  }

  return (
    <>
      {/* PREFERENCES */}
      <div className="section-label">Preferences</div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--white)" }}>Light Mode</div>
            <div style={{ fontSize: 12, color: "var(--gray)" }}>Switch between light &amp; dark theme</div>
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
      <div className="section-label">Account</div>
      <div className="card" style={{ padding: 8 }}>
        <button
          onClick={() => { setOpen((o) => !o); setMsg(null); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 10px", background: "none", border: "none", cursor: "pointer", color: "var(--white)", fontSize: 14, fontWeight: 600 }}
        >
          <span>🔒 Change Password</span>
          <span style={{ color: "var(--gray)" }}>{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div style={{ padding: "6px 10px 10px" }}>
            <input type="password" placeholder="New password (min 8 characters)" value={pw} onChange={(e) => setPw(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={inputStyle} />
            <button onClick={changePassword} disabled={busy} style={{ width: "100%", padding: 12, background: "var(--gold)", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
              {busy ? "Saving…" : "Update Password"}
            </button>
          </div>
        )}

        {msg && (
          <div style={{ color: msg.type === "ok" ? "#58d68d" : "#ec7063", fontSize: 12, textAlign: "center", padding: "4px 0 8px" }}>{msg.text}</div>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", marginBottom: 8, background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 14 };
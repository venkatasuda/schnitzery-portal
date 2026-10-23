"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/components/LanguageProvider";

export default function ChangePasswordForm() {
  const { t } = useLang();
  const router = useRouter();
  const supabase = createClient();

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setError(null);
    if (pw.length < 8) {
      setError(t("pw.tooShort"));
      return;
    }
    if (pw !== confirm) {
      setError(t("pw.noMatch"));
      return;
    }
    setLoading(true);

    // 1) Update the Supabase Auth password.
    const { error: updErr } = await supabase.auth.updateUser({ password: pw })
      .catch(() => ({ error: { message: t("pw.failed") } }));
    if (updErr) {
      setLoading(false);
      setError(updErr.message || t("pw.failed"));
      return;
    }

    // 2) Clear the must_change_password flag on our own profile row.
    //    (users_update RLS allows own-row; the guard trigger only protects
    //    role / branch_id / contract_hours / annual_leave_days / employee_code,
    //    so this update is permitted. Wages are not on this table at all —
    //    they live in user_pay. See PRODUCTION-AUDIT.md item 18.)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // If the flag isn't cleared the gate sends the user straight back here, so say so.
      const { error: flagErr } = await supabase.from("users").update({ must_change_password: false }).eq("id", user.id);
      if (flagErr) { setLoading(false); setError(t("pw.failed")); return; }
    }

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a0e0e",
        fontFamily: "system-ui, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#241414",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <h1
          style={{
            color: "var(--gold-ink)",
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 4px",
            fontFamily: "Georgia, serif",
          }}
        >
          {t("pw.title")}
        </h1>
        <p style={{ color: "var(--gray)", fontSize: 13, margin: "0 0 24px", lineHeight: 1.5 }}>
          {t("pw.subtitle")}
        </p>

        <label style={{ color: "#cfc4c4", fontSize: 12, display: "block", marginBottom: 6 }}>
          {t("pw.newPassword")}
        </label>
        <div className="u-relative">
          <input aria-label={t("pw.newPassword")}
            type={showPw ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ ...inputStyle, paddingRight: 44 }}
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("login.hidePassword") : t("login.showPassword")} title={showPw ? t("login.hidePassword") : t("login.showPassword")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--gray)", display: "flex", alignItems: "center" }}>
            {showPw ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
        </div>

        <label style={{ color: "#cfc4c4", fontSize: 12, display: "block", margin: "16px 0 6px" }}>
          {t("pw.confirmPassword")}
        </label>
        <div className="u-relative">
          <input aria-label={t("pw.confirmPassword")}
            type={showPw ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            style={{ ...inputStyle, paddingRight: 44 }}
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("login.hidePassword") : t("login.showPassword")} title={showPw ? t("login.hidePassword") : t("login.showPassword")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--gray)", display: "flex", alignItems: "center" }}>
            {showPw ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "rgba(192,57,43,0.15)",
              border: "1px solid rgba(192,57,43,0.3)",
              borderRadius: 8,
              color: "var(--danger)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "13px",
            background: loading ? "#7a5e2a" : "#d4a847",
            color: "var(--on-action)",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? t("pw.saving") : t("pw.save")}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  boxSizing: "border-box",
};
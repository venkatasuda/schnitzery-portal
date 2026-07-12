"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/components/LanguageProvider";
import { checkLogin, recordFail, clearAttempts } from "@/lib/queries/loginThrottle";

export default function LoginForm() {
  const { t } = useLang();
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    // server-side lockout check (can't be bypassed by refreshing)
    const gate = await checkLogin(email);
    if (gate.blocked) {
      setLoading(false);
      setError(t("login.tooManyAttempts", { min: Math.ceil((gate.retryAfter || 60) / 60) }));
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await recordFail(email);
      setLoading(false);
      setError(error.message);
      return;
    }
    await clearAttempts(email);
    setLoading(false);
    // Session is set; middleware will allow the app routes now.
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
        background: "***REMOVED***1a0e0e",
        fontFamily: "system-ui, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "***REMOVED***241414",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <h1
          style={{
            color: "***REMOVED***d4a847",
            fontSize: 24,
            fontWeight: 700,
            margin: "0 0 4px",
            fontFamily: "Georgia, serif",
          }}
        >
          Schnitzery Portal
        </h1>
        <p style={{ color: "***REMOVED***9a8f8f", fontSize: 13, margin: "0 0 24px" }}>
          {t("login.subtitle")}
        </p>

        <label style={{ color: "***REMOVED***cfc4c4", fontSize: 12, display: "block", marginBottom: 6 }}>
          {t("login.email")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={inputStyle}
          placeholder="you@example.com"
        />

        <label style={{ color: "***REMOVED***cfc4c4", fontSize: 12, display: "block", margin: "16px 0 6px" }}>
          {t("login.password")}
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ ...inputStyle, paddingRight: 44 }}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? t("login.hidePassword") : t("login.showPassword")}
            title={showPw ? t("login.hidePassword") : t("login.showPassword")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: "***REMOVED***9a8f8f", display: "flex", alignItems: "center" }}
          >
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
              color: "***REMOVED***ec7063",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "13px",
            background: loading ? "***REMOVED***7a5e2a" : "***REMOVED***d4a847",
            color: "***REMOVED***1a0e0e",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? t("login.signingIn") : t("login.signIn")}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "***REMOVED***fff",
  fontSize: 14,
  boxSizing: "border-box",
};
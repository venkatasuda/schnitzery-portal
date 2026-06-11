"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/components/LanguageProvider";

export default function LoginForm() {
  const { t } = useLang();
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
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
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <h1
          style={{
            color: "#d4a847",
            fontSize: 24,
            fontWeight: 700,
            margin: "0 0 4px",
            fontFamily: "Georgia, serif",
          }}
        >
          Schnitzery Portal
        </h1>
        <p style={{ color: "#9a8f8f", fontSize: 13, margin: "0 0 24px" }}>
          {t("login.subtitle")}
        </p>

        <label style={{ color: "#cfc4c4", fontSize: 12, display: "block", marginBottom: 6 }}>
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

        <label style={{ color: "#cfc4c4", fontSize: 12, display: "block", margin: "16px 0 6px" }}>
          {t("login.password")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={inputStyle}
          placeholder="••••••••"
        />

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "rgba(192,57,43,0.15)",
              border: "1px solid rgba(192,57,43,0.3)",
              borderRadius: 8,
              color: "#ec7063",
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
            background: loading ? "#7a5e2a" : "#d4a847",
            color: "#1a0e0e",
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
  color: "#fff",
  fontSize: 14,
  boxSizing: "border-box",
};
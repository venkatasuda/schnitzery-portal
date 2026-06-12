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
    const { error: updErr } = await supabase.auth.updateUser({ password: pw });
    if (updErr) {
      setLoading(false);
      setError(updErr.message || t("pw.failed"));
      return;
    }

    // 2) Clear the must_change_password flag on our own profile row.
    //    (users_update RLS allows own-row; the guard trigger only protects
    //    role / branch_id / hourly_wage, so this update is permitted.)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("users").update({ must_change_password: false }).eq("id", user.id);
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
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <h1
          style={{
            color: "#d4a847",
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 4px",
            fontFamily: "Georgia, serif",
          }}
        >
          {t("pw.title")}
        </h1>
        <p style={{ color: "#9a8f8f", fontSize: 13, margin: "0 0 24px", lineHeight: 1.5 }}>
          {t("pw.subtitle")}
        </p>

        <label style={{ color: "#cfc4c4", fontSize: 12, display: "block", marginBottom: 6 }}>
          {t("pw.newPassword")}
        </label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={inputStyle}
          placeholder="••••••••"
        />

        <label style={{ color: "#cfc4c4", fontSize: 12, display: "block", margin: "16px 0 6px" }}>
          {t("pw.confirmPassword")}
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
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
          onClick={handleSave}
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
          {loading ? t("pw.saving") : t("pw.save")}
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
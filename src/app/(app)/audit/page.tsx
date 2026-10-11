"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { getAuditLog } from "@/lib/queries/admin";

export default function AuditPage() {
  const { t } = useLang();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getAuditLog();
      if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setLoading(false); return; }
      setLogs(res.logs);
      setLoading(false);
    })();
  }, []);

  if (denied) return <div style={{ ...card, textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const fmt = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="workspace-page">
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-body)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="🔒" size={22} /> {t("profile.auditLog")}</h1>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>{t("audit.subtitle")}</p>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : logs.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("audit.empty")}</div>
      ) : (
        logs.map((l) => (
          <div key={l.id} style={{ ...card, marginBottom: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{(l.action || "").replace(/_/g, " ")}</div>
              {l.details && <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 2 }}>{l.details}</div>}
              <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 2 }}>{t("audit.by", { actor: l.actor || "—" })}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--gray)", whiteSpace: "nowrap" }}>{fmt(l.created_at)}</div>
          </div>
        ))
      )}
    </div>
  );
}
const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 };
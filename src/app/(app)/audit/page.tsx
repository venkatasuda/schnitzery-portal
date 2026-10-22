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

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const fmt = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="workspace-page">
      <h1 className="page-title u-row"><Icon e="🔒" size={22} /> {t("profile.auditLog")}</h1>
      <p className="ui-lede">{t("audit.subtitle")}</p>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : logs.length === 0 ? (
        <div className="card ui-empty-msg">{t("audit.empty")}</div>
      ) : (
        logs.map((l) => (
          <div key={l.id} style={{ ...card, marginBottom: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="ui-strong">{(l.action || "").replace(/_/g, " ")}</div>
              {l.details && <div className="ui-meta">{l.details}</div>}
              <div className="ui-meta">{t("audit.by", { actor: l.actor || "—" })}</div>
            </div>
            <div className="t-xs u-muted ws-nw">{fmt(l.created_at)}</div>
          </div>
        ))
      )}
    </div>
  );
}
const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 };
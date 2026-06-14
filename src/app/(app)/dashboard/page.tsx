"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { CardSkeleton } from "@/components/Skeleton";
import Link from "next/link";
import { getDashboardStats } from "@/lib/queries/admin";

export default function DashboardPage() {
  const { t } = useLang();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getDashboardStats();
      if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setLoading(false); return; }
      setStats(res.stats);
      setLoading(false);
    })();
  }, []);

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📊 {t("dash.title")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 18 }}>{t("dash.subtitle")}</p>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : !stats ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f" }}>{t("hours.noData")}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard icon="🟢" value={stats.clockedIn} label={t("dash.workingNow")} color="#58d68d" href="/clock-display" />
            <StatCard icon="👥" value={stats.staffCount} label={t("dash.activeStaff")} color="#3498db" href="/staff" />
            <StatCard icon="✅" value={stats.pendingApprovals} label={t("dash.pendingApprovals")} color={stats.pendingApprovals ? "#d4a847" : "#58d68d"} href="/approvals" />
            <StatCard icon="🚨" value={stats.openIncidents} label={t("dash.openIncidents")} color={stats.openIncidents ? "#ec7063" : "#58d68d"} href="/incidents" />
            <StatCard icon="📦" value={stats.lowStock} label={t("dash.lowStock")} color={stats.lowStock ? "#e8a35a" : "#58d68d"} href="/inventory" />
            <StatCard icon="✔️" value={`${stats.checklistDone}/${stats.checklistTotal}`} label={t("dash.checklistToday")} color="#9b59b6" href="/checklist" />
          </div>

          <div style={{ ...card }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("dash.quickActions")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <QuickLink href="/ops">📡 {t("ops.title")}</QuickLink>
              <QuickLink href="/roster">{t("dash.buildRoster")}</QuickLink>
              <QuickLink href="/announcements">{t("home.postAnnouncement")}</QuickLink>
              <QuickLink href="/export">📤 {t("profile.payrollExport")}</QuickLink>
              <QuickLink href="/settings">{t("dash.settings")}</QuickLink>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color, href }: any) {
  return (
    <Link href={href} style={{ ...card, textDecoration: "none", display: "block" }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 2 }}>{label}</div>
    </Link>
  );
}
function QuickLink({ href, children }: any) {
  return <Link href={href} style={{ padding: "9px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, textDecoration: "none" }}>{children}</Link>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
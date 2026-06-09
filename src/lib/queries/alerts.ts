"use server";

import { getDashboardStats } from "@/lib/queries/admin";
import { getScheduleOverview } from "@/lib/queries/schedule-insights";
import { getBranchExpiringDocs } from "@/lib/queries/doc-expiry";

// Aggregates everything a manager should be nudged about into one feed.
// Reuses the existing dashboard + schedule queries (no new table access).
export async function getManagerAlerts() {
  const [d, s, ex] = await Promise.all([getDashboardStats(), getScheduleOverview(), getBranchExpiringDocs()]);
  if (!d.ok) return { ok: false, error: d.error || "Could not load alerts." };

  const stats = d.stats;
  if (!stats) return { ok: false, error: "Could not load alerts." };
  const missing = s.ok ? Math.max(0, (s.staffCount || 0) - (s.submissionCount || 0)) : 0;

  const items: { type: string; icon: string; href: string; label: string; count: number }[] = [];
  if (stats.pendingApprovals > 0)
    items.push({ type: "approval", icon: "✅", href: "/approvals", count: stats.pendingApprovals, label: `${stats.pendingApprovals} approval${stats.pendingApprovals === 1 ? "" : "s"} waiting` });
  if (stats.openIncidents > 0)
    items.push({ type: "incident", icon: "🚨", href: "/incidents", count: stats.openIncidents, label: `${stats.openIncidents} open incident${stats.openIncidents === 1 ? "" : "s"}` });
  if (stats.lowStock > 0)
    items.push({ type: "stock", icon: "📦", href: "/inventory", count: stats.lowStock, label: `${stats.lowStock} low-stock item${stats.lowStock === 1 ? "" : "s"}` });
  if (missing > 0)
    items.push({ type: "availability", icon: "📋", href: "/noshow", count: missing, label: `${missing} haven't submitted availability` });
  if (ex.ok && ex.count > 0)
    items.push({ type: "docs", icon: "📑", href: "/expiring-docs", count: ex.count, label: `${ex.count} document${ex.count === 1 ? "" : "s"} expiring soon` });

  const total = items.reduce((sum, i) => sum + i.count, 0);
  return { ok: true, items, total };
}
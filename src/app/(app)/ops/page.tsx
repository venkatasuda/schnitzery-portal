import { getOpsDashboard, getOpsFilters } from "@/lib/queries/ops-dashboard";
import { berlinToday } from "@/lib/time/berlinDate";
import OpsClient from "./OpsClient";

// Server component: filters + today's figures for the default branch, then the client
// takes over (filters, date changes, 45 s live refresh).
export default async function OpsPage() {
  const date = berlinToday();
  const filters = await getOpsFilters().catch(() => null);
  if (!filters || !filters.ok) return <OpsClient />;
  const data = await getOpsDashboard({ date, branchId: filters.defaultBranch || null, team: null, shift: null }).catch(() => null);
  return <OpsClient initial={data && data.ok ? { filters, data, date } : null} />;
}

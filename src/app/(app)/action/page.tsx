import { getActionCenter, getStaffAlerts } from "@/lib/queries/action-center";
import ActionClient from "./ActionClient";

// Server component: both reads in parallel (the browser ran them one after another).
export default async function ActionPage() {
  const [d, a] = await Promise.all([getActionCenter().catch(() => null), getStaffAlerts().catch(() => null)]);
  return <ActionClient initial={d && d.ok ? { d, alerts: a && a.ok ? a.alerts : [] } : null} />;
}

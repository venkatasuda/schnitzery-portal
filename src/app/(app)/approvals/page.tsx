import { getPendingApprovals } from "@/lib/queries/leave";
import { getAttendanceApprovals } from "@/lib/queries/live-attendance";
import { getCorrectionApprovals } from "@/lib/queries/corrections";
import ApprovalsClient from "./ApprovalsClient";

// Server component: the three approval lists load in parallel here instead of one after
// another from the browser (Next.js queues client-side server actions).
export default async function ApprovalsPage() {
  const initial = await Promise.all([getPendingApprovals(), getAttendanceApprovals(), getCorrectionApprovals()]).catch(() => null);
  return <ApprovalsClient initial={initial} />;
}

import { getScheduleOverview } from "@/lib/queries/schedule-insights";
import ScheduleHubClient from "./ScheduleHubClient";

// Server component: the week overview arrives with the page; the client reloads after "copy week".
export default async function ScheduleHubPage() {
  const ov = await getScheduleOverview().catch(() => null);
  return <ScheduleHubClient initial={ov && ov.ok ? ov : null} />;
}

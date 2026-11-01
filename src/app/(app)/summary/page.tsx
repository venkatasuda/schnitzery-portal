import SummaryClient from "./SummaryClient";
import { getMonthlySummary } from "@/lib/queries/labor";

// Monthly summary: load the current month on the server so the page arrives with its
// numbers (was: render a skeleton, hydrate, then fetch). Other months load in the client.
export default async function SummaryPage() {
  const res = await getMonthlySummary().catch(() => null);
  return <SummaryClient initial={res && res.ok ? res : null} />;
}

import { getLaborSummary, getRecentSales, getStaffWages } from "@/lib/queries/labor";
import { serverText } from "@/lib/i18n/serverMessages";
import { getLocale } from "@/lib/i18n/server";
import LaborClient from "./LaborClient";

// Server component: the three reads run in parallel here instead of one after another
// from the browser (Next.js queues client-side server actions).
export default async function LaborPage() {
  const [s, rs, sw, locale] = await Promise.all([getLaborSummary(), getRecentSales(), getStaffWages(), getLocale()]);
  const failed = [s, rs, sw].find((r) => !r.ok);
  const initial = failed
    ? { sum: null, sales: [], staff: [], denied: !!failed.error?.includes("Managers"), error: failed.error?.includes("Managers") ? null : serverText(failed.error || "", locale) || failed.error || "Error" }
    : { sum: s, sales: (rs as { sales?: unknown[] }).sales || [], staff: (sw as { staff?: unknown[] }).staff || [], denied: false, error: null };
  return <LaborClient initial={initial as never} />;
}

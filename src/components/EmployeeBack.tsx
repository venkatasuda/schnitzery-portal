"use client";
// Employee app: one back link at the top of every page that is not a bottom-tab destination.
// Managers do not get this — their header already shows "← <section>" (ManagementLocation).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";

const TABS = ["/", "/my-day", "/schedule", "/profile", "/shift", "/no-access"];
const MY_DAY = ["/leave", "/hours", "/checklist", "/availability", "/leave-calendar", "/directory", "/cover"];
const OWN = ["/shift/", "/inventory/counts"];   // these pages render their own back link
const SHIFT = ["/prep/plan", "/day-close", "/expiry", "/inventory"]; // shift-leader tasks, opened from the Inventory tab (/shift)
const under = (path: string, roots: string[]) => roots.some((r) => path === r || path.startsWith(r.endsWith("/") ? r : r + "/"));

export default function EmployeeBack() {
  const path = usePathname();
  const { t } = useLang();
  if (TABS.includes(path) || under(path, OWN)) return null;
  const [href, label] = under(path, SHIFT) ? ["/shift", t("nav.inventory")] : under(path, MY_DAY) ? ["/my-day", t("nav.myDay")] : ["/", t("nav.home")];
  return <Link href={href} className="back-link"><span aria-hidden="true">←</span> {label}</Link>;
}

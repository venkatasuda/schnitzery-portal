"use client";

import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";

export type InventoryArea = "overview" | "stock" | "purchasing" | "movements" | "reports";
const views: Record<InventoryArea, string> = { overview: "overview", stock: "count", purchasing: "forecast", movements: "movements", reports: "analytics" };

export default function InventoryNav({ active, onNavigate, canLeave }: { active: InventoryArea; onNavigate?: (view: string) => void; canLeave?: () => boolean }) {
  const { t } = useLang();
  return <nav className="inventory-area-nav" aria-label={t("inventoryWorkspace.navigation")}>
    {(Object.entries(views) as [InventoryArea, string][]).map(([area, view]) => <Link key={area} href={`/inventory?view=${view}`} aria-current={active === area ? "page" : undefined}
      onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; if (canLeave && !canLeave()) { event.preventDefault(); return; } if (onNavigate) { event.preventDefault(); onNavigate(view); } }}>
      {t(`inventoryWorkspace.${area}`)}
    </Link>)}
  </nav>;
}

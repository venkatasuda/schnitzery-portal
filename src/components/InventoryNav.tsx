"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";

export type InventoryArea = "overview" | "stock" | "purchasing" | "kitchen" | "movements" | "reports";

export default function InventoryNav({ active, currentView, purchasingTab, onNavigate, canLeave }: { active: InventoryArea; currentView?: string; purchasingTab?: string; onNavigate?: (view: string) => void; canLeave?: () => boolean }) {
  const { t, locale } = useLang();
  const pathname = usePathname();
  const taskNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = taskNav.current;
    if (!nav) return;
    const revealCurrent = () => {
      const current = nav.querySelector<HTMLElement>("[aria-current]");
      if (!current || nav.scrollWidth <= nav.clientWidth) return;
      const left = current.offsetLeft, right = left + current.offsetWidth;
      if (left < nav.scrollLeft) nav.scrollLeft = left;
      else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth;
    };
    revealCurrent();
    const observer = new ResizeObserver(revealCurrent);
    observer.observe(nav);
    const current = nav.querySelector<HTMLElement>("[aria-current]");
    if (current) observer.observe(current);
    return () => observer.disconnect();
  }, [pathname, currentView, purchasingTab, locale]);
  const s = (en: string, de: string) => locale === "de" ? de : en;
  const view = (name: string) => `/inventory?view=${name}`;
  const areas: { id: InventoryArea; label: string; href: string }[] = [
    { id: "overview", label: t("inventoryWorkspace.overview"), href: view("overview") },
    { id: "stock", label: t("inventoryWorkspace.stock"), href: "/inventory/counts" },
    { id: "purchasing", label: t("inventoryWorkspace.purchasing"), href: "/inventory/purchasing" },
    { id: "kitchen", label: s("Kitchen", "Küche"), href: "/inventory/production" },
    { id: "movements", label: t("inventoryWorkspace.movements"), href: view("history") },
    { id: "reports", label: t("inventoryWorkspace.reports"), href: "/inventory/insights" },
  ];
  const sections: Record<InventoryArea, [string, string][]> = {
    overview: [],
    stock: [[s("Stocktakes", "Inventuren"), "/inventory/counts"], [t("inventoryWorkflow.catalogTab"), view("catalog")], [s("Batches & expiry", "Chargen und Ablauf"), "/expiry"]],
    purchasing: [[t("inventoryOps.orders"), "/inventory/purchasing"], [t("inventoryOps.suppliers"), "/inventory/purchasing?tab=suppliers"], [s("Returns & credits", "Retouren und Gutschriften"), "/inventory/purchasing?tab=returns"], [t("inventoryWorkflow.reorder"), view("forecast")], [t("inv.tabDeliveries"), view("deliveries")], [s("Ingredient prices", "Zutatenpreise"), "/inventory/prices"], [s("Stock alerts", "Bestandswarnungen"), "/stock-alerts"]],
    kitchen: [[s("Production", "Produktion"), "/inventory/production"], [s("Prep planning", "Vorbereitungsplanung"), "/inventory/preparation"], [s("Recipes & costing", "Rezepte und Kalkulation"), "/inventory/recipes"], [s("Sales consumption", "Verkaufsverbrauch"), "/inventory/consumption"]],
    movements: [[t("stockHistory.title"), view("history")], [t("home.transfers"), "/transfers"], [t("home.wasteLog"), "/waste"]],
    reports: [[s("Business insights", "Geschäftsauswertung"), "/inventory/insights"], [t("inventoryWorkflow.reports"), view("analytics")], [t("reconcile.title"), view("reconcile")], [s("Valuation close", "Bestandsabschluss"), "/inventory/valuation"], [s("Batch traceability", "Chargenherkunft"), "/inventory/batch-report"]],
  };
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (canLeave && !canLeave()) { event.preventDefault(); return; }
    const targetView = href.startsWith("/inventory?view=") ? href.split("=")[1] : null;
    if (onNavigate && targetView) { event.preventDefault(); onNavigate(targetView); }
  }
  const parent = areas.find(area => area.id === active)!;
  const back = pathname === "/labels"
    ? { href: view("catalog"), label: t("inventoryWorkflow.catalogTab") }
    : pathname === "/inventory" && currentView === "count" ? parent
    : pathname === "/inventory" || pathname === parent.href ? areas[0] : parent;
  const isCurrent = (href: string) => href.startsWith("/inventory?view=")
    ? pathname === "/inventory" && href === view(currentView ?? "overview")
    : href.startsWith("/inventory/purchasing") && pathname === "/inventory/purchasing"
      ? (new URL(href, "http://local").searchParams.get("tab") ?? "orders") === (purchasingTab ?? "orders")
      : pathname === href;
  return <div className="inventory-navigation">
    {/* Shown only inside the HQ view (CSS: [data-view="hq"] .inventory-hq-note). */}<p role="note" className="business-note inventory-hq-note">{s("Inventory is kept per branch. You are in “All branches (HQ)”, so this shows your home branch — choose a branch at the top to switch.", "Inventar wird je Filiale geführt. Du bist in „Alle Filialen (HQ)“, daher siehst du deine Stammfiliale — oben eine Filiale wählen, um zu wechseln.")}</p>
    {(pathname !== "/inventory" || active !== "overview") && <Link className="inventory-back" href={back.href} onClick={event => navigate(event, back.href)}><span aria-hidden="true">←</span> {s("Back to", "Zurück zu")} {back.label}</Link>}
    <nav className="inventory-area-nav" aria-label={t("inventoryWorkspace.navigation")}>
      {areas.map(area => <Link key={area.id} href={area.href} aria-current={active === area.id ? (isCurrent(area.href) ? "page" : "location") : undefined} onClick={event => navigate(event, area.href)}>{area.label}</Link>)}
    </nav>
    {!!sections[active].length && <nav ref={taskNav} className="inventory-section-nav" aria-label={s("Tasks in this area", "Aufgaben in diesem Bereich")}>
      {sections[active].map(([label, href]) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : (href===view("catalog")&&pathname==="/labels")||(href==="/inventory/counts"&&pathname==="/inventory"&&currentView==="count") ? "location" : undefined} onClick={event => navigate(event, href)}>{label}</Link>)}
    </nav>}
  </div>;
}

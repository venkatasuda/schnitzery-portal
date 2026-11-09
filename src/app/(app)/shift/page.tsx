"use client";
// Shift-leader Inventory tab (mobile): the four daily tasks. Prices, suppliers, orders and valuation stay with managers.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, EmptyState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { getShiftAccess } from "@/lib/queries/shift-inventory";

export default function ShiftInventoryPage() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [access, setAccess] = useState<boolean | null>(null);
  useEffect(() => { getShiftAccess().then((r) => setAccess(r.ok)).catch(() => setAccess(false)); }, []);
  if (access === null) return <CardSkeleton rows={4} />;
  if (!access) return <EmptyState title={s("For shift leaders", "Für Schichtleitungen")}>{s("Ask your manager to mark you as shift leader.", "Bitte die Leitung, dich als Schichtleitung freizuschalten.")}</EmptyState>;
  const tiles = [
    { href: "/prep/plan", icon: "🥗", title: s("Plan prep", "Vorbereitung planen") },
    { href: "/inventory/counts", icon: "📋", title: s("Stocktake", "Inventur") },
    { href: "/shift/delivery", icon: "🚚", title: s("Delivery", "Lieferung") },
    { href: "/expiry", icon: "⏳", title: s("Waste, use & expiry", "Ausschuss, Verbrauch & Ablauf") },
    { href: "/day-close", icon: "🔒", title: s("Close the day", "Tagesabschluss") },
  ];
  return <div style={{ maxWidth: 680, margin: "0 auto" }}>
    <PageHeader title={s("Inventory", "Inventar")} />
    <div className="shift-tiles">{tiles.map((t) => <Link key={t.href} href={t.href} className="shift-tile">
      <span className="shift-tile-icon" aria-hidden="true">{t.icon}</span><strong>{t.title}</strong>
    </Link>)}</div>
  </div>;
}

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
    { href: "/prep", icon: "🥗", title: s("Prep list", "Vorbereitungsliste"), sub: s("Count leftovers, plan and send tomorrow's list", "Reste zählen, morgige Liste planen und senden") },
    { href: "/inventory/counts", icon: "📋", title: s("Stocktake", "Inventur"), sub: s("Count the shelves and save; a manager publishes", "Regale zählen und speichern; die Leitung veröffentlicht") },
    { href: "/shift/delivery", icon: "🚚", title: s("Delivery", "Lieferung"), sub: s("Record a delivery with expiry dates (no prices)", "Lieferung mit Ablaufdaten erfassen (ohne Preise)") },
    { href: "/expiry", icon: "⏳", title: s("Waste, use & expiry", "Ausschuss, Verbrauch & Ablauf"), sub: s("Record use or waste per batch, check what expires", "Verbrauch oder Ausschuss je Charge, Ablauf prüfen") },
    { href: "/day-close", icon: "🔒", title: s("Close the day", "Tagesabschluss"), sub: s("POS report, cash count and the day's checks", "Kassenbericht, Bargeld und Tagesprüfungen") },
  ];
  return <div style={{ maxWidth: 680, margin: "0 auto" }}>
    <PageHeader title={s("Inventory", "Inventar")} subtitle={s("Shift leader tasks", "Aufgaben der Schichtleitung")} />
    <div className="shift-tiles">{tiles.map((t) => <Link key={t.href} href={t.href} className="shift-tile">
      <span className="shift-tile-icon" aria-hidden="true">{t.icon}</span><span><strong>{t.title}</strong><span className="t-xs u-muted">{t.sub}</span></span>
    </Link>)}</div>
  </div>;
}

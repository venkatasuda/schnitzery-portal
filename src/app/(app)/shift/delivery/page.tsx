"use client";
// Shift leaders record a direct delivery: quantities, lots and expiry dates. No cost fields — a manager adds costs.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import DirectReceiving from "@/components/inventory/DirectReceiving";
import { getShiftDeliveryData, shiftReceiveDirect } from "@/lib/queries/shift-inventory";

type Data = Extract<Awaited<ReturnType<typeof getShiftDeliveryData>>, { ok: true }>;
export default function ShiftDeliveryPage() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(false), [open, setOpen] = useState(true), [saved, setSaved] = useState(0);
  const load = () => getShiftDeliveryData().then((r) => (r.ok ? (setData(r), setError(false)) : setError(true))).catch(() => setError(true));
  useEffect(() => { void load(); }, []);
  if (error) return <ErrorState message={s("Delivery form could not be loaded (shift leaders only).", "Lieferformular konnte nicht geladen werden (nur Schichtleitung).")} onRetry={load} retryLabel={s("Retry", "Erneut versuchen")} />;
  if (!data) return <CardSkeleton rows={4} />;
  return <div style={{ maxWidth: 760, margin: "0 auto" }}>
    <Link className="inventory-back" href="/shift">← {s("Back to Inventory", "Zurück zu Inventar")}</Link>
    <PageHeader title={s("Record a delivery", "Lieferung erfassen")} subtitle={data.branch.name} />
    {saved > 0 && <p role="status">{s(`${saved} delivery saved.`, `${saved} Lieferung gespeichert.`)}</p>}
    {!open && <button className="btn-gold" onClick={() => setOpen(true)}>{saved ? s("Record another delivery", "Weitere Lieferung erfassen") : s("Record a delivery", "Lieferung erfassen")}</button>}
    {open && <DirectReceiving branch={data.branch.id} products={data.products} suppliers={data.suppliers} costHidden submit={shiftReceiveDirect}
      onClose={() => setOpen(false)} onSaved={async () => { setSaved((n) => n + 1); setOpen(false); }} />}
  </div>;
}

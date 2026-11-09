"use client";
// Inventory → Kitchen → Prep planning: evening leftovers → tomorrow's list → send; history; setup.
import { useState } from "react";
import Link from "next/link";
import InventoryNav from "@/components/InventoryNav";
import { PageHeader } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import PrepDay from "@/components/prep/PrepDay";
import PrepHistory from "@/components/prep/PrepHistory";
import PrepSetup from "@/components/prep/PrepSetup";
import RecipeYields from "@/components/prep/RecipeYields";

const TABS = ["day", "history", "setup"] as const;
export default function PreparationPage() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [tab, setTab] = useState<(typeof TABS)[number]>("day");
  const label = { day: s("Tonight & tomorrow", "Heute Abend & morgen"), history: s("History", "Verlauf"), setup: s("Setup", "Einrichtung") };
  return <div className="inventory-page"><InventoryNav active="kitchen" />
    <PageHeader title={s("Prep planning", "Vorbereitungsplanung")}
      actions={<Link className="btn-secondary" href="/inventory/recipes">{s("Recipes & costing", "Rezepte & Kalkulation")}</Link>} />
    <div className="row-actions" role="tablist" aria-label={s("Prep planning", "Vorbereitungsplanung")}>
      {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "btn-gold" : "btn-secondary"} onClick={() => setTab(t)}>{label[t]}</button>)}
    </div>
    <div role="tabpanel" aria-label={label[tab]}>
      {tab === "day" && <PrepDay />}
      {tab === "history" && <PrepHistory />}
      {tab === "setup" && <><PrepSetup /><RecipeYields /></>}
    </div>
  </div>;
}

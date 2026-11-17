"use client";
// Inventory → Prep list (shift leaders + managers): count leftovers, plan and send.
import { PageHeader } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import PrepDay from "@/components/prep/PrepDay";
import { berlinToday } from "@/lib/time/berlinDate";

export default function PrepPlanPage() {
  const { locale } = useLang();
  return <div className="page-narrow">
    <PageHeader title={locale === "de" ? "Vorbereitung planen" : "Plan prep"} />
    <PrepDay initialDay={berlinToday()} allowPicker={false} />
  </div>;
}

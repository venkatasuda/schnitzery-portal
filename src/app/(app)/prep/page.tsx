"use client";
// Employee "Today's prep": yesterday's leftovers and today's sent list. Shift leaders with
// "can plan prep" also get Today/Tomorrow planning here (same component as Inventory → Kitchen).
import { PageHeader } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import PrepDay from "@/components/prep/PrepDay";
import { berlinToday } from "@/lib/time/berlinDate";

export default function TodaysPrepPage() {
  const { locale } = useLang();
  return <div style={{ maxWidth: 760, margin: "0 auto" }}>
    <PageHeader title={locale === "de" ? "Heutige Vorbereitung" : "Today's prep"} />
    <PrepDay initialDay={berlinToday()} allowPicker={false} />
  </div>;
}

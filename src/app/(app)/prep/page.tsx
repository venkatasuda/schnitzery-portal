"use client";
// Workplace → Prep list: what the team prepares (the sent list). Planning is under Inventory → Prep list (/prep/plan).
import { PageHeader } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import PrepDay from "@/components/prep/PrepDay";
import { berlinToday } from "@/lib/time/berlinDate";

export default function PrepListPage() {
  const { locale } = useLang();
  return <div style={{ maxWidth: 760, margin: "0 auto" }}>
    <PageHeader title={locale === "de" ? "Vorbereitungsliste" : "Prep list"} />
    <PrepDay initialDay={berlinToday()} allowPicker={false} readOnly />
  </div>;
}

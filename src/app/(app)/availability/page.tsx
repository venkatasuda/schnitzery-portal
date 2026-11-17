"use client";

import { PageHeader } from "@/components/ui";

import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import AvailabilityForm from "@/components/AvailabilityForm";

export default function AvailabilityPage() {
  const { t } = useLang();
  return (
    <div className="page-narrow">
      <PageHeader title={ <><Icon e="🗓" size={22} /> {t("avail.title")}</> } />
      <AvailabilityForm />
    </div>
  );
}

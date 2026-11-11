"use client";

import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import AvailabilityForm from "@/components/AvailabilityForm";

export default function AvailabilityPage() {
  const { t } = useLang();
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 className="page-title u-row"><Icon e="🗓" size={22} /> {t("avail.title")}</h1>
      <AvailabilityForm />
    </div>
  );
}

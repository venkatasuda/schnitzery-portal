"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLang } from "@/components/LanguageProvider";
import { setActiveBranch } from "@/lib/queries/branch-switch";
import { toast } from "@/components/Toast";

// Header branch picker (docs/MULTI-BRANCH.md). Shown to managers/owners linked to
// 2+ branches, and to brand owners (who also get the HQ overview option).
// "all" opens the read-only overview of the user's own branches.
export default function BranchPicker({ branches, current, hq }: { branches: { id: string; name: string }[]; current: string; hq: boolean }) {
  const { t } = useLang();
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();

  function choose(next: string) {
    if (next === "all") { router.push("/my-branches"); return; }
    const prev = value;
    setValue(next);
    start(async () => {
      const res = await setActiveBranch(next).catch(() => ({ ok: false as const, error: t("common.loadFailed") }));
      if (!res.ok) { setValue(prev); toast(res.error ?? t("common.loadFailed"), "error"); return; }
      const name = next === "hq" ? t("view.allHq") : branches.find((b) => b.id === next)?.name ?? "";
      toast(t("view.switched", { name }), "info");
      router.refresh();
    });
  }

  return (
    <label className="branch-picker" title={t("view.picker")}>
      <span aria-hidden="true">🏪</span>
      <select aria-label={t("view.picker")} value={value} disabled={pending} onChange={(e) => choose(e.target.value)}>
        {hq ? <option value="hq">{t("view.allHq")}</option> : <option value="all">{t("view.allMine")}</option>}
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}

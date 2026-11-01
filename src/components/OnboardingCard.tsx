"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { getBranchOnboarding } from "@/lib/queries/onboarding";

type Person = Extract<Awaited<ReturnType<typeof getBranchOnboarding>>, { ok: true }>["people"][number];
// Where each open step gets fixed.
const FIX: Record<string, string> = { contract: "/staff", pnr: "/staff", wage: "/labor", firstShift: "/roster" }; // availability + login are done by the person

// New-hire checklist on the staff detail page (hidden for people who joined > 90 days ago).
export default function OnboardingCard({ userId }: { userId: string }) {
  const { t } = useLang();
  const [p, setP] = useState<Person | null>(null);
  useEffect(() => { getBranchOnboarding().then((r) => setP(r.people.find((x) => x.id === userId) ?? null)).catch(() => setP(null)); }, [userId]);
  if (!p) return null;
  return (
    <>
      <div className="section-label">{t("onboarding.title", { done: p.steps.length - p.open, total: p.steps.length })}</div>
      <div className="card p-2">
        {p.steps.map((s) => (
          <div key={s.key} className="d-flex ai-c gap-2 p-1">
            <span aria-hidden="true" className={s.done ? "tone-success" : "tone-warn"}>{s.done ? "✓" : "○"}</span>
            <span className={`u-flex1 t-sm${s.done ? " u-muted" : ""}`}>{t(`onboarding.${s.key}`)}</span>
            {!s.done && FIX[s.key] && <Link className="ui-text-link t-xs" href={FIX[s.key]}>{t("onboarding.fix")} →</Link>}
          </div>
        ))}
        {p.steps.some((s) => !s.done && ["contractDoc", "taxId", "ifsg"].includes(s.key)) && <p className="ui-sub p-1">{t("onboarding.docsHint")}</p>}
      </div>
    </>
  );
}

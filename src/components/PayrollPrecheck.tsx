"use client";
// Payroll pre-check card: problems to fix before the month is approved, each with a link to where it is fixed.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { formatEur } from "@/lib/format";
import { getPayrollPrecheck } from "@/lib/queries/payroll-precheck";
import type { PrecheckIssue } from "@/lib/pay/precheck";

export default function PayrollPrecheck({ month }: { month: string }) {
  const { locale } = useLang();
  const de = locale === "de", s = (en: string, d: string) => (de ? d : en);
  const [issues, setIssues] = useState<PrecheckIssue[] | null>(null);
  useEffect(() => { let live = true; setIssues(null); getPayrollPrecheck(month).then((r) => live && setIssues(r.ok ? r.issues : null)).catch(() => live && setIssues(null)); return () => { live = false; }; }, [month]);
  if (!issues) return null;
  const row = (i: PrecheckIssue): { text: string; href: string; bad?: boolean } => {
    switch (i.kind) {
      case "open": return { text: s(`Still clocked in from an earlier day: ${i.names.join(", ")}`, `Noch eingestempelt von einem früheren Tag: ${i.names.join(", ")}`), href: "/attendance-hub", bad: true };
      case "unapproved": return { text: s(`${i.count} shifts waiting for approval`, `${i.count} Schichten warten auf Freigabe`), href: "/approvals" };
      case "corrections": return { text: s(`${i.count} time corrections waiting`, `${i.count} Zeitkorrekturen offen`), href: "/approvals" };
      case "noWage": return { text: s(`No hourly wage: ${i.names.join(", ")}`, `Kein Stundenlohn: ${i.names.join(", ")}`), href: "/labor", bad: true };
      case "belowMin": return { text: s(`Below minimum wage (${formatEur(i.min, locale)}): ${i.names.join(", ")}`, `Unter Mindestlohn (${formatEur(i.min, locale)}): ${i.names.join(", ")}`), href: "/labor", bad: true };
      case "minijob": return { text: `Minijob: ${i.people.map((p) => `${p.name} ${formatEur(p.earned, locale)} / ${formatEur(p.cap, locale)}${p.over ? s(" — over the limit", " — über der Grenze") : ""}`).join(" · ")}`, href: "/labor", bad: i.people.some((p) => p.over) };
    }
  };
  return (
    <section className={`card precheck${issues.length ? "" : " is-clear"}`} aria-label={s("Payroll pre-check", "Lohn-Vorprüfung")}>
      <strong>{s("Pre-check", "Vorprüfung")} · {issues.length ? s(`${issues.length} to fix`, `${issues.length} offen`) : s("all clear", "alles in Ordnung")}</strong>
      {issues.length > 0 && <ul>{issues.map((i) => { const r = row(i); return <li key={i.kind} className={r.bad ? "is-bad" : undefined}><Link href={r.href}>{r.text} →</Link></li>; })}</ul>}
    </section>
  );
}

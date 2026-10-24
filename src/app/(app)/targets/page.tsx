"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { ErrorState, Field } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { serverText } from "@/lib/i18n/serverMessages";
import { getTargets, setTargets } from "@/lib/queries/targets";
import { toast } from "@/components/Toast";

const KEYS = ["labourPct", "purchasePct", "primePct"] as const;
type Form = Record<(typeof KEYS)[number], string>;

// Owner targets for the active branch. Empty = no target (the tile stays neutral).
export default function TargetsPage() {
  const { t, locale } = useLang();
  const [form, setForm] = useState<Form>({ labourPct: "", purchasePct: "", primePct: "" });
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await getTargets();
      if (!r.ok) { setError(serverText(r.error ?? "", locale) || t("common.loadFailed")); return; }
      setCanEdit(r.canEdit);
      setForm({ labourPct: r.targets.labourPct?.toString() ?? "", purchasePct: r.targets.purchasePct?.toString() ?? "", primePct: r.targets.primePct?.toString() ?? "" });
    } catch { setError(t("common.loadFailed")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
    setSaving(true);
    try {
      const r = await setTargets({ labourPct: num(form.labourPct), purchasePct: num(form.purchasePct), primePct: num(form.primePct) });
      if (r.ok) toast(t("staff.saved"), "success"); else toast(r.error ?? t("common.loadFailed"), "error");
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="ui-narrow">
      <h1 className="page-title u-row"><Icon e="🎯" size={22} /> {t("targets.title")}</h1>
      <p className="ui-lede">{t("targets.subtitle")}</p>
      {loading ? <CardSkeleton rows={3} />
        : error ? <ErrorState message={error} onRetry={load} retryLabel={t("business.retry")} />
        : (
          <form className="card" onSubmit={save}>
            {KEYS.map((k) => (
              <Field key={k} label={t(`targets.${k}`)} hint={t(`targets.${k}Hint`)}>
                <input className="form-input ui-input-sm" type="number" inputMode="decimal" min={1} max={k === "primePct" ? 200 : 100} step="0.1"
                  value={form[k]} disabled={!canEdit || saving} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </Field>
            ))}
            {canEdit ? <button className="btn-gold" type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
              : <p className="ui-note">{t("targets.ownersOnly")}</p>}
          </form>
        )}
      <Link className="ui-back-link" href="/">{t("approvals.back")}</Link>
    </div>
  );
}

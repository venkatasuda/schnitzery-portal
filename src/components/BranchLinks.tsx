"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getBranchLinks, setBranchLink } from "@/lib/queries/branch-links";
import { toast } from "@/components/Toast";

type Data = { home: string | null; branches: { id: string; name: string }[]; linked: string[] };

// Staff detail → "Branches" (brand owners only): which extra branches a manager or
// branch owner may work in. Renders nothing for other callers or other roles.
export default function BranchLinks({ userId }: { userId: string }) {
  const { t } = useLang();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getBranchLinks(userId).then((r) => { if (r.ok && r.linkable) setData(r); }).catch(() => {});
  }, [userId]);
  if (!data) return null;

  async function toggle(branchId: string, on: boolean) {
    setBusy(branchId);
    const r = await setBranchLink(userId, branchId, on).catch(() => ({ ok: false as const, error: t("common.loadFailed") }));
    setBusy(null);
    if (!r.ok) { toast(r.error ?? t("common.loadFailed"), "error"); return; }
    setData((d) => d && { ...d, linked: on ? [...d.linked, branchId] : d.linked.filter((x) => x !== branchId) });
    toast(t("staff.saved"), "success");
  }

  return (
    <>
      <div className="section-label">{t("links.title")}</div>
      <fieldset className="card">
        <legend className="sr-only">{t("links.title")}</legend>
        <p className="ui-note mb-3">{t("links.hint")}</p>
        {data.branches.map((b) => {
          const home = b.id === data.home;
          return (
            <label key={b.id} className="ui-check-row">
              <input type="checkbox" checked={home || data.linked.includes(b.id)} disabled={home || busy !== null}
                onChange={(e) => toggle(b.id, e.target.checked)} />
              <span>{b.name}{home && <span className="ui-muted"> · {t("links.home")}</span>}</span>
            </label>
          );
        })}
      </fieldset>
    </>
  );
}

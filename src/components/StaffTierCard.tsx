"use client";
// Manager-only tier setting on the staff profile (used by the smart scheduler; not shown to employees).
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { getStaffTier, setStaffTier } from "@/lib/queries/staff-tier";

export default function StaffTierCard({ userId }: { userId: string }) {
  const { locale } = useLang();
  const de = locale === "de";
  const [tier, setTier] = useState<number | null | undefined>(undefined);
  useEffect(() => { getStaffTier(userId).then((r) => setTier(r.ok ? r.tier : undefined)).catch(() => setTier(undefined)); }, [userId]);
  if (tier === undefined) return null; // not a manager / not loaded
  const labels = de ? ["Senior", "Mittel", "Junior"] : ["Senior", "Mid", "Junior"];
  async function pick(v: number | null) {
    const prev = tier; setTier(v);
    const r = await setStaffTier(userId, v);
    if (!r.ok) { setTier(prev); toast(r.error, "error"); } else toast(de ? "Stufe gespeichert" : "Tier saved", "success");
  }
  return (
    <>
      <div className="section-label">{de ? "Stufe (Dienstplanung)" : "Tier (scheduling)"}</div>
      <div className="card">
        <div className="prep-seg" role="group" aria-label={de ? "Stufe" : "Tier"}>
          {[1, 2, 3].map((v, i) => <button key={v} type="button" aria-pressed={tier === v} onClick={() => void pick(v)}>{v} · {labels[i]}</button>)}
          <button type="button" aria-pressed={tier === null} onClick={() => void pick(null)}>{de ? "Keine" : "None"}</button>
        </div>
      </div>
    </>
  );
}

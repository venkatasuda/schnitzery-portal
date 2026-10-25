"use client";

import { appLocale } from "@/lib/format";
import { useEffect, useState } from "react";
import { getMyAvailability, saveAvailability, getNextWeekStart } from "@/lib/queries/availability";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHIFTS = [
  { key: "Morning", time: "08:00–14:00" },
  { key: "Mid", time: "12:00–18:00" },
  { key: "Evening", time: "16:00–22:00" },
];

export default function AvailabilityPage() {
  const { t } = useLang();
  const dayLabel = (k: string) => (DAYS.includes(k) ? t("days." + k.toLowerCase()) : k);
  const shiftLabel = (k: string) => (["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k);
  const [weekStart, setWeekStart] = useState("");
  const [days, setDays] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getMyAvailability();
      if (res.ok) { setDays(res.days || {}); setWeekStart(res.weekStart); }
      setLoading(false);
    })();
  }, []);

  function toggleShift(day: string, shift: string) {
    setDays((prev) => {
      const cur = prev[day] || [];
      const next = cur.includes(shift) ? cur.filter((x) => x !== shift) : [...cur, shift];
      const copy = { ...prev };
      if (next.length) copy[day] = next; else delete copy[day];
      return copy;
    });
  }

  async function save() {
    setSaving(true);
    const res = await saveAvailability(weekStart, days);
    setSaving(false);
    if (res.ok) toast(t("avail.saved"), "success");
    else toast(res.error || t("avail.failSave"), "error");
  }

  const weekLabel = (() => {
    if (!weekStart) return "";
    const s = new Date(weekStart); const e = new Date(s); e.setDate(e.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin", day: "2-digit", month: "short" });
    return `${f(s)} – ${f(e)}`;
  })();

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 className="page-title u-row"><Icon e="🗓" size={22} /> {t("avail.title")}</h1>
      <p className="ui-lede">
        {t("avail.subtitle", { week: weekLabel })}
      </p>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          {DAYS.map((day) => (
            <div key={day} style={{ ...card, marginBottom: 8 }}>
              <div className="ui-title spaced">{dayLabel(day)}</div>
              <div className="d-flex gap-2 f-wrap">
                {SHIFTS.map((sh) => {
                  const on = (days[day] || []).includes(sh.key);
                  return (
                    <button key={sh.key} onClick={() => toggleShift(day, sh.key)}
                      style={{ flex: "1 1 100px", padding: "10px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
                        background: on ? "var(--action)" : "rgba(255,255,255,0.04)",
                        color: on ? "var(--on-action)" : "var(--gray)",
                        border: on ? "1px solid var(--action)" : "1px solid rgba(255,255,255,0.12)" }}>
                      {shiftLabel(sh.key)}<div className="t-xs fw-4 mt-h">{sh.time}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={save} disabled={saving} style={{ ...primaryBtn, marginTop: 8 }}>
            {saving ? t("common.saving") : t("avail.save")}
          </button>
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };
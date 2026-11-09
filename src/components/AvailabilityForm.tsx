"use client";
// Next week's availability: tap the shifts you can work, then save. Used on My Day → Availability and /availability.
import { appLocale } from "@/lib/format";
import { useEffect, useState } from "react";
import { getMyAvailability, saveAvailability } from "@/lib/queries/availability";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHIFTS = [
  { key: "Morning", time: "08:00–14:00" },
  { key: "Mid", time: "12:00–18:00" },
  { key: "Evening", time: "16:00–22:00" },
];

export default function AvailabilityForm() {
  const { t } = useLang();
  const dayLabel = (k: string) => (DAYS.includes(k) ? t("days." + k.toLowerCase()) : k);
  const shiftLabel = (k: string) => (["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k);
  const [weekStart, setWeekStart] = useState("");
  const [days, setDays] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyAvailability();
        if (res.ok) { setDays(res.days || {}); setWeekStart(res.weekStart); }
      } catch { toast(t("common.loadFailed"), "error"); }
      finally { setLoading(false); }
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
    try {
      const res = await saveAvailability(weekStart, days);
      if (res.ok) toast(t("avail.saved"), "success");
      else toast(res.error || t("avail.failSave"), "error");
    } catch { toast(t("avail.failSave"), "error"); }
    finally { setSaving(false); }
  }

  const weekLabel = (() => {
    if (!weekStart) return "";
    const s = new Date(weekStart); const e = new Date(s); e.setDate(e.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin", day: "2-digit", month: "short" });
    return `${f(s)} – ${f(e)}`;
  })();

  if (loading) return <CardSkeleton rows={4} />;
  return (
    <div className="avail-form">
      <div className="avail-week">{weekLabel}</div>
      {DAYS.map((day) => (
        <div key={day} className="card avail-day">
          <div className="ui-title spaced">{dayLabel(day)}</div>
          <div className="avail-shifts">
            {SHIFTS.map((sh) => {
              const on = (days[day] || []).includes(sh.key);
              return (
                <button key={sh.key} type="button" aria-pressed={on} className={`avail-shift${on ? " is-on" : ""}`} onClick={() => toggleShift(day, sh.key)}>
                  {shiftLabel(sh.key)}<span>{sh.time}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button className="btn-gold ui-block avail-save" onClick={save} disabled={saving || !weekStart}>
        {saving ? t("common.saving") : t("avail.save")}
      </button>
    </div>
  );
}

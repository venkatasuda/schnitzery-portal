"use client";
// Availability: pick a week (‹ ›), tap what you can work, choose where it applies (this week / the whole month /
// every week), save. Used on My Day → Availability and /availability.
import { appLocale } from "@/lib/format";
import { useEffect, useState } from "react";
import { getMyAvailability, saveAvailability } from "@/lib/queries/availability";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import { AVAIL_KEYS, addWeeks, weekMonth } from "@/lib/roster/avail-weeks";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// Times come from the server: they differ by team and weekday (Settings → Shift times).
const SHIFTS = [{ key: "Preparation" }, { key: "Morning" }, { key: "Mid" }, { key: "Evening" }, { key: "Dishwashing" }];

export default function AvailabilityForm() {
  const { t, locale } = useLang();
  const dayLabel = (k: string) => (DAYS.includes(k) ? t("days." + k.toLowerCase()) : k);
  const shiftLabel = (k: string) => (k === "Dishwashing" ? (locale === "de" ? "Spüler" : "Dishwasher") : k === "Preparation" ? t("teams.Preparation") : ["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k);
  const [times, setTimes] = useState<Record<string, Record<string, string>>>({});
  const [weekStart, setWeekStart] = useState("");
  const [days, setDays] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<"week" | "month" | "always">("week");
  const [range, setRange] = useState({ min: "", max: "" }), [published, setPublished] = useState(false);
  const de = locale === "de";

  async function load(week?: string) {
    setLoading(true);
    try {
      const res = await getMyAvailability(week);
      if (res.ok) {
        const r = res as any;
        // Keep only options the form knows (older entries may hold others).
        const clean = Object.fromEntries(Object.entries((res.days || {}) as Record<string, string[]>).map(([d, l]): [string, string[]] => [d, (l || []).filter((k) => AVAIL_KEYS.includes(k))]).filter(([, l]) => l.length > 0));
        setDays(clean); setSavedDays(JSON.stringify(clean));
        setWeekStart(res.weekStart); setTimes(r.times || {}); setRange({ min: r.minWeek || "", max: r.maxWeek || "" }); setPublished(!!r.published); setScope("week");
      } else toast(t("common.loadFailed"), "error");
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  // What is saved for the shown week; anything different on screen is unsaved.
  const [savedDays, setSavedDays] = useState("{}");
  const dirty = JSON.stringify(days) !== savedDays;
  function toggleShift(day: string, shift: string) {
    if (saving || loading) return; // a tap during a save would stay on screen but not be in what was saved
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
      const res = await saveAvailability(weekStart, days, scope);
      if (res.ok) setSavedDays(JSON.stringify(days));
      if (res.ok) toast(scope === "month" ? (de ? `Für ${(res as any).weeks} Wochen gespeichert` : `Saved for ${(res as any).weeks} weeks`) : t("avail.saved"), "success");
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

  const monthName = weekStart ? new Date(`${weekMonth(weekStart)}-15T12:00:00Z`).toLocaleDateString(appLocale(), { timeZone: "UTC", month: "long" }) : "";
  const step = (n: number) => {
    const w = addWeeks(weekStart, n);
    if (w < range.min || w > range.max) return;
    if (dirty && !confirm(de ? "Ungespeicherte Änderungen für diese Woche verwerfen?" : "Discard the unsaved changes for this week?")) return;
    void load(w);
  };
  if (loading && !weekStart) return <CardSkeleton rows={4} />;
  return (
    <div className="avail-form" aria-busy={loading}>
      <div className="avail-nav">
        <button type="button" className="btn-secondary" aria-label={de ? "Vorherige Woche" : "Previous week"} disabled={loading || saving || !weekStart || addWeeks(weekStart, -1) < range.min} onClick={() => step(-1)}>‹</button>
        <strong className="avail-week" aria-live="polite">{weekLabel}</strong>
        <button type="button" className="btn-secondary" aria-label={de ? "Nächste Woche" : "Next week"} disabled={loading || saving || !weekStart || addWeeks(weekStart, 1) > range.max} onClick={() => step(1)}>›</button>
      </div>
      {published && <p className="avail-note">{de ? "Der Dienstplan dieser Woche ist schon veröffentlicht. Änderungen hier verschieben keine Schichten." : "This week's roster is already published. Changes here do not move any shifts."}</p>}
      {DAYS.map((day) => (
        <div key={day} className="card avail-day">
          <div className="ui-title spaced">{dayLabel(day)}</div>
          <div className="avail-shifts">
            {SHIFTS.map((sh) => {
              const on = (days[day] || []).includes(sh.key);
              return (
                <button key={sh.key} type="button" aria-pressed={on} disabled={saving} className={`avail-shift${on ? " is-on" : ""}`} onClick={() => toggleShift(day, sh.key)}>
                  {shiftLabel(sh.key)}
                  <span>{times[day]?.[sh.key] || t("roster.timePending")}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="avail-save">
      <div className="prep-seg avail-scope" role="group" aria-label={de ? "Gilt für" : "Applies to"}>
        <button type="button" aria-pressed={scope === "week"} onClick={() => setScope("week")}>{de ? "Diese Woche" : "This week"}</button>
        <button type="button" aria-pressed={scope === "month"} onClick={() => setScope("month")}>{de ? `Ganzer ${monthName}` : `All of ${monthName}`}</button>
        <button type="button" aria-pressed={scope === "always"} onClick={() => setScope("always")}>{de ? "Jede Woche" : "Every week"}</button>
      </div>
      <button className="btn-gold ui-block" onClick={save} disabled={saving || loading || !weekStart}>
        {saving ? t("common.saving") : `${t("avail.save")}${dirty ? " •" : ""}`}
      </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getMyAvailability, saveAvailability, getNextWeekStart } from "@/lib/queries/availability";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";

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
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(s)} – ${f(e)}`;
  })();

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>🗓 {t("avail.title")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>
        {t("avail.subtitle", { week: weekLabel })}
      </p>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          {DAYS.map((day) => (
            <div key={day} style={{ ...card, marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{dayLabel(day)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SHIFTS.map((sh) => {
                  const on = (days[day] || []).includes(sh.key);
                  return (
                    <button key={sh.key} onClick={() => toggleShift(day, sh.key)}
                      style={{ flex: "1 1 100px", padding: "10px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
                        background: on ? "#d4a847" : "rgba(255,255,255,0.04)",
                        color: on ? "#1a0e0e" : "#9a8f8f",
                        border: on ? "1px solid #d4a847" : "1px solid rgba(255,255,255,0.12)" }}>
                      {shiftLabel(sh.key)}<div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{sh.time}</div>
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

const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };
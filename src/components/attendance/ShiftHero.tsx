"use client";
// Employee Home, first card: today's (or the next) shift and the clock button right on it.
// Clocking uses the same implementation as the Attendance page (useClock); QR / code and history stay there.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { askConfirm } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { useClock } from "@/components/attendance/useClock";
import { getMyUpcomingShifts } from "@/lib/queries/cover";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";

type Shift = { work_date: string; team: string; shift: string; time: string };

export default function ShiftHero() {
  const { t, locale } = useLang();
  const de = locale === "de";
  const clock = useClock();
  const [shifts, setShifts] = useState<Shift[] | null>(null), [shiftsFailed, setShiftsFailed] = useState(false);
  useEffect(() => {
    let live = true;
    getMyUpcomingShifts().then((r) => { if (!live) return; if (r.ok) setShifts(r.shifts as Shift[]); else setShiftsFailed(true); }, () => { if (live) setShiftsFailed(true); });
    return () => { live = false; };
  }, []);

  const today = berlinToday();
  const todays = shifts?.filter((s) => s.work_date === today) ?? [], next = shifts?.find((s) => s.work_date > today);
  // A custom shift is stored as "HH:MM–HH:MM" and is its own time; presets carry their time separately.
  const label = (s: Shift) => /\d{1,2}:\d{2}/.test(s.shift) ? `${s.shift} · ${s.team}` : `${s.time || s.shift} · ${s.team}${s.time ? ` · ${s.shift}` : ""}`;
  const h = Math.floor(clock.elapsed / 3600), m = Math.floor((clock.elapsed % 3600) / 60);
  const status = clock.onBreak ? t("att.statusOnBreak") : clock.clockedIn ? t("att.statusWorking") : t("att.statusNotIn");

  async function clockOut() {
    if (!(await askConfirm({ title: t("att.clockOut"), message: de ? "Jetzt ausstempeln?" : "Clock out now?", confirmLabel: t("att.clockOut") }))) return;
    await clock.clockOut();
  }

  return (
    <section className={`card shift-hero${clock.onBreak ? " is-break" : clock.clockedIn ? " is-working" : ""}`} aria-labelledby="shift-hero-title">
      <div className="shift-hero-head">
        <div>
          <span className="shift-hero-day">{todays.length ? (de ? "Heute" : "Today") : shifts && next ? (de ? "Nächste Schicht" : "Next shift") : fmtDay(today, locale)}</span>
          <h2 id="shift-hero-title">
            {shifts == null && !shiftsFailed ? <Skeleton height={22} width={180} />
              : todays.length ? todays.map(label).join(" + ")
              : next ? `${fmtDay(next.work_date, locale)} · ${label(next)}`
              : shiftsFailed ? (de ? "Schichten nicht geladen" : "Shifts could not be loaded")
              : (de ? "Keine Schicht geplant" : "No shift planned")}
          </h2>
        </div>
        <span className="clock-status shift-hero-status" role="status">
          <span className="clock-dot" aria-hidden="true" />{status}
          {clock.clockedIn && <strong className="inv-mono">{h}:{String(m).padStart(2, "0")}</strong>}
        </span>
      </div>

      {clock.statusError ? (
        <div role="alert" className="shift-hero-error"><span>{t("att.couldNotLoad")}</span><button className="btn-secondary ui-btn-sm" onClick={() => void clock.refresh()}>{t("business.retry")}</button></div>
      ) : clock.loading ? <Skeleton height={48} radius={12} /> : (
        <div className="shift-hero-actions">
          {!clock.clockedIn
            ? <button className="clock-btn in" disabled={clock.working} aria-busy={clock.working} onClick={() => void clock.clockIn()}>{t("att.clockInNow")}</button>
            : <>
              {clock.onBreak
                ? <button className="clock-btn resume" disabled={clock.working} aria-busy={clock.working} onClick={() => void clock.endBreak()}>{t("att.endBreak")}</button>
                : <button className="clock-btn break" disabled={clock.working} aria-busy={clock.working} onClick={() => void clock.startBreak()}>{t("att.startBreak")}</button>}
              <button className="clock-btn out" disabled={clock.working || clock.onBreak} onClick={() => void clockOut()}>{t("att.clockOut")}</button>
            </>}
        </div>
      )}
      {clock.message && <p className="shift-hero-msg" role="status">{clock.message}</p>}
      <Link className="shift-hero-more" href="/attendance">{de ? "QR / Code · Verlauf" : "QR / code · History"} ›</Link>
    </section>
  );
}

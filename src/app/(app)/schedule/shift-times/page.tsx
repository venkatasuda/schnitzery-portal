"use client";

import { PageHeader } from "@/components/ui";
// Shift times per team: Sun–Thu, optional Fri–Sat, break. Both times empty = "time pending".
// Roster, attendance, labour cost and the Shifts page all read these.
import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getShiftTimes, upsertShiftTime, type ShiftTime } from "@/lib/queries/shift-times";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { TEAMS } from "@/lib/queries/schedule-constants";
import StaffingTargets from "@/components/StaffingTargets";

type Row = Omit<ShiftTime, "friSatStart" | "friSatEnd"> & { friSatStart: string; friSatEnd: string };
const pair = (a: string, b: string) => (a === "" && b === "") || (/^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b));

export default function ShiftTimesPage() {
  const { t, locale } = useLang();
  const de = locale === "de";
  const teamLabel = (k: string) => (TEAMS.includes(k) ? t("teams." + k) : k);
  const shiftLabel = (k: string) => (["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await getShiftTimes();
      if (res.ok) setRows(res.items.map((r) => ({ ...r, friSatStart: r.friSatStart ?? "", friSatEnd: r.friSatEnd ?? "" })));
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const edit = (r: Row, patch: Partial<Row>) => setRows((cur) => cur.map((x) => (x.team === r.team && x.shift === r.shift ? { ...x, ...patch } : x)));

  async function save(row: Row) {
    if (!pair(row.start, row.end) || !pair(row.friSatStart, row.friSatEnd)) { toast(t("shiftcfg.invalidTime"), "error"); return; }
    setBusy(row.team + row.shift);
    try {
      const res = await upsertShiftTime({ team: row.team, shift: row.shift, start: row.start, end: row.end, friSatStart: row.friSatStart, friSatEnd: row.friSatEnd, breakMins: Number(row.breakMins) || 0 });
      if (res.ok) { toast(t("shiftcfg.saved"), "success"); load(); } else toast(res.error || t("shiftcfg.saveFailed"), "error");
    } finally { setBusy(null); }
  }

  const teams = [...new Set(rows.map((r) => r.team))];
  const time = (r: Row, k: "start" | "end" | "friSatStart" | "friSatEnd", label: string) =>
    <label><span className="shiftcfg-lbl">{label}</span><input className="form-input" type="time" value={r[k]} onChange={(e) => edit(r, { [k]: e.target.value } as Partial<Row>)} /></label>;

  return (
    <div className="fade-up">
      <PageHeader title={ <><Icon e="⏱️" size={22} /> {t("shiftcfg.title")}</> } />
      {loading ? <CardSkeleton rows={4} /> : teams.map((team) => (
        <div className="mb-5" key={team}>
          <div className="section-label">{teamLabel(team)}</div>
          <div className="u-stack">
            {rows.filter((r) => r.team === team).map((r) => {
              const pending = !r.start && !r.end;
              return (
                <div key={r.shift} className="card p-3">
                  <div className="d-flex ai-c gap-2 mb-3">
                    <div className="u-flex1 t-md fw-6 u-text">{shiftLabel(r.shift)}</div>
                    {pending && <span className="shift-badge is-pending">{t("roster.timePending")}</span>}
                    <span className={`shift-scope${r.scope === "branch" ? " is-branch" : ""}`}>{r.scope === "branch" ? t("shiftcfg.scopeBranch") : t("shiftcfg.scopeDefault")}</span>
                  </div>
                  <div className="shiftcfg-grid">
                    {time(r, "start", de ? "So–Do Beginn" : "Sun–Thu start")}
                    {time(r, "end", de ? "So–Do Ende" : "Sun–Thu end")}
                    {time(r, "friSatStart", de ? "Fr–Sa Beginn" : "Fri–Sat start")}
                    {time(r, "friSatEnd", de ? "Fr–Sa Ende" : "Fri–Sat end")}
                    <label><span className="shiftcfg-lbl">{t("shiftcfg.breakLabel")}</span><input className="form-input" type="number" min={0} value={r.breakMins} onChange={(e) => edit(r, { breakMins: Number(e.target.value) || 0 })} /></label>
                    <button className="btn-gold" onClick={() => save(r)} disabled={busy === r.team + r.shift}>{t("shiftcfg.save")}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!loading && <StaffingTargets />}
    </div>
  );
}

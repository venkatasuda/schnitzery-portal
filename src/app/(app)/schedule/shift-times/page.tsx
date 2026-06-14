"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { getShiftTimes, upsertShiftTime } from "@/lib/queries/shift-times";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

type Row = { team: string; shift: string; start: string; end: string; breakMins: number; scope: string };

export default function ShiftTimesPage() {
  const { t } = useLang();
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await getShiftTimes();
    if (res.ok) setRows((res.items as Row[]).map((r) => ({ ...r })));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function edit(team: string, shift: string, field: "start" | "end" | "breakMins", val: string) {
    setRows((cur) => cur.map((r) => (r.team === team && r.shift === shift ? { ...r, [field]: field === "breakMins" ? Number(val) || 0 : val } : r)));
  }

  async function save(row: Row) {
    if (!/^\d{2}:\d{2}$/.test(row.start) || !/^\d{2}:\d{2}$/.test(row.end)) { toast(t("shiftcfg.invalidTime"), "error"); return; }
    setBusy(row.team + row.shift);
    const res = await upsertShiftTime({ team: row.team, shift: row.shift, start: row.start, end: row.end, breakMins: Number(row.breakMins) || 0 });
    setBusy(null);
    if (res.ok) { toast(t("shiftcfg.saved"), "success"); load(); }
    else toast(res.error || t("shiftcfg.saveFailed"), "error");
  }

  const teams = [...new Set(rows.map((r) => r.team))];

  return (
    <div className="fade-up">
      <div className="page-title">⏱️ {t("shiftcfg.title")}</div>
      <div className="page-sub">{t("shiftcfg.subtitle")}</div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : (
        teams.map((team) => (
          <div key={team} style={{ marginBottom: 18 }}>
            <div className="section-label">{teamLabel(team)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.filter((r) => r.team === team).map((r) => {
                const crosses = r.start && r.end && r.end <= r.start;
                const isBranch = r.scope === "branch";
                const saving = busy === r.team + r.shift;
                return (
                  <div key={r.shift} className="card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{r.shift}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: isBranch ? "var(--gold)" : "var(--gray)", background: isBranch ? "rgba(212,168,71,0.15)" : "rgba(128,128,128,0.12)", padding: "3px 8px", borderRadius: 20 }}>
                        {isBranch ? t("shiftcfg.scopeBranch") : t("shiftcfg.scopeDefault")}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <label style={{ flex: 1 }}>
                        <div style={lbl}>{t("shiftcfg.start")}</div>
                        <input type="time" value={r.start} onChange={(e) => edit(r.team, r.shift, "start", e.target.value)} style={input} />
                      </label>
                      <label style={{ flex: 1 }}>
                        <div style={lbl}>{t("shiftcfg.end")}</div>
                        <input type="time" value={r.end} onChange={(e) => edit(r.team, r.shift, "end", e.target.value)} style={input} />
                      </label>
                      <label style={{ width: 78 }}>
                        <div style={lbl}>{t("shiftcfg.breakLabel")}</div>
                        <input type="number" min={0} value={r.breakMins} onChange={(e) => edit(r.team, r.shift, "breakMins", e.target.value)} style={input} />
                      </label>
                      <button onClick={() => save(r)} disabled={saving} style={{ padding: "10px 14px", background: "var(--gold)", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, whiteSpace: "nowrap" }}>{t("shiftcfg.save")}</button>
                    </div>
                    {crosses && <div style={{ fontSize: 11, color: "#e8a35a", marginTop: 8 }}>🌙 {t("shiftcfg.crossMidnight")}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Link href="/schedule-hub" style={{ display: "block", textAlign: "center", marginTop: 8, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>← {t("schedhub.title")}</Link>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
const input: React.CSSProperties = { width: "100%", padding: "9px 10px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 13, boxSizing: "border-box" };
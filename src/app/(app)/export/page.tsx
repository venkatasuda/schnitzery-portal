"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/components/LanguageProvider";
import Link from "next/link";
import { getPayrollSummary, setPayrollSettings, setPayrollApproval } from "@/lib/queries/payroll";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

const eur = (n: number | null) => (n == null ? "—" : `€${n.toFixed(2)}`);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "");

export default function PayrollExportPage() {
  const { t } = useLang();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [settings, setSettings] = useState({ otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" });
  const [run, setRun] = useState<{ status: "draft" | "approved"; approvedBy: string | null; approvedAt: string | null }>({ status: "draft", approvedBy: null, approvedAt: null });
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(settings);

  const load = useCallback(() => {
    setLoading(true);
    getPayrollSummary(month).then((r) => {
      if (r.ok) {
        setRows(r.rows || []); setTotals(r.totals || {});
        setSettings(r.settings); setDraft(r.settings); setRun(r.run);
      } else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, [month]);
  useEffect(() => { load(); }, [load]);

  async function saveRules() {
    setBusy(true);
    const res = await setPayrollSettings(draft);
    setBusy(false);
    if (res.ok) { toast(t("pay.rulesSaved"), "success"); setShowRules(false); load(); }
    else toast(res.error || t("pay.saveFailed"), "error");
  }

  async function toggleApproval(approve: boolean) {
    setBusy(true);
    const res = await setPayrollApproval(month, approve);
    setBusy(false);
    if (res.ok) { toast(approve ? t("pay.approveConfirmed") : t("pay.reopened"), "success"); load(); }
    else toast(res.error || t("pay.saveFailed"), "error");
  }

  // Shared export matrix
  function matrix() {
    const header = [t("pay.cCode"), t("pay.cName"), t("pay.cTeam"), t("pay.cShifts"), t("pay.cRegular"), t("pay.cOvertime"),
      t("pay.cWeekend"), t("pay.cHoliday"), t("pay.cNight"), t("pay.cBreak"), t("pay.cPaid"), t("pay.cWage"), t("pay.cGross")];
    const body = rows.map((r) => [r.code, r.name, r.team, r.shifts, r.regularH, r.overtimeH, r.weekendH, r.holidayH, r.nightH, r.breakH, r.paidH, r.wage ?? "", r.gross ?? ""]);
    const totalRow = ["", t("pay.cTotal"), "", "", totals.regularH, totals.overtimeH, totals.weekendH, totals.holidayH, totals.nightH, totals.breakH, totals.paidH, "", totals.gross];
    return { header, body, totalRow };
  }

  function downloadCsv() {
    if (!rows.length) { toast(t("pay.nothingExport"), "error"); return; }
    const { header, body, totalRow } = matrix();
    const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [header, ...body, totalRow].map((r) => r.map(esc).join(","));
    dl(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), `payroll-${month}.csv`);
    toast(t("pay.downloaded"), "success");
  }

  function downloadExcel() {
    if (!rows.length) { toast(t("pay.nothingExport"), "error"); return; }
    const { header, body, totalRow } = matrix();
    const td = (v: any, b = false) => `<td style="${b ? "font-weight:bold;" : ""}border:1px solid #ccc;padding:4px 8px;">${String(v ?? "")}</td>`;
    const tr = (cells: any[], b = false) => `<tr>${cells.map((c) => td(c, b)).join("")}</tr>`;
    const html = `<html><head><meta charset="utf-8"></head><body><table>${tr(header, true)}${body.map((r) => tr(r)).join("")}${tr(totalRow, true)}</table></body></html>`;
    dl(new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" }), `payroll-${month}.xls`);
    toast(t("pay.downloaded"), "success");
  }

  function payrollReport() {
    if (!rows.length) { toast(t("pay.nothingExport"), "error"); return; }
    const { header, body, totalRow } = matrix();
    const status = run.status === "approved"
      ? `<span style="color:#1e8449">✓ ${t("pay.reportApproved")} ${run.approvedBy || ""} · ${fmtDate(run.approvedAt)}</span>`
      : `<span style="color:#b9770e">${t("pay.reportDraft")}</span>`;
    const td = (v: any, b = false, r = false) => `<td style="${b ? "font-weight:bold;" : ""}${r ? "text-align:right;" : ""}border:1px solid #ddd;padding:6px 10px;font-size:12px;">${String(v ?? "")}</td>`;
    const rowHtml = (cells: any[], b = false) => `<tr>${cells.map((c, i) => td(c, b, i >= 3)).join("")}</tr>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><meta charset="utf-8"><title>Payroll ${month}</title></head>
      <body style="font-family:Arial,sans-serif;padding:28px;color:#222;">
        <h2 style="margin:0;">Schnitzery — ${t("pay.reportTitle")}</h2>
        <div style="color:#666;margin:4px 0 2px;">${month}</div>
        <div style="margin-bottom:16px;">${status}</div>
        <table style="border-collapse:collapse;width:100%;">${rowHtml(header, true)}${body.map((r) => rowHtml(r)).join("")}${rowHtml(totalRow, true)}</table>
        <p style="margin-top:34px;font-size:12px;color:#666;">${t("pay.signature")}</p>
        <div style="margin-top:30px;border-top:1px solid #888;width:240px;"></div>
      </body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  }

  function dl(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const cell: React.CSSProperties = { padding: "7px 9px", borderRadius: 7, background: "var(--dark2)", textAlign: "center" };
  const lbl: React.CSSProperties = { fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.4 };
  const inp: React.CSSProperties = { padding: "8px 10px", background: "var(--dark3)", color: "var(--white)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, fontSize: 14, width: 90 };

  return (
    <div className="fade-up">
      <div className="page-title">💶 {t("pay.title")}</div>
      <div className="page-sub">{t("pay.subtitle")}</div>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "var(--gray)" }}>{t("pay.month")}</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...inp, width: "auto" }} />
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowRules((v) => !v)} style={{ padding: "8px 12px", background: "var(--dark3)", color: "var(--white)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>⚙ {t("pay.rules")}</button>
      </div>

      {showRules && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--gray)" }}>{t("pay.rulesHint")}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div><div style={lbl}>{t("pay.otDaily")}</div><input style={inp} type="number" value={draft.otDailyHours} onChange={(e) => setDraft({ ...draft, otDailyHours: Number(e.target.value) })} /></div>
            <div><div style={lbl}>{t("pay.nightStart")}</div><input style={inp} type="time" value={draft.nightStart} onChange={(e) => setDraft({ ...draft, nightStart: e.target.value })} /></div>
            <div><div style={lbl}>{t("pay.nightEnd")}</div><input style={inp} type="time" value={draft.nightEnd} onChange={(e) => setDraft({ ...draft, nightEnd: e.target.value })} /></div>
          </div>
          <button onClick={saveRules} disabled={busy} style={{ alignSelf: "flex-start", padding: "9px 18px", background: "var(--gold)", color: "#1a1a1a", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("pay.saveRules")}</button>
        </div>
      )}

      {/* APPROVAL BANNER */}
      {!loading && rows.length > 0 && (
        run.status === "approved" ? (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: "3px solid #1e8449" }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div style={{ flex: 1, fontSize: 13 }}>{t("pay.approvedBy").replace("{by}", run.approvedBy || "—").replace("{date}", fmtDate(run.approvedAt))}</div>
            <button onClick={() => toggleApproval(false)} disabled={busy} style={{ padding: "7px 12px", background: "var(--dark3)", color: "var(--gray)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>{t("pay.reopenBtn")}</button>
          </div>
        ) : (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: "3px solid #b9770e" }}>
            <span style={{ fontSize: 18 }}>📝</span>
            <div style={{ flex: 1, fontSize: 13 }}>{t("pay.notApproved")}</div>
            <button onClick={() => toggleApproval(true)} disabled={busy} style={{ padding: "8px 14px", background: "#1e8449", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t("pay.approveBtn")}</button>
          </div>
        )
      )}

      {loading ? (
        <CardSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 30, color: "var(--gray)" }}>{t("pay.noHours")}</div>
      ) : (
        <>
          {/* totals */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "4px 0 12px" }}>
            <div className="card" style={{ padding: 12, textAlign: "center" }}><div style={lbl}>{t("pay.headcount")}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{rows.length}</div></div>
            <div className="card" style={{ padding: 12, textAlign: "center" }}><div style={lbl}>{t("pay.totalPaid")}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{totals.paidH}h</div></div>
            <div className="card" style={{ padding: 12, textAlign: "center" }}><div style={lbl}>{t("pay.totalGross")}</div><div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>{eur(totals.gross)}</div></div>
          </div>

          {/* per-employee cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} className="card" style={{ padding: 13 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--gray)" }}>{r.team} · {r.shifts} {t("pay.shiftsShort")}</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>{eur(r.gross)}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, fontSize: 13 }}>
                  <div style={cell}><div style={lbl}>{t("pay.colPaid")}</div><div style={{ fontWeight: 700 }}>{r.paidH}h</div></div>
                  <div style={cell}><div style={lbl}>{t("pay.colRegular")}</div><div>{r.regularH}h</div></div>
                  <div style={{ ...cell, background: r.overtimeH > 0 ? "rgba(230,126,34,0.12)" : "var(--dark2)" }}><div style={lbl}>{t("pay.colOvertime")}</div><div>{r.overtimeH}h</div></div>
                  <div style={cell}><div style={lbl}>{t("pay.colBreak")}</div><div>{r.breakH}h</div></div>
                  <div style={cell}><div style={lbl}>{t("pay.colWeekend")}</div><div>{r.weekendH}h</div></div>
                  <div style={cell}><div style={lbl}>{t("pay.colHoliday")}</div><div>{r.holidayH}h</div></div>
                  <div style={cell}><div style={lbl}>{t("pay.colNight")}</div><div>{r.nightH}h</div></div>
                  <div style={cell}><div style={lbl}>{t("pay.cWage")}</div><div style={{ color: r.wage == null ? "#e8a35a" : "var(--white)" }}>{r.wage == null ? t("pay.setWage") : eur(r.wage)}</div></div>
                </div>
              </div>
            ))}
          </div>

          {/* exports */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={downloadCsv} style={{ flex: 1, minWidth: 100, padding: "11px", background: "var(--gold)", color: "#1a1a1a", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("pay.exportCsv")}</button>
            <button onClick={downloadExcel} style={{ flex: 1, minWidth: 100, padding: "11px", background: "linear-gradient(135deg,#1e8449,#27ae60)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("pay.exportExcel")}</button>
            <button onClick={payrollReport} style={{ flex: 1, minWidth: 100, padding: "11px", background: "var(--dark3)", color: "var(--white)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("pay.exportReport")}</button>
          </div>
          <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8 }}>{t("pay.overlapNote")}</div>
        </>
      )}

      {rows.some((r) => r.wage == null) && (
        <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 10 }}>
          {t("pay.wageNoteA")} <Link href="/labor" style={{ color: "var(--gold)", textDecoration: "none" }}>{t("pay.laborLink")}</Link> {t("pay.wageNoteB")}
        </div>
      )}

      <Link href="/profile" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("pay.backProfile")}</Link>
    </div>
  );
}
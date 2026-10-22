"use client";

import { berlinMonth } from "@/lib/time/berlinDate";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getPayrollSummary, setPayrollSettings, setPayrollApproval } from "@/lib/queries/payroll";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

const eur = (n: number | null) => (n == null ? "—" : `€${n.toFixed(2)}`);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "");
const htmlText = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function PayrollExportPage() {
  const { t } = useLang();
  const [month, setMonth] = useState(() => berlinMonth());
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [settings, setSettings] = useState({ otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" });
  const [run, setRun] = useState<{ status: "draft" | "approved"; approvedBy?: string | null; approvedAt?: string | null; frozen?: boolean; archived?: boolean }>({ status: "draft", approvedBy: null, approvedAt: null });
  const [history, setHistory] = useState<{ id: string; approved_name: string; approved_at: string }[]>([]);
  const [approvalId, setApprovalId] = useState("");
  const [readiness, setReadiness] = useState({ canApprove: false, unapprovedShifts: 0, missingWages: 0, invalidShifts: 0, monthClosed: false });
  const [revision, setRevision] = useState("");
  const [error, setError] = useState("");
  const request = useRef(0);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(settings);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError(""); setRows([]); setTotals({}); setDenied(false); setShowRules(false);
    try {
      const r = await getPayrollSummary(month, approvalId || undefined);
      if (id !== request.current) return;
      if (r.ok) {
        setRows(r.rows || []); setTotals(r.totals || {});
        setSettings(r.settings); setDraft(r.settings); setRun(r.run); setReadiness(r.readiness); setRevision(r.revision); setHistory(r.history);
      } else { setError(r.error || "Payroll unavailable."); if (r.error?.includes("Managers")) setDenied(true); }
    } catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : "Payroll unavailable."); }
    finally { if (id === request.current) setLoading(false); }
  }, [month, approvalId]);
  useEffect(() => { load(); return () => { request.current++; }; }, [load]);

  async function saveRules() {
    setBusy(true);
    try {
      const res = await setPayrollSettings(draft);
      if (res.ok) { toast(t("pay.rulesSaved"), "success"); setShowRules(false); load(); }
      else toast(res.error || t("pay.saveFailed"), "error");
    } catch { toast(t("pay.saveFailed"), "error"); }
    finally { setBusy(false); }
  }

  async function toggleApproval(approve: boolean) {
    setBusy(true);
    try {
      const res = await setPayrollApproval(month, approve, undefined, revision);
      if (res.ok) { toast(approve ? t("pay.approveConfirmed") : t("pay.reopened"), "success"); load(); }
      else toast(res.error || t("pay.saveFailed"), "error");
    } catch { toast(t("pay.saveFailed"), "error"); }
    finally { setBusy(false); }
  }

  // Shared export matrix
  function matrix() {
    const header = [t("pay.cCode"), t("pay.cName"), t("pay.cTeam"), t("pay.cShifts"), t("pay.cRegular"), t("pay.cOvertime"),
      t("pay.cWeekend"), t("pay.cHoliday"), t("pay.cNight"), t("pay.cBreak"), t("pay.cPaid"), t("pay.cWage"), t("pay.cGross")];
    const body = rows.map((r) => [r.code, r.name, r.team, r.shifts, r.regularH, r.overtimeH, r.weekendH, r.holidayH, r.nightH, r.breakH, r.paidH, r.wage ?? (r.rates?.length > 1 ? r.rates.map((v: any) => `${v.wage} EUR/h: ${v.paidMin} min`).join("; ") : ""), r.gross ?? ""]);
    const totalRow = ["", t("pay.cTotal"), "", "", totals.regularH, totals.overtimeH, totals.weekendH, totals.holidayH, totals.nightH, totals.breakH, totals.paidH, "", totals.gross];
    return { header, body, totalRow };
  }

  function downloadCsv() {
    if (!rows.length) { toast(t("pay.nothingExport"), "error"); return; }
    const { header, body, totalRow } = matrix();
    const esc = (v: any) => { const s = typeof v === "string" && /^[\s]*[=+@-]/.test(v) ? "'" + v : String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [header, ...body, totalRow].map((r) => r.map(esc).join(","));
    dl(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), `payroll-${month}.csv`);
    toast(t("pay.downloaded"), "success");
  }

  function downloadExcel() {
    if (!rows.length) { toast(t("pay.nothingExport"), "error"); return; }
    const { header, body, totalRow } = matrix();
    const td = (v: any, b = false) => `<td style="${b ? "font-weight:bold;" : ""}border:1px solid #ccc;padding:4px 8px;">${htmlText(typeof v === "string" && /^\s*[=+@-]/.test(v) ? "'" + v : v)}</td>`;
    const tr = (cells: any[], b = false) => `<tr>${cells.map((c) => td(c, b)).join("")}</tr>`;
    const html = `<html><head><meta charset="utf-8"></head><body><table>${tr(header, true)}${body.map((r) => tr(r)).join("")}${tr(totalRow, true)}</table></body></html>`;
    dl(new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" }), `payroll-${month}.xls`);
    toast(t("pay.downloaded"), "success");
  }

  function payrollReport() {
    if (!rows.length) { toast(t("pay.nothingExport"), "error"); return; }
    const { header, body, totalRow } = matrix();
    const status = run.status === "approved"
      ? `<span style="color:#1e8449">✓ ${t("pay.reportApproved")} ${htmlText(run.approvedBy)} · ${fmtDate(run.approvedAt)} · ${htmlText(t(run.frozen ? "pay.frozen" : "pay.legacy"))}</span>`
      : `<span style="color:#b9770e">${t("pay.reportDraft")}</span>`;
    const td = (v: any, b = false, r = false) => `<td style="${b ? "font-weight:bold;" : ""}${r ? "text-align:right;" : ""}border:1px solid #ddd;padding:6px 10px;font-size:12px;">${htmlText(v)}</td>`;
    const rowHtml = (cells: any[], b = false) => `<tr>${cells.map((c, i) => td(c, b, i >= 3)).join("")}</tr>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><meta charset="utf-8"><title>Payroll ${htmlText(month)}</title></head>
      <body style="font-family:Arial,sans-serif;padding:28px;color:#222;">
        <h2 style="margin:0;">Schnitzery — ${t("pay.reportTitle")}</h2>
        <div style="color:#666;margin:4px 0 2px;">${htmlText(month)}</div>
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

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const lbl: React.CSSProperties = { fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.4 };
  const inp: React.CSSProperties = { padding: "8px 10px", background: "var(--dark3)", color: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, width: 90 };

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="💶" size={22} /> {t("pay.title")}</h1>
      <div className="page-sub">{t("pay.subtitle")}</div>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label className="ui-muted" htmlFor="payroll-month">{t("pay.month")}</label>
        <input id="payroll-month" type="month" value={month} disabled={busy} onChange={(e) => { setMonth(e.target.value); setApprovalId(""); setHistory([]); }} style={{ ...inp, width: "auto" }} />
        {history.length > 0 && <label style={{ fontSize: 12 }}>{t("pay.history")} <select value={approvalId} disabled={busy || loading} onChange={e => setApprovalId(e.target.value)} style={{ ...inp, width: "auto", maxWidth: "100%" }}>
          <option value="">{t("pay.current")}</option>{history.map(h => <option key={h.id} value={h.id}>{fmtDate(h.approved_at)} · {h.approved_name}</option>)}
        </select></label>}
        <div className="u-flex1" />
        <button disabled={loading || busy || !!error || run.status === "approved"} onClick={() => setShowRules((v) => !v)} style={{ padding: "8px 12px", background: "var(--dark3)", color: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}><Icon className="u-icon-inline" e="⚙" size={14} /> {t("pay.rules")}</button>
      </div>

      {showRules && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="ui-muted">{t("pay.rulesHint")}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label><div style={lbl}>{t("pay.otDaily")}</div><input style={inp} type="number" min={0} max={24} step="any" value={draft.otDailyHours} onChange={(e) => setDraft({ ...draft, otDailyHours: Number(e.target.value) })} /></label>
            <label><div style={lbl}>{t("pay.nightStart")}</div><input style={inp} type="time" value={draft.nightStart} onChange={(e) => setDraft({ ...draft, nightStart: e.target.value })} /></label>
            <label><div style={lbl}>{t("pay.nightEnd")}</div><input style={inp} type="time" value={draft.nightEnd} onChange={(e) => setDraft({ ...draft, nightEnd: e.target.value })} /></label>
          </div>
          <button onClick={saveRules} disabled={busy} className="btn-gold" style={{ alignSelf: "flex-start" }}>{t("pay.saveRules")}</button>
        </div>
      )}

      {/* APPROVAL BANNER */}
      {!loading && !error && (rows.length > 0 || run.status === "approved") && (
        run.status === "approved" ? (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderLeft: "3px solid var(--success)" }}>
            <Icon e="✅" size={18} color="var(--success)" />
            <div style={{ flex: "1 1 260px", fontSize: 13 }}>{t("pay.approvedBy").replace("{by}", run.approvedBy || "—").replace("{date}", fmtDate(run.approvedAt))}<div style={{ marginTop: 6, color: "var(--gray)" }}>{t(run.frozen ? "pay.frozen" : "pay.legacy")}</div></div>
            {!run.archived && <button onClick={() => toggleApproval(false)} disabled={busy} style={{ padding: "7px 12px", background: "var(--dark3)", color: "var(--gray)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>{t("pay.reopenBtn")}</button>}
          </div>
        ) : (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderLeft: "3px solid var(--warn)" }}>
            <Icon e="📝" size={18} color="var(--gold)" />
            <div style={{ flex: "1 1 260px", fontSize: 13 }}>{t("pay.notApproved")}
              {!readiness.monthClosed && <div>{t("pay.closeMonth")}</div>}
              {readiness.unapprovedShifts > 0 && <div><Link href="/approvals">{t("pay.reviewShifts", { count: readiness.unapprovedShifts })}</Link></div>}
              {readiness.missingWages > 0 && <div><Link href="/labor">{t("pay.missingRates", { count: readiness.missingWages })}</Link></div>}
              {readiness.invalidShifts > 0 && <div><Link href="/attendance-hub">{t("pay.invalidShifts", { count: readiness.invalidShifts })}</Link></div>}
            </div>
            <button onClick={() => toggleApproval(true)} disabled={busy || !readiness.canApprove} style={{ padding: "8px 14px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t("pay.approveBtn")}</button>
          </div>
        )
      )}

      {loading ? (
        <CardSkeleton rows={4} />
      ) : error ? (
        <div className="card" role="alert"><p>{error}</p><button onClick={load}>{t("business.retry")}</button></div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 30, color: "var(--gray)" }}>{t("pay.noHours")}</div>
      ) : (
        <>
          {/* totals */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, margin: "4px 0 12px" }}>
            <div className="card" style={{ padding: 12, textAlign: "center" }}><div style={lbl}>{t("pay.headcount")}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{rows.length}</div></div>
            <div className="card" style={{ padding: 12, textAlign: "center" }}><div style={lbl}>{t("pay.totalPaid")}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{totals.paidH}h</div></div>
            <div className="card" style={{ padding: 12, textAlign: "center" }}><div style={lbl}>{t("pay.totalGross")}</div><div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>{eur(readiness.missingWages ? null : totals.gross)}</div></div>
          </div>

          <div className="table-scroll" role="region" aria-label={t("pay.reportTitle")} tabIndex={0}>
            <table className="data-table">
              <thead><tr><th scope="col" style={{ position: "sticky", left: 0, zIndex: 2 }}>{t("pay.cName")}</th>{["cShifts", "cPaid", "cRegular", "cOvertime", "cBreak", "cWeekend", "cHoliday", "cNight", "cWage", "cGross"].map(key => <th key={key} scope="col" className="numeric">{t(`pay.${key}`)}</th>)}</tr></thead>
              <tbody>{rows.map(r => <tr key={r.userId || r.code || r.name}>
                <th scope="row" style={{ whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1, background: "var(--dark)", color: "var(--white)", fontSize: 14 }}>{r.name}<div className="muted">{r.code} · {r.team}</div>{r.invalidShifts > 0 && <div><Link href="/attendance-hub">{t("pay.invalidShifts", { count: r.invalidShifts })}</Link></div>}</th>
                {[r.shifts, r.paidH, r.regularH, r.overtimeH, r.breakH, r.weekendH, r.holidayH, r.nightH].map((value, i) => <td key={i} className="numeric">{value}</td>)}
                <td className="numeric">{r.wage == null ? r.gross != null && r.rates?.length > 1 ? r.rates.map((v: any) => eur(v.wage)).join(" / ") : <Link href="/labor">{t("pay.setWage")}</Link> : eur(r.wage)}</td>
                <td className="numeric" style={{ fontWeight: 700 }}>{eur(r.gross)}</td>
              </tr>)}</tbody>
            </table>
          </div>

          {/* exports */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={downloadCsv} className="btn-gold">{t("pay.exportCsv")}</button>
            <button onClick={downloadExcel} className="btn-secondary">{t("pay.exportExcel")}</button>
            <button onClick={payrollReport} className="btn-secondary">{t("pay.exportReport")}</button>
          </div>
          <div className="ui-note">{t("pay.overlapNote")}</div>
          <div className="ui-note">{t("pay.ratesNote")}</div>
        </>
      )}

      {rows.some((r) => r.gross == null) && (
        <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 10 }}>
          {t("pay.wageNoteA")} <Link href="/labor" style={{ color: "var(--gold)", textDecoration: "none" }}>{t("pay.laborLink")}</Link> {t("pay.wageNoteB")}
        </div>
      )}

      <Link className="ui-back-link" href="/profile">{t("pay.backProfile")}</Link>
    </div>
  );
}

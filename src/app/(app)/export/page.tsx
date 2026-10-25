"use client";

import { formatEur } from "@/lib/format";
import { serverText } from "@/lib/i18n/serverMessages";
import { berlinMonth } from "@/lib/time/berlinDate";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getPayrollSummary, setPayrollSettings, setPayrollApproval } from "@/lib/queries/payroll";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { Field, Stat, StatGrid } from "@/components/ui";

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "");
const htmlText = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function PayrollExportPage() {
  const { t, locale } = useLang();
  const eur = (n: number | null) => formatEur(n, locale, 2);
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
      } else { setError(serverText(r.error ?? "", locale) || "Payroll unavailable."); if (r.error?.includes("Managers")) setDenied(true); }
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

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="💶" size={22} /> {t("pay.title")}</h1>
      <div className="page-sub">{t("pay.subtitle")}</div>

      <div className="card d-flex ai-c gap-3 f-wrap">
        <label className="ui-muted" htmlFor="payroll-month">{t("pay.month")}</label>
        <input id="payroll-month" type="month" value={month} disabled={busy} onChange={(e) => { setMonth(e.target.value); setApprovalId(""); setHistory([]); }} className="form-input ui-input-sm" />
        {history.length > 0 && <label className="t-xs">{t("pay.history")} <select value={approvalId} disabled={busy || loading} onChange={e => setApprovalId(e.target.value)} className="form-select ui-input-sm">
          <option value="">{t("pay.current")}</option>{history.map(h => <option key={h.id} value={h.id}>{fmtDate(h.approved_at)} · {h.approved_name}</option>)}
        </select></label>}
        <div className="u-flex1" />
        <button disabled={loading || busy || !!error || run.status === "approved"} onClick={() => setShowRules((v) => !v)} className="btn-secondary ui-btn-sm" aria-expanded={showRules}><Icon e="⚙" size={14} /> {t("pay.rules")}</button>
      </div>

      {showRules && (
        <div className="card d-flex f-col gap-3">
          <div className="ui-muted">{t("pay.rulesHint")}</div>
          <div className="d-flex gap-4 f-wrap">
            <Field label={t("pay.otDaily")}><input className="form-input ui-input-sm" type="number" min={0} max={24} step="any" value={draft.otDailyHours} onChange={(e) => setDraft({ ...draft, otDailyHours: Number(e.target.value) })} /></Field>
            <Field label={t("pay.nightStart")}><input className="form-input ui-input-sm" type="time" value={draft.nightStart} onChange={(e) => setDraft({ ...draft, nightStart: e.target.value })} /></Field>
            <Field label={t("pay.nightEnd")}><input className="form-input ui-input-sm" type="time" value={draft.nightEnd} onChange={(e) => setDraft({ ...draft, nightEnd: e.target.value })} /></Field>
          </div>
          <button onClick={saveRules} disabled={busy} className="btn-gold as-start">{t("pay.saveRules")}</button>
        </div>
      )}

      {/* APPROVAL BANNER */}
      {!loading && !error && (rows.length > 0 || run.status === "approved") && (
        run.status === "approved" ? (
          <div className="card ui-banner success" role="status">
            <Icon e="✅" size={18} color="var(--success)" />
            <div className="ui-banner-body">{t("pay.approvedBy").replace("{by}", run.approvedBy || "—").replace("{date}", fmtDate(run.approvedAt))}<div className="mt-2 u-muted">{t(run.frozen ? "pay.frozen" : "pay.legacy")}</div></div>
            {!run.archived && <button onClick={() => toggleApproval(false)} disabled={busy} className="btn-secondary ui-btn-sm">{t("pay.reopenBtn")}</button>}
          </div>
        ) : (
          <div className="card ui-banner">
            <Icon e="📝" size={18} color="var(--gold-ink)" />
            <div className="ui-banner-body">{t("pay.notApproved")}
              {!readiness.monthClosed && <div>{t("pay.closeMonth")}</div>}
              {readiness.unapprovedShifts > 0 && <div><Link href="/approvals">{t("pay.reviewShifts", { count: readiness.unapprovedShifts })}</Link></div>}
              {readiness.missingWages > 0 && <div><Link href="/labor">{t("pay.missingRates", { count: readiness.missingWages })}</Link></div>}
              {readiness.invalidShifts > 0 && <div><Link href="/attendance-hub">{t("pay.invalidShifts", { count: readiness.invalidShifts })}</Link></div>}
            </div>
            <button onClick={() => toggleApproval(true)} disabled={busy || !readiness.canApprove} className="btn-gold">{t("pay.approveBtn")}</button>
          </div>
        )
      )}

      {loading ? (
        <CardSkeleton rows={4} />
      ) : error ? (
        <div className="card" role="alert"><p>{error}</p><button className="btn-secondary" onClick={load}>{t("business.retry")}</button></div>
      ) : rows.length === 0 ? (
        <div className="card ui-empty-msg">{t("pay.noHours")}</div>
      ) : (
        <>
          {/* totals */}
          <StatGrid label={t("pay.reportTitle")}>
            <Stat label={t("pay.headcount")} value={rows.length} />
            <Stat label={t("pay.totalPaid")} value={`${totals.paidH}h`} />
            <Stat label={t("pay.totalGross")} value={eur(readiness.missingWages ? null : totals.gross)} tone="action" />
          </StatGrid>

          <div className="table-scroll" role="region" aria-label={t("pay.reportTitle")} tabIndex={0}>
            <table className="data-table">
              <thead><tr><th scope="col" className="ui-sticky-col">{t("pay.cName")}</th>{["cShifts", "cPaid", "cRegular", "cOvertime", "cBreak", "cWeekend", "cHoliday", "cNight", "cWage", "cGross"].map(key => <th key={key} scope="col" className="numeric">{t(`pay.${key}`)}</th>)}</tr></thead>
              <tbody>{rows.map(r => <tr key={r.userId || r.code || r.name}>
                <th scope="row" className="ui-sticky-col">{r.name}<div className="muted">{r.code} · {r.team}</div>{r.invalidShifts > 0 && <div><Link href="/attendance-hub">{t("pay.invalidShifts", { count: r.invalidShifts })}</Link></div>}</th>
                {[r.shifts, r.paidH, r.regularH, r.overtimeH, r.breakH, r.weekendH, r.holidayH, r.nightH].map((value, i) => <td key={i} className="numeric">{value}</td>)}
                <td className="numeric">{r.wage == null ? r.gross != null && r.rates?.length > 1 ? r.rates.map((v: any) => eur(v.wage)).join(" / ") : <Link href="/labor">{t("pay.setWage")}</Link> : eur(r.wage)}</td>
                <td className="numeric fw-7">{eur(r.gross)}</td>
              </tr>)}</tbody>
            </table>
          </div>

          {/* exports */}
          <div className="d-flex gap-2 mt-4 f-wrap">
            <button onClick={downloadCsv} className="btn-gold">{t("pay.exportCsv")}</button>
            <button onClick={downloadExcel} className="btn-secondary">{t("pay.exportExcel")}</button>
            <button onClick={payrollReport} className="btn-secondary">{t("pay.exportReport")}</button>
          </div>
          <div className="ui-note">{t("pay.overlapNote")}</div>
          <div className="ui-note">{t("pay.ratesNote")}</div>
        </>
      )}

      {rows.some((r) => r.gross == null) && (
        <div className="t-xs u-muted mt-3">
          {t("pay.wageNoteA")} <Link href="/labor" className="ui-text-link">{t("pay.laborLink")}</Link> {t("pay.wageNoteB")}
        </div>
      )}

      <Link className="ui-back-link" href="/profile">{t("pay.backProfile")}</Link>
    </div>
  );
}

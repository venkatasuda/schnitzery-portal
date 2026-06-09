"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPayrollSummary } from "@/lib/queries/payroll";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

const eur = (n: number | null) => (n == null ? "—" : `€${n.toFixed(2)}`);

export default function PayrollExportPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<{ hours: number; gross: number }>({ hours: 0, gross: 0 });
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPayrollSummary(month).then((r) => {
      if (r.ok) { setRows(r.rows || []); setTotals(r.totals || { hours: 0, gross: 0 }); }
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, [month]);

  function downloadCsv() {
    if (rows.length === 0) { toast("Nothing to export for this month.", "error"); return; }
    const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const header = ["Employee Code", "Name", "Team", "Shifts", "Hours", "Hourly Wage (EUR)", "Gross (EUR)"];
    const lines = [header.join(",")];
    for (const r of rows) lines.push([r.code, r.name, r.team, r.shifts, r.hours, r.wage ?? "", r.gross ?? ""].map(esc).join(","));
    lines.push(["", "TOTAL", "", "", totals.hours, "", totals.gross].map(esc).join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payroll-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast("CSV downloaded.", "success");
  }

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  return (
    <div className="fade-up">
      <div className="page-title">📤 Payroll Export</div>
      <div className="page-sub">Monthly hours per staff · download as CSV</div>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "var(--gray)" }}>Month</label>
        <input
          type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          style={{ padding: "8px 10px", background: "var(--dark3)", color: "var(--white)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, fontSize: 14 }}
        />
        <div style={{ flex: 1 }} />
        <button onClick={downloadCsv} disabled={loading || rows.length === 0}
          style={{ padding: "9px 16px", background: rows.length === 0 ? "var(--dark3)" : "var(--gold)", color: rows.length === 0 ? "var(--gray)" : "#1a1a1a", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: rows.length === 0 ? "default" : "pointer" }}>
          ⬇ Download CSV
        </button>
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 30, color: "var(--gray)" }}>No recorded hours for this month.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.6fr 0.7fr 0.9fr", gap: 8, padding: "10px 14px", fontSize: 11, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid rgba(128,128,128,0.15)" }}>
            <span>Name</span><span style={{ textAlign: "center" }}>Shifts</span><span style={{ textAlign: "right" }}>Hours</span><span style={{ textAlign: "right" }}>Wage</span><span style={{ textAlign: "right" }}>Gross</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.6fr 0.7fr 0.9fr", gap: 8, padding: "11px 14px", fontSize: 13, alignItems: "center", borderBottom: i < rows.length - 1 ? "1px solid rgba(128,128,128,0.08)" : "none" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "var(--gray)" }}>{r.team}</div>
              </div>
              <span style={{ textAlign: "center", color: "var(--white)" }}>{r.shifts}</span>
              <span style={{ textAlign: "right", color: "var(--white)" }}>{r.hours}h</span>
              <span style={{ textAlign: "right", color: r.wage == null ? "#e8a35a" : "var(--gray)" }}>{r.wage == null ? "set" : eur(r.wage)}</span>
              <span style={{ textAlign: "right", color: "var(--gold)", fontWeight: 700 }}>{eur(r.gross)}</span>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.6fr 0.7fr 0.9fr", gap: 8, padding: "12px 14px", fontSize: 13, fontWeight: 700, background: "rgba(212,168,71,0.07)", borderTop: "1px solid rgba(128,128,128,0.15)" }}>
            <span style={{ color: "var(--white)" }}>Total</span><span /><span style={{ textAlign: "right", color: "var(--white)" }}>{totals.hours}h</span><span /><span style={{ textAlign: "right", color: "var(--gold)" }}>{eur(totals.gross)}</span>
          </div>
        </div>
      )}

      {rows.some((r) => r.wage == null) && (
        <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 10 }}>
          Rows marked <span style={{ color: "#e8a35a" }}>set</span> have no hourly wage yet — add it on the <Link href="/labor" style={{ color: "var(--gold)", textDecoration: "none" }}>Labor</Link> page and their gross will fill in.
        </div>
      )}

      <Link href="/profile" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>‹ Back to profile</Link>
    </div>
  );
}
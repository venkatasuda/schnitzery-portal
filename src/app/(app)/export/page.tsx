"use client";

import { useEffect, useState } from "react";
import { getPayrollExport } from "@/lib/queries/timepay";

export default function ExportPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [month, setMonth] = useState("");

  async function load(m?: string) {
    setLoading(true);
    const res = await getPayrollExport(m);
    if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setLoading(false); return; }
    setRows(res.rows); setMonth(res.month);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    load(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function downloadCSV() {
    const header = ["Name", "Employee Code", "Shifts", "Hours", "Contract Hours"];
    const lines = rows.map((r) => [r.name, r.code, r.shifts, r.hours, r.contract ?? ""].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payroll_${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  const monthLabel = month ? new Date(month + "-01").toLocaleDateString([], { month: "long", year: "numeric" }) : "";
  const totalHours = rows.reduce((s, r) => s + (r.hours || 0), 0).toFixed(1);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📤 Payroll Export</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Hours per staff member for the month.</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => shiftMonth(-1)} style={navBtn}>‹ Prev</button>
          <span style={{ fontSize: 14, color: "#d4a847", fontWeight: 600, padding: "8px 4px" }}>{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} style={navBtn}>Next ›</button>
        </div>
        {rows.length > 0 && <button onClick={downloadCSV} style={{ ...primaryBtn, width: "auto", padding: "10px 20px" }}>⬇ Download CSV</button>}
      </div>

      {loading ? <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>Loading…</div>
      : rows.length === 0 ? <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>No completed shifts this month.</div>
      : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                <Th>Name</Th><Th>Code</Th><Th right>Shifts</Th><Th right>Hours</Th><Th right>Contract</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <Td>{r.name}</Td><Td>{r.code || "—"}</Td><Td right>{r.shifts}</Td>
                  <Td right><b style={{ color: "#d4a847" }}>{r.hours}h</b></Td>
                  <Td right>{r.contract != null ? `${r.contract}h` : "—"}</Td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                <Td><b>Total</b></Td><Td></Td><Td right></Td>
                <Td right><b style={{ color: "#d4a847" }}>{totalHours}h</b></Td><Td right></Td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, right }: any) {
  return <th style={{ padding: "12px 14px", textAlign: right ? "right" : "left", fontSize: 11, color: "#9a8f8f", fontWeight: 600, letterSpacing: 0.5 }}>{children}</th>;
}
function Td({ children, right }: any) {
  return <td style={{ padding: "11px 14px", textAlign: right ? "right" : "left", color: "#e8e0e0" }}>{children}</td>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const navBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" };
const primaryBtn: React.CSSProperties = { padding: "10px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" };
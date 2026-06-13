"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { submitCorrection, listMyCorrections, cancelCorrection } from "@/lib/queries/corrections";
import { getMyHistory } from "@/lib/queries/attendance";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

const TYPES = [
  { key: "forgot_in", icon: "🟢" },
  { key: "forgot_out", icon: "🔴" },
  { key: "missing", icon: "➕" },
  { key: "incorrect", icon: "✏️" },
];
const needsIn = (tp: string) => tp === "forgot_in" || tp === "missing" || tp === "incorrect";
const needsOut = (tp: string) => tp === "forgot_out" || tp === "missing" || tp === "incorrect";

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "");
const fmtTime = (t?: string | null) => (t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const toTimeInput = (ts?: string | null) => (ts ? new Date(ts).toTimeString().slice(0, 5) : "");
const iso = (date: string, time: string) => {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export default function CorrectionsPage() {
  const { t } = useLang();
  const TYPE_KEY: Record<string, string> = { forgot_in: "typeForgotIn", forgot_out: "typeForgotOut", missing: "typeMissing", incorrect: "typeIncorrect" };
  const typeLabel = (k: string) => t("corr." + (TYPE_KEY[k] || "typeMissing"));

  const [type, setType] = useState<string>("");
  const [logId, setLogId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [h, m] = await Promise.all([getMyHistory(), listMyCorrections()]);
    if ((h as any).ok) setHistory((h as any).sessions || []);
    if (m.ok) setMine(m.items || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function pickType(k: string) {
    setType(k); setLogId(null); setDate(""); setTimeIn(""); setTimeOut(""); setReason("");
  }
  function pickRecord(id: string) {
    const rec = history.find((r) => r.id === id);
    setLogId(id);
    if (rec) {
      setDate(rec.work_date || "");
      setTimeIn(toTimeInput(rec.clock_in));
      setTimeOut(toTimeInput(rec.clock_out));
    }
  }

  async function submit() {
    if (!reason.trim()) { toast(t("corr.needReason"), "error"); return; }
    if (!date) { toast(t("corr.date"), "error"); return; }
    setBusy(true);
    const res = await submitCorrection({
      type,
      targetDate: date,
      attendanceLogId: type === "missing" ? null : logId,
      requestedClockIn: needsIn(type) ? iso(date, timeIn) : null,
      requestedClockOut: needsOut(type) ? iso(date, timeOut) : null,
      reason,
    });
    setBusy(false);
    if (res.ok) { toast(t("corr.submitted"), "success"); pickType(""); await load(); }
    else toast(res.error || t("corr.submitFailed"), "error");
  }

  async function cancel(id: string) {
    const res = await cancelCorrection(id);
    if (res.ok) { toast(t("corr.cancelled"), "success"); await load(); }
  }

  function statusBadge(s: string) {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: t("corr.statusPending"), color: "#e8a35a" },
      approved: { label: t("corr.statusApproved"), color: "#58d68d" },
      rejected: { label: t("corr.statusRejected"), color: "#ec7063" },
    };
    return map[s] || map.pending;
  }

  return (
    <div className="fade-up">
      <div className="page-title">✏️ {t("corr.title")}</div>

      {/* REQUEST FORM */}
      <div className="section-label">{t("corr.request")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
        {TYPES.map((ty) => (
          <button key={ty.key} onClick={() => pickType(ty.key)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 10px", borderRadius: 12, cursor: "pointer",
            background: type === ty.key ? "rgba(212,168,71,0.15)" : "var(--dark2)",
            border: `1px solid ${type === ty.key ? "var(--gold)" : "rgba(128,128,128,0.18)"}`,
            color: "var(--white)", fontSize: 12.5, fontWeight: 600, textAlign: "left",
          }}>
            <span style={{ fontSize: 16 }}>{ty.icon}</span>{typeLabel(ty.key)}
          </button>
        ))}
      </div>

      {type && (
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          {/* record picker (for everything except 'missing') */}
          {type !== "missing" && history.length > 0 && (
            <label style={{ display: "block", marginBottom: 10 }}>
              <div style={lbl}>{t("corr.pickRecord")}</div>
              <select value={logId || ""} onChange={(e) => pickRecord(e.target.value)} style={input}>
                <option value="">—</option>
                {history.slice(0, 30).map((r) => (
                  <option key={r.id} value={r.id}>{fmtDate(r.work_date)} · {fmtTime(r.clock_in)} → {fmtTime(r.clock_out)}</option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={lbl}>{t("corr.date")}</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
          </label>

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            {needsIn(type) && (
              <label style={{ flex: 1 }}>
                <div style={lbl}>{t("corr.reqIn")}</div>
                <input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} style={input} />
              </label>
            )}
            {needsOut(type) && (
              <label style={{ flex: 1 }}>
                <div style={lbl}>{t("corr.reqOut")}</div>
                <input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} style={input} />
              </label>
            )}
          </div>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div style={lbl}>{t("corr.reason")}</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={t("corr.reasonPlaceholder")}
              style={{ ...input, resize: "vertical" }} />
          </label>

          <button onClick={submit} disabled={busy} style={{
            width: "100%", padding: 13, background: "var(--gold)", color: "#1a0e0e", border: "none",
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1,
          }}>{t("corr.submit")}</button>
        </div>
      )}

      {/* MY REQUESTS */}
      <div className="section-label">{t("corr.myRequests")}</div>
      {loading ? (
        <CardSkeleton rows={2} />
      ) : mine.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("corr.none")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mine.map((r) => {
            const b = statusBadge(r.status);
            return (
              <div key={r.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{typeLabel(r.type)} · {fmtDate(r.target_date)}</div>
                    <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 2 }}>
                      {r.requested_clock_in && `${t("corr.reqIn")}: ${fmtTime(r.requested_clock_in)}`}
                      {r.requested_clock_in && r.requested_clock_out && " · "}
                      {r.requested_clock_out && `${t("corr.reqOut")}: ${fmtTime(r.requested_clock_out)}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: b.color, background: `${b.color}22`, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{b.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 8 }}>{r.reason}</div>
                {r.status === "rejected" && r.manager_note && (
                  <div style={{ fontSize: 12, color: "#ec7063", marginTop: 6, background: "rgba(236,112,99,0.1)", borderRadius: 8, padding: "7px 10px" }}>
                    {t("corr.managerNote")} {r.manager_note}
                  </div>
                )}
                {r.status === "pending" && (
                  <button onClick={() => cancel(r.id)} style={{ marginTop: 10, padding: "6px 12px", background: "none", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, color: "var(--gray)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t("corr.cancel")}</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link href="/attendance" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>← {t("att.title")}</Link>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
const input: React.CSSProperties = { width: "100%", padding: "10px 11px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 13, boxSizing: "border-box" };
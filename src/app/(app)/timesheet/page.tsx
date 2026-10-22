"use client";

import { useEffect, useState } from "react";
import { submitLeave, getMyLeave } from "@/lib/queries/leave";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { Field } from "@/components/ui";

export default function LeavePage() {
  const { t } = useLang();
  const stLabel = (st: string) => (["approved", "denied", "pending"].includes(st) ? t("shifts.status_" + st) : st);
  const [tab, setTab] = useState<"request" | "mine">("request");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadMine() {
    setLoading(true);
    const res = await getMyLeave();
    if (res.ok) setRequests(res.requests);
    setLoading(false);
  }

  useEffect(() => { loadMine(); }, []);

  async function submit() {
    setWorking(true);
    const res = await submitLeave(fromDate, toDate, reason);
    setWorking(false);
    if (res.ok) {
      toast(t("leave.submitted"), "success");
      setFromDate(""); setToDate(""); setReason("");
      loadMine();
    } else toast(res.error || t("leave.failSubmit"), "error");
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const statusStyle = (s: string) => ({
    fontSize: 12, padding: "3px 10px", borderRadius: 12,
    background: s === "approved" ? "rgba(39,174,96,0.15)" : s === "denied" ? "rgba(231,76,60,0.15)" : "var(--accent-soft)",
    color: s === "approved" ? "var(--success)" : s === "denied" ? "var(--danger)" : "#d4a847",
  });

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 className="page-title u-row"><Icon e="🌴" size={22} /> {t("leave.title")}</h1>
      <p className="ui-lede">{t("leave.subtitle")}</p>

      <div className="ui-segmented" role="group">
        <TabBtn active={tab === "request"} onClick={() => setTab("request")}>{t("leave.tabRequest")}</TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => { setTab("mine"); loadMine(); }}>{t("shifts.tabMine")}</TabBtn>
      </div>

      {tab === "request" && (
        <div className="card">
          <div className="t-lg fw-7 mb-4">{t("myday.requestTimeOff")}</div>
          <Field label={t("leave.fromDate")}>
            <input className="form-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label={t("leave.toDate")}>
            <input className="form-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label={t("leave.reason")}>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("leave.reasonPlaceholder")} rows={3} style={{ ...input, resize: "vertical" }} />
          </Field>
          <button className="btn-gold ui-block" onClick={submit} disabled={working}>{working ? t("common.submitting") : t("leave.submit")}</button>
        </div>
      )}

      {tab === "mine" && (
        <div>
          {loading ? <CardSkeleton rows={3} />
          : requests.length === 0 ? <div className="card ui-empty-msg">{t("leave.empty")}</div>
          : requests.map((r) => (
            <div key={r.id} style={{ ...card, marginBottom: 8 }}>
              <div className="u-between">
                <div className="ui-strong">{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</div>
                <span style={statusStyle(r.status)}>{stLabel(r.status)}</span>
              </div>
              {r.reason && <div className="t-xs u-muted mt-2">{r.reason}</div>}
              {r.decided_by && r.status !== "pending" && (
                <div className="t-xs u-muted mt-2">{t("leave.decidedBy", { name: r.decided_by })}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Segmented switch: styling from .ui-segmented (docs/DESIGN-SYSTEM.md).
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick}>{children}</button>;
}
const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
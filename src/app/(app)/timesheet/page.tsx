"use client";

import { useEffect, useState } from "react";
import { submitLeave, getMyLeave } from "@/lib/queries/leave";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

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
    background: s === "approved" ? "rgba(39,174,96,0.15)" : s === "denied" ? "rgba(231,76,60,0.15)" : "rgba(212,168,71,0.15)",
    color: s === "approved" ? "var(--success)" : s === "denied" ? "var(--danger)" : "#d4a847",
  });

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-body)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="🌴" size={22} /> {t("leave.title")}</h1>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>{t("leave.subtitle")}</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 12, padding: 4 }}>
        <TabBtn active={tab === "request"} onClick={() => setTab("request")}>{t("leave.tabRequest")}</TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => { setTab("mine"); loadMine(); }}>{t("shifts.tabMine")}</TabBtn>
      </div>

      {tab === "request" && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t("myday.requestTimeOff")}</div>
          <Field label={t("leave.fromDate")}>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={input} />
          </Field>
          <Field label={t("leave.toDate")}>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={input} />
          </Field>
          <Field label={t("leave.reason")}>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("leave.reasonPlaceholder")} rows={3} style={{ ...input, resize: "vertical" }} />
          </Field>
          <button onClick={submit} disabled={working} style={primaryBtn}>{working ? t("common.submitting") : t("leave.submit")}</button>
        </div>
      )}

      {tab === "mine" && (
        <div>
          {loading ? <CardSkeleton rows={3} />
          : requests.length === 0 ? <div style={{ ...card, textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("leave.empty")}</div>
          : requests.map((r) => (
            <div key={r.id} style={{ ...card, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</div>
                <span style={statusStyle(r.status)}>{stLabel(r.status)}</span>
              </div>
              {r.reason && <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 6 }}>{r.reason}</div>}
              {r.decided_by && r.status !== "pending" && (
                <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 6 }}>{t("leave.decidedBy", { name: r.decided_by })}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ flex: 1, padding: "9px", background: active ? "var(--action)" : "transparent", color: active ? "var(--on-action)" : "var(--gray)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
function Field({ label, children }: any) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, color: "var(--gray)", marginBottom: 6 }}>{label}</label>{children}</div>;
}
const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };
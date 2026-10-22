"use client";

import { berlinToday } from "@/lib/time/berlinDate";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getNoShows, getMissingAvailability, getNextWeekStart } from "@/lib/queries/availability";

export default function NoShowPage() {
  const { t } = useLang();
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const shiftLabel = (k: string) => (["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k);
  const [tab, setTab] = useState<"noshow" | "missing">("noshow");
  const [denied, setDenied] = useState(false);

  // no-show
  const [date, setDate] = useState("");
  const [noShows, setNoShows] = useState<any[]>([]);
  const [rosteredCount, setRosteredCount] = useState(0);
  const [nsChecked, setNsChecked] = useState(false);
  const [nsLoading, setNsLoading] = useState(false);

  // missing availability
  const [missing, setMissing] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState<any[]>([]);
  const [missLoading, setMissLoading] = useState(false);

  useEffect(() => {
    const d = berlinToday();
    setDate(d);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "missing") {
      setTab("missing");
      loadMissing();
    }
  }, []);

  async function checkNoShows() {
    setNsLoading(true); setNsChecked(false);
    const res = await getNoShows(date);
    if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setNsLoading(false); return; }
    setNoShows(res.noShows); setRosteredCount(res.rosteredCount || 0); setNsChecked(true);
    setNsLoading(false);
  }

  async function loadMissing() {
    setMissLoading(true);
    const res = await getMissingAvailability();
    if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setMissLoading(false); return; }
    setMissing(res.missing); setSubmitted(res.submitted);
    setMissLoading(false);
  }

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  return (
    <div className="workspace-page">
      <h1 className="page-title u-row"><Icon e="⚠️" size={22} /> {t("ns.title")}</h1>
      <p className="ui-lede">{t("ns.subtitle")}</p>

      <div className="ui-segmented" role="group">
        <TabBtn active={tab === "noshow"} onClick={() => setTab("noshow")}>{t("ns.tabNoShows")}</TabBtn>
        <TabBtn active={tab === "missing"} onClick={() => { setTab("missing"); loadMissing(); }}>{t("ns.tabMissing")}</TabBtn>
      </div>

      {tab === "noshow" && (
        <div className="card">
          <div className="ui-title spaced">{t("ns.checkTitle")}</div>
          <div className="ui-sub">{t("ns.checkSub")}</div>
          <div className="d-flex gap-2 mb-4">
            <input aria-label={t("ns.checkTitle")} type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, flex: 1 }} />
            <button onClick={checkNoShows} disabled={nsLoading} style={{ ...primaryBtn, width: "auto", padding: "0 20px" }}>{nsLoading ? "…" : t("ns.check")}</button>
          </div>
          {nsChecked && (
            rosteredCount === 0 ? (
              <div className="u-muted t-sm u-center p-4">{t("ns.noneRostered")}</div>
            ) : noShows.length === 0 ? (
              <div className="tone-success t-sm u-center p-4">{t("ns.allClockedIn")}</div>
            ) : (
              <div>
                <div className="t-xs tone-danger mb-2">{t("ns.didNotClock", { n: noShows.length, c: rosteredCount })}</div>
                {noShows.map((n, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <span className="ui-strong">{n.name}</span>
                    <span className="ui-muted">{teamLabel(n.team)} · {shiftLabel(n.shift)}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {tab === "missing" && (
        <div className="card">
          <div className="ui-title">{t("ns.missingTitle")}</div>
          <div className="t-xs u-muted mb-4">{t("ns.missingSub")}</div>
          {missLoading ? (
            <div className="u-muted t-sm u-center p-4">{t("common.loading")}</div>
          ) : (
            <>
              {missing.length === 0 ? (
                <div className="tone-success t-sm u-center p-4">{t("ns.allSubmitted")}</div>
              ) : (
                <>
                  <div className="t-xs tone-danger mb-2">{t("ns.notSubmittedN", { n: missing.length })}</div>
                  {missing.map((m) => (
                    <div key={m.id} style={{ padding: "8px 0", fontSize: 14, borderBottom: "1px solid var(--border)" }}>{m.full_name}</div>
                  ))}
                </>
              )}
              {submitted.length > 0 && (
                <div className="mt-4 t-xs u-muted">
                  {t("ns.submittedList", { names: submitted.map((s) => s.full_name).join(", ") })}
                </div>
              )}
            </>
          )}
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
const input: React.CSSProperties = { padding: "11px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { padding: "12px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
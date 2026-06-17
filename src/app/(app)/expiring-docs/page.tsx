"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getDocumentsDashboard } from "@/lib/queries/documents";
import { CardSkeleton } from "@/components/Skeleton";

const DOC_TYPE_KEYS = ["id_card", "tax_id", "contract", "health_certificate", "visa", "work_permit", "training_certificate", "certificate", "other"];

type Tf = (k: string, v?: Record<string, string | number>) => string;
function statusInfo(eff: string, t: Tf): { label: string; color: string } {
  switch (eff) {
    case "approved":  return { label: t("docw.statusApproved"), color: "#58d68d" };
    case "pending":   return { label: t("docw.statusPending"),  color: "#e8a35a" };
    case "rejected":  return { label: t("docw.statusRejected"), color: "#ec7063" };
    case "expiring":  return { label: t("docw.statusExpiring"), color: "#e8a35a" };
    case "expired":   return { label: t("docw.statusExpired"),  color: "#ec7063" };
    default:          return { label: t("docw.statusArchived"), color: "#9a8f8f" };
  }
}
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "";

type Bucket = "all" | "30" | "60" | "90" | "expired" | "pending" | "missing";

export default function ExpiringDocsPage() {
  const { t } = useLang();
  const typeLabel = (k: string) => t("documents.type_" + (DOC_TYPE_KEYS.includes(k) ? k : "other"));

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const [bucket, setBucket] = useState<Bucket>("all");
  const [employee, setEmployee] = useState("");
  const [docType, setDocType] = useState("");

  useEffect(() => {
    getDocumentsDashboard().then((r: any) => {
      if (r.ok) setData(r);
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, []);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const counts = data?.counts || { within30: 0, within60: 0, within90: 0, expired: 0, pending: 0, missing: 0 };
  const allDocs: any[] = data?.docs || [];
  const allMissing: any[] = data?.missing || [];
  const staff: any[] = data?.staff || [];

  function tapBucket(b: Bucket) { setBucket((cur) => (cur === b ? "all" : b)); }

  // Apply employee/type filters, then the active bucket.
  let docs = allDocs;
  if (employee) docs = docs.filter((d) => d.user_id === employee);
  if (docType) docs = docs.filter((d) => d.doc_type === docType);
  if (bucket === "30") docs = docs.filter((d) => d.status === "approved" && d.is_active && d.days != null && d.days >= 0 && d.days <= 30);
  else if (bucket === "60") docs = docs.filter((d) => d.status === "approved" && d.is_active && d.days != null && d.days > 30 && d.days <= 60);
  else if (bucket === "90") docs = docs.filter((d) => d.status === "approved" && d.is_active && d.days != null && d.days > 60 && d.days <= 90);
  else if (bucket === "expired") docs = docs.filter((d) => d.status === "approved" && d.is_active && d.days != null && d.days < 0);
  else if (bucket === "pending") docs = docs.filter((d) => d.status === "pending");
  else if (bucket !== "missing") docs = docs.filter((d) => ["pending", "expiring", "expired"].includes(d.eff)); // "all" = actionable

  let missing = allMissing;
  if (employee) missing = missing.filter((m) => m.userId === employee);
  if (docType) missing = missing.filter((m) => m.docType === docType);

  const cards: { key: Bucket; label: string; n: number; color: string }[] = [
    { key: "30", label: t("docw.within30"), n: counts.within30, color: "#ec7063" },
    { key: "60", label: t("docw.within60"), n: counts.within60, color: "#e8a35a" },
    { key: "90", label: t("docw.within90"), n: counts.within90, color: "#e8a35a" },
    { key: "expired", label: t("docw.expiredCount"), n: counts.expired, color: "#ec7063" },
    { key: "pending", label: t("docw.pendingCount"), n: counts.pending, color: "#e8a35a" },
    { key: "missing", label: t("docw.missingCount"), n: counts.missing, color: "#ec7063" },
  ];

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="📑" size={22} /> {t("exp.title")}</div>
      <div className="page-sub">{t("exp.subtitle")}</div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          {/* BUCKET CARDS (tap to filter) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {cards.map((c) => {
              const on = bucket === c.key;
              return (
                <button key={c.key} onClick={() => tapBucket(c.key)} style={{
                  background: on ? `${c.color}22` : "var(--dark2)", border: `1px solid ${on ? c.color : "rgba(128,128,128,0.18)"}`,
                  borderRadius: 12, padding: "12px 8px", cursor: "pointer", textAlign: "center",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: "var(--font-display)" }}>{c.n}</div>
                  <div style={{ fontSize: 10.5, color: "var(--gray)", marginTop: 2, lineHeight: 1.2 }}>{c.label}</div>
                </button>
              );
            })}
          </div>

          {/* FILTERS */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={sel}>
              <option value="">{t("docw.filterEmployee")}: {t("docw.filterAll")}</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} style={sel}>
              <option value="">{t("docw.filterType")}: {t("docw.filterAll")}</option>
              {DOC_TYPE_KEYS.map((k) => <option key={k} value={k}>{typeLabel(k)}</option>)}
            </select>
          </div>

          {/* MISSING LIST */}
          {bucket === "missing" ? (
            missing.length === 0 ? (
              <EmptyOk t={t} />
            ) : (
              <div className="card" style={{ padding: 8 }}>
                {missing.map((m, i) => (
                  <Link key={`${m.userId}-${m.docType}`} href={`/staff/${m.userId}`} style={rowLink(i < missing.length - 1)}>
                    <Icon e="⚠️" size={18} color="#e8a35a" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>{typeLabel(m.docType)}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#ec7063", background: "#ec706322", padding: "3px 9px", borderRadius: 20 }}>{t("docw.statusMissing")}</span>
                    <span className="feature-chev">›</span>
                  </Link>
                ))}
              </div>
            )
          ) : docs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13 }}>{t("docw.noResults")}</div>
          ) : (
            <div className="card" style={{ padding: 8 }}>
              {docs.map((d, i) => {
                const info = statusInfo(d.eff, t);
                return (
                  <Link key={d.id} href={`/staff/${d.user_id}`} style={rowLink(i < docs.length - 1)}>
                    <Icon e="📄" size={18} color="var(--gold)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>{typeLabel(d.doc_type)}</div>
                    </div>
                    <div style={{ textAlign: "right", marginRight: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: info.color }}>{info.label}</div>
                      {d.expiry_date && <div style={{ fontSize: 10, color: "var(--gray)" }}>{fmtDate(d.expiry_date)}</div>}
                    </div>
                    <span className="feature-chev">›</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}

function EmptyOk({ t }: { t: Tf }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 32 }}>
      <div style={{ marginBottom: 8 }}><Icon e="✅" size={30} color="#58d68d" /></div>
      <div style={{ color: "#58d68d", fontSize: 15, fontWeight: 700 }}>{t("exp.nothing")}</div>
      <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 6 }}>{t("exp.nothingSub")}</div>
    </div>
  );
}

const sel: React.CSSProperties = { flex: 1, minWidth: 140, padding: "9px 10px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 12.5 };
const rowLink = (border: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, padding: "12px 8px", borderBottom: border ? "1px solid rgba(128,128,128,0.12)" : "none", textDecoration: "none" });
"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getStaffDetail, getStaffHours, getStaffDocuments, getStaffDocumentUrl } from "@/lib/queries/staff-detail";
import { getStaffLeaveBalance, setLeaveAllowance } from "@/lib/queries/leave-balance";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";

const fmtH = (m: number) => `${Math.floor((m || 0) / 60)}h ${String((m || 0) % 60).padStart(2, "0")}m`;
const DOC_ICON: Record<string, string> = {
  id_card: "🪪", visa: "🛂", work_permit: "💼", contract: "📄", certificate: "🎓", other: "📁",
};
type Tf = (k: string, v?: Record<string, string | number>) => string;
function expiryStatus(expiry: string | null | undefined, t: Tf): { label: string; color: string } | null {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: t("staffd.expired", { n: Math.abs(days) }), color: "#ec7063" };
  if (days <= 60) return { label: t("staffd.expiresIn", { n: days }), color: "#e8a35a" };
  return { label: t("staffd.validUntil", { date: new Date(expiry).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) }), color: "#58d68d" };
}

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const { t } = useLang();
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const roleLabel = (k: string) => (["staff", "manager", "franchise_owner", "brand_owner"].includes(k) ? t("roles." + k) : k);
  const contractLabel = (k: string) => (["Working Student", "Part Time", "Full Time", "Mini Job"].includes(k) ? t("contracts." + k) : k);
  const statusLabel = (k: string) => (["active", "inactive"].includes(k) ? t("status." + k) : k);
  const docLabel = (k: string) => t("documents.type_" + (["id_card", "visa", "work_permit", "contract", "certificate"].includes(k) ? k : "other"));

  const [staff, setStaff] = useState<any>(null);
  const [hours, setHours] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [bal, setBal] = useState<any>(null);
  const [allowance, setAllowance] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [d, h, dc, lb] = await Promise.all([getStaffDetail(id), getStaffHours(id), getStaffDocuments(id), getStaffLeaveBalance(id)]);
      if (d.ok) setStaff(d.staff);
      else setError(d.error || t("staffd.couldNotLoad"));
      if (h.ok) setHours(h);
      if (dc.ok) setDocs(dc.documents || []);
      if (lb.ok) { setBal(lb); setAllowance(String(lb.allowance ?? "")); }
      setLoading(false);
    })();
  }, [id]);

  async function view(filePath: string) {
    const res = await getStaffDocumentUrl(filePath);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else toast(res.error || t("documents.couldNotOpen"), "error");
  }

  async function saveAllowance() {
    const days = parseFloat(allowance);
    if (isNaN(days) || days < 0) { toast(t("staffd.enterValidDays"), "error"); return; }
    const res = await setLeaveAllowance(id, days);
    if (res.ok) { toast(t("staffd.allowanceSaved"), "success"); const lb = await getStaffLeaveBalance(id); if (lb.ok) setBal(lb); }
    else toast(res.error || t("staffd.couldNotSave"), "error");
  }

  if (loading) return <div className="fade-up"><div style={{ height: 18 }} /><CardSkeleton rows={4} /></div>;
  if (error || !staff) return (
    <div className="fade-up">
      <Link href="/staff" style={backLink}>{t("staffd.back")}</Link>
      <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30 }}>{error || t("staffd.notFound")}</div>
    </div>
  );

  const initial = (staff.full_name || "?")[0].toUpperCase();
  const overPct = hours?.contractHours ? Math.round((hours.workedMins / 60 / (hours.contractHours * 4.33)) * 100) : null;

  return (
    <div className="fade-up">
      <Link href="/staff" style={backLink}>{t("staffd.back")}</Link>

      {/* header */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        {staff.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staff.avatar_url} alt="" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div className="avatar mgr" style={{ width: 60, height: 60, fontSize: 24 }}>{initial}</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--white)" }}>{staff.full_name || "—"}</div>
          <div style={{ fontSize: 12, color: "var(--gray)" }}>{staff.employee_code || "—"} · {staff.team ? teamLabel(staff.team) : t("directory.noTeam")}</div>
        </div>
        <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: staff.status === "active" ? "rgba(39,174,96,0.2)" : "rgba(128,128,128,0.2)", color: staff.status === "active" ? "#58d68d" : "var(--gray)", fontWeight: 600 }}>
          {staff.status ? statusLabel(staff.status) : "—"}
        </span>
      </div>

      {/* details */}
      <div className="section-label">{t("staffd.details")}</div>
      <div className="card" style={{ padding: 6 }}>
        <Row label={t("staffd.schnitzeryId")} value={staff.employee_code} />
        <Row label={t("staff.team")} value={staff.team ? teamLabel(staff.team) : null} />
        <Row label={t("staff.role")} value={staff.role ? roleLabel(staff.role) : null} />
        <Row label={t("profile.contract")} value={staff.contract_type ? contractLabel(staff.contract_type) : null} />
        <Row label={t("profile.contractHours")} value={staff.contract_hours != null ? t("staffd.hPerWeek", { h: staff.contract_hours }) : null} />
        <Row label={t("profile.email")} value={staff.email} />
        <Row label={t("staffd.mobile")} value={staff.phone} last />
      </div>

      {staff.skills && staff.skills.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 8 }}>{t("profile.skills")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {staff.skills.map((s: string) => (
              <span key={s} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 14, background: "var(--dark3)", border: "1px solid rgba(212,168,71,0.25)", color: "var(--gold-light)" }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* hours */}
      <div className="section-label">{t("staffd.hoursThisMonth")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 4 }}>
        <Stat value={fmtH(hours?.workedMins || 0)} label={t("staffd.worked")} color="var(--gold)" />
        <Stat value={hours?.shifts ?? 0} label={t("nav.shifts")} />
        <Stat value={overPct != null ? `${overPct}%` : "—"} label={t("staffd.ofContract")} color={overPct != null && overPct > 100 ? "#e8a35a" : "var(--white)"} />
      </div>

      {/* vacation */}
      {bal && (
        <>
          <div className="section-label">{t("staffd.vacation", { year: bal.year })}</div>
          <div className="card" style={{ marginBottom: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <Stat value={bal.allowance} label={t("staffd.allowance")} />
              <Stat value={bal.used} label={t("staffd.taken")} color="#e8a35a" />
              <Stat value={bal.remaining} label={t("staffd.remaining")} color="var(--gold)" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--gray)" }}>{t("staffd.annualDays")}</label>
              <input
                type="number" min="0" step="0.5" value={allowance} onChange={(e) => setAllowance(e.target.value)}
                style={{ width: 80, padding: "8px 10px", background: "var(--dark3)", color: "var(--white)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, fontSize: 14 }}
              />
              <button onClick={saveAllowance} style={{ padding: "8px 14px", background: "var(--gold)", color: "#1a1a1a", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t("common.save")}</button>
            </div>
          </div>
        </>
      )}

      {/* documents */}
      <div className="section-label">{t("staffd.documents")}</div>
      {docs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("staffd.noDocuments")}</div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {docs.map((d, i) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < docs.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
              <span style={{ fontSize: 20 }}>{DOC_ICON[d.doc_type] || "📁"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{docLabel(d.doc_type)}</div>
                <div style={{ fontSize: 11, color: "var(--gray)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.file_name}</div>
                {expiryStatus(d.expiry_date, t) && <div style={{ fontSize: 11, fontWeight: 600, color: expiryStatus(d.expiry_date, t)!.color, marginTop: 2 }}>{expiryStatus(d.expiry_date, t)!.label}</div>}
              </div>
              <button onClick={() => view(d.file_path)} style={viewBtn}>{t("documents.view")}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: any; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 8px", borderBottom: last ? "none" : "1px solid rgba(128,128,128,0.1)" }}>
      <span style={{ fontSize: 13, color: "var(--gray)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--white)", fontWeight: 500, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,var(--dark3),var(--dark2))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)", color: color || "var(--white)", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 5, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

const backLink: React.CSSProperties = { display: "inline-block", color: "var(--gold)", fontSize: 13, textDecoration: "none", marginBottom: 12 };
const viewBtn: React.CSSProperties = { padding: "6px 14px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 8, color: "var(--white)", fontSize: 12, fontWeight: 600, cursor: "pointer" };
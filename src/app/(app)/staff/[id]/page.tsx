"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getStaffDetail, getStaffHours, getStaffDocuments, getStaffDocumentUrl } from "@/lib/queries/staff-detail";
import { getStaffLeaveBalance, setLeaveAllowance } from "@/lib/queries/leave-balance";
import { toast } from "@/components/Toast";

const fmtH = (m: number) => `${Math.floor((m || 0) / 60)}h ${String((m || 0) % 60).padStart(2, "0")}m`;
const DOC_LABEL: Record<string, string> = {
  id_card: "ID Card / Passport", visa: "Visa / Residence Permit", work_permit: "Work Permit",
  contract: "Contract", certificate: "Certificate", other: "Other",
};
const DOC_ICON: Record<string, string> = {
  id_card: "🪪", visa: "🛂", work_permit: "💼", contract: "📄", certificate: "🎓", other: "📁",
};
function expiryStatus(expiry?: string | null): { label: string; color: string } | null {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, color: "#ec7063" };
  if (days <= 60) return { label: `Expires in ${days}d`, color: "#e8a35a" };
  return { label: `Valid until ${new Date(expiry).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}`, color: "#58d68d" };
}

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

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
      else setError(d.error || "Could not load.");
      if (h.ok) setHours(h);
      if (dc.ok) setDocs(dc.documents || []);
      if (lb.ok) { setBal(lb); setAllowance(String(lb.allowance ?? "")); }
      setLoading(false);
    })();
  }, [id]);

  async function view(filePath: string) {
    const res = await getStaffDocumentUrl(filePath);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else alert(res.error || "Could not open document.");
  }

  async function saveAllowance() {
    const days = parseFloat(allowance);
    if (isNaN(days) || days < 0) { toast("Enter a valid number of days.", "error"); return; }
    const res = await setLeaveAllowance(id, days);
    if (res.ok) { toast("Allowance saved.", "success"); const lb = await getStaffLeaveBalance(id); if (lb.ok) setBal(lb); }
    else toast(res.error || "Could not save.", "error");
  }

  if (loading) return <div style={{ color: "var(--gray)", textAlign: "center", padding: 40 }}><div className="spinner" style={{ margin: "0 auto 10px" }} />Loading…</div>;
  if (error || !staff) return (
    <div className="fade-up">
      <Link href="/staff" style={backLink}>‹ Back to Staff</Link>
      <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30 }}>{error || "Not found."}</div>
    </div>
  );

  const initial = (staff.full_name || "?")[0].toUpperCase();
  const overPct = hours?.contractHours ? Math.round((hours.workedMins / 60 / (hours.contractHours * 4.33)) * 100) : null;

  return (
    <div className="fade-up">
      <Link href="/staff" style={backLink}>‹ Back to Staff</Link>

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
          <div style={{ fontSize: 12, color: "var(--gray)" }}>{staff.employee_code || "—"} · {staff.team || "No team"}</div>
        </div>
        <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: staff.status === "active" ? "rgba(39,174,96,0.2)" : "rgba(128,128,128,0.2)", color: staff.status === "active" ? "#58d68d" : "var(--gray)", fontWeight: 600 }}>
          {staff.status || "—"}
        </span>
      </div>

      {/* details */}
      <div className="section-label">Details</div>
      <div className="card" style={{ padding: 6 }}>
        <Row label="Schnitzery ID" value={staff.employee_code} />
        <Row label="Team" value={staff.team} />
        <Row label="Role" value={staff.role} />
        <Row label="Contract" value={staff.contract_type} />
        <Row label="Contract hours" value={staff.contract_hours != null ? `${staff.contract_hours} h/week` : null} />
        <Row label="Email" value={staff.email} />
        <Row label="Mobile" value={staff.phone} last />
      </div>

      {staff.skills && staff.skills.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 8 }}>Skills</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {staff.skills.map((s: string) => (
              <span key={s} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 14, background: "var(--dark3)", border: "1px solid rgba(212,168,71,0.25)", color: "var(--gold-light)" }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* hours */}
      <div className="section-label">Hours · This Month</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 4 }}>
        <Stat value={fmtH(hours?.workedMins || 0)} label="Worked" color="var(--gold)" />
        <Stat value={hours?.shifts ?? 0} label="Shifts" />
        <Stat value={overPct != null ? `${overPct}%` : "—"} label="Of Contract" color={overPct != null && overPct > 100 ? "#e8a35a" : "var(--white)"} />
      </div>

      {/* vacation */}
      {bal && (
        <>
          <div className="section-label">Vacation · {bal.year}</div>
          <div className="card" style={{ marginBottom: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <Stat value={bal.allowance} label="Allowance" />
              <Stat value={bal.used} label="Taken" color="#e8a35a" />
              <Stat value={bal.remaining} label="Remaining" color="var(--gold)" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--gray)" }}>Annual days</label>
              <input
                type="number" min="0" step="0.5" value={allowance} onChange={(e) => setAllowance(e.target.value)}
                style={{ width: 80, padding: "8px 10px", background: "var(--dark3)", color: "var(--white)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, fontSize: 14 }}
              />
              <button onClick={saveAllowance} style={{ padding: "8px 14px", background: "var(--gold)", color: "#1a1a1a", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save</button>
            </div>
          </div>
        </>
      )}

      {/* documents */}
      <div className="section-label">Documents</div>
      {docs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>No documents uploaded.</div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {docs.map((d, i) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < docs.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
              <span style={{ fontSize: 20 }}>{DOC_ICON[d.doc_type] || "📁"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{DOC_LABEL[d.doc_type] || "Document"}</div>
                <div style={{ fontSize: 11, color: "var(--gray)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.file_name}</div>
                {expiryStatus(d.expiry_date) && <div style={{ fontSize: 11, fontWeight: 600, color: expiryStatus(d.expiry_date)!.color, marginTop: 2 }}>{expiryStatus(d.expiry_date)!.label}</div>}
              </div>
              <button onClick={() => view(d.file_path)} style={viewBtn}>View</button>
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
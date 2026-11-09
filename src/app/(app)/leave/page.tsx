"use client";

import { appLocale } from "@/lib/format";
import { useEffect, useState } from "react";
import { submitLeave, getMyLeave, getSickNoteUrl, attachSickNote } from "@/lib/queries/leave";
import { createClient } from "@/lib/supabase/client";

const LEAVE_TYPES = ["vacation", "sick", "unpaid", "special"];
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { Field } from "@/components/ui";

export default function LeavePage() {
  const { t, locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const typeLabel = (k: string) => ({ vacation: s("Vacation", "Urlaub"), sick: s("Sick leave", "Krank"), unpaid: s("Unpaid", "Unbezahlt"), special: s("Special leave", "Sonderurlaub") } as Record<string, string>)[k] ?? k;
  const [type, setType] = useState("vacation");
  const [file, setFile] = useState<File | null>(null);
  const stLabel = (st: string) => (["approved", "denied", "pending"].includes(st) ? t("shifts.status_" + st) : st);
  const [tab, setTab] = useState<"request" | "mine">("request");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadMine() {
    // A failed request must end the skeleton and say so, not spin forever.
    try {
    setLoading(true);
    const res = await getMyLeave();
    if (res.ok) setRequests(res.requests);
    setLoading(false);
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadMine(); }, []);

  async function submit() {
    if (file && file.size > 5 * 1024 * 1024) { toast(s("The file is larger than 5 MB.", "Die Datei ist größer als 5 MB."), "error"); return; }
    setWorking(true);
    try {
      // Sick note: upload to the private documents bucket, own folder (same rule as Documents); the request stores the path.
      const notePath = type === "sick" && file ? await uploadNote(file) : null;
      const res = await submitLeave(fromDate, toDate, reason, type, notePath);
      if (res.ok) {
        toast(t("leave.submitted"), "success");
        setFromDate(""); setToDate(""); setReason(""); setFile(null); setType("vacation");
        loadMine();
      } else toast(res.error || t("leave.failSubmit"), "error");
    } catch { toast(t("leave.failSubmit"), "error"); }
    finally { setWorking(false); }
  }
  // Upload into the employee's own private folder; returns the storage path.
  async function uploadNote(f: File) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");
    const ext = (f.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${user.id}/${Date.now()}_sick_note.${ext}`;
    const up = await supabase.storage.from("documents").upload(path, f, { contentType: f.type || undefined });
    if (up.error) throw up.error;
    return path;
  }
  async function attachLater(id: string, f: File | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast(s("The file is larger than 5 MB.", "Die Datei ist größer als 5 MB."), "error"); return; }
    setWorking(true);
    try {
      const r = await attachSickNote(id, await uploadNote(f));
      if (r.ok) { toast(s("Sick note attached.", "Krankmeldung angehängt."), "success"); loadMine(); }
      else toast(r.error || t("leave.failSubmit"), "error");
    } catch { toast(t("leave.failSubmit"), "error"); }
    finally { setWorking(false); }
  }
  async function openNote(id: string) {
    const r = await getSickNoteUrl(id);
    if (r.ok && r.url) window.open(r.url, "_blank", "noopener"); else toast(r.error || t("leave.failSubmit"), "error");
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin", day: "2-digit", month: "short", year: "numeric" }) : "—";
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
          <div className="leave-types" role="group" aria-label={s("Type", "Art")}>
            {LEAVE_TYPES.map((k) => <button key={k} type="button" aria-pressed={type === k} className={type === k ? "is-on" : ""} onClick={() => setType(k)}>{typeLabel(k)}</button>)}
          </div>
          <Field label={t("leave.fromDate")}>
            <input className="form-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label={t("leave.toDate")}>
            <input className="form-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label={t("leave.reason")}>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("leave.reasonPlaceholder")} rows={3} style={{ ...input, resize: "vertical" }} />
          </Field>
          {type === "sick" && <Field label={s("Sick note (PDF or photo, optional)", "Krankmeldung / AU (PDF oder Foto, optional)")}>
            <input className="form-input" type="file" accept="application/pdf,image/*"onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>}
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
                <div className="ui-strong">{typeLabel(r.leave_type ?? "vacation")} · {fmtDate(r.from_date)} → {fmtDate(r.to_date)}</div>
                <span style={statusStyle(r.status)}>{stLabel(r.status)}</span>
              </div>
              {r.reason && <div className="t-xs u-muted mt-2">{r.reason}</div>}
              {r.leave_type === "sick" && <div className="row-actions mt-2">
                {r.sick_note_url && <button type="button" className="ui-link-btn" onClick={() => void openNote(r.id)}>{s("View sick note", "Krankmeldung ansehen")}</button>}
                <label className="btn-secondary leave-attach">{r.sick_note_url ? s("Replace note", "Ersetzen") : s("Attach sick note", "Krankmeldung anhängen")}
                  <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={working} onChange={(e) => { void attachLater(r.id, e.target.files?.[0]); e.target.value = ""; }} /></label>
              </div>}
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
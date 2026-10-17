"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { getOfflineIssues, reviewOfflineIssue } from "@/lib/queries/offline-review";

export default function OfflineReview({manager=false}:{manager?:boolean}) {
  const {t,locale}=useLang();
  const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false);
  const [history,setHistory]=useState(false),[refresh,setRefresh]=useState(0),[notes,setNotes]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null),[saveFailed,setSaveFailed]=useState(false);
  useEffect(()=>{let active=true;setLoading(true);setFailed(false);
    getOfflineIssues(manager,history).then(res=>{if(!active)return;if(res.ok)setRows(res.rows||[]);else setFailed(true);})
      .catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[manager,history,refresh]);
  async function save(id:string){setBusy(id);setSaveFailed(false);
    try {const res=await reviewOfflineIssue(id,notes[id]||"");if(!res.ok)throw Error();setRefresh(n=>n+1);}
    catch {setSaveFailed(true);}finally{setBusy(null);}
  }
  return <section className="card" aria-label={t("offlineReview.title")} aria-busy={loading}>
    <h2 className="card-title">{t("offlineReview.title")}</h2>
    <p className="page-sub">{t(manager?"offlineReview.managerHelp":"offlineReview.employeeHelp")}</p>
    <div className="workspace-toolbar">
      <button className="btn-secondary" disabled={loading||!!busy} onClick={()=>setRefresh(n=>n+1)}>{t("offlineReview.refresh")}</button>
      {manager&&<button className="btn-secondary" disabled={!!busy} aria-pressed={history} onClick={()=>setHistory(v=>!v)}>{t(history?"offlineReview.pending":"offlineReview.history")}</button>}
      <Link href={manager?"/approvals":"/attendance/corrections"} className="btn-secondary">{t("offlineReview.corrections")}</Link>
    </div>
    {failed||saveFailed?<p role="alert">{t("offlineReview.failed")}</p>:null}
    {loading?<p role="status">{t("common.loading")}</p>:failed?null:rows.length===0?<p>{t("offlineReview.empty")}</p>:rows.map(row=><article key={row.id} style={{padding:"16px 0",borderBottom:"1px solid var(--border)"}}>
      <h3 style={{fontSize:14}}>{manager?row.full_name||t("offlineReview.employee"):t("offlineReview.record")} · {t(`offlineReview.${row.action}`)}</h3>
      <p><time dateTime={row.captured_at}>{new Date(row.captured_at).toLocaleString(locale==="de"?"de-DE":"en-GB",{timeZone:"Europe/Berlin"})}</time> · {t("offlineReview.timezone")}</p>
      <p>{t(`offlineReview.${["qr_not_verified","offline_location_not_verified","capture_time_needs_review","already_clocked_in","no_open_session","non_monotonic_time","invalid_break_sequence","legacy_capture_needs_review","overlapping_shift"].includes(row.error)?row.error:"generic"}`)}</p>
      {row.reviewed_at?<p>{t("offlineReview.reviewed")}: {row.note}</p>:manager?<form onSubmit={event=>{event.preventDefault();save(row.id);}}>
        <label>{t("offlineReview.note")}<textarea className="form-input" required maxLength={2000} value={notes[row.id]||""} onChange={event=>setNotes(n=>({...n,[row.id]:event.target.value}))} /></label>
        <button className="btn-secondary" disabled={!!busy||!notes[row.id]?.trim()}>{t(busy===row.id?"common.saving":"offlineReview.markReviewed")}</button>
      </form>:<p>{t("offlineReview.awaiting")}</p>}
    </article>)}
    {rows.length===100&&<p>{t("offlineReview.limit")}</p>}
  </section>;
}

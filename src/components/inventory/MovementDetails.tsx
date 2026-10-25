"use client";
import { useEffect, useRef, useState } from "react";
import NativeDialog from "@/components/NativeDialog";
import { Field, ErrorState } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { getInventoryEntry, inventoryOperation } from "@/lib/queries/inventory-operations";
type Data=Extract<Awaited<ReturnType<typeof getInventoryEntry>>,{ok:true}>;
export default function MovementDetails({kind,id,onClose,onSaved}:{kind:"waste"|"transfer";id:string;onClose:()=>void;onSaved:()=>void}){
 const {t,locale}=useLang();const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[qty,setQty]=useState(""),[reason,setReason]=useState("");const command=useRef<{key:string;id:string}|null>(null);
 async function load(){setLoading(true);setError("");try{const r=await getInventoryEntry(id,kind);if(r.ok){setData(r);setQty(kind==="waste"?String(r.row.qty??""):"");}else setError(t(`inventoryOps.error_${r.error}`));}catch{setError(t("inventoryOps.error_load"));}finally{setLoading(false);}}
 useEffect(()=>{load();},[id,kind]);
 const close=()=>{if(!busy&&(!reason&&!qty||window.confirm(t("inventoryOps.discard"))))onClose();};
 async function save(){if(!data||!window.confirm(t(kind==="waste"?"inventoryOps.confirmCorrection":"inventoryOps.confirmTransfer")))return;setBusy(true);setError("");try{
  const action=kind==="waste"?"waste_correct":"transfer_receive",body={id,revision:0,qty:qty.trim()===""?NaN:Number(qty),note:reason,...(kind==="waste"?{before:data.row}:{})},key=JSON.stringify(body);
  if(command.current?.key!==key)command.current={key,id:crypto.randomUUID()};
  const r=await inventoryOperation(data.branch,command.current.id,action,body);if(!r.ok){setError(t(`inventoryOps.error_${r.error}`));return;}onSaved();onClose();
 }catch{setError(t("inventoryOps.error_save"));}finally{setBusy(false);}}
 const row=data?.row,receive=kind==="transfer"&&row?.to_branch_id===data?.branch&&row?.status==="sent";
 return <NativeDialog unsaved={!!reason||(kind==="transfer"?qty!=="":qty!==String(row?.qty??""))} title={t("inventoryOps.movementDetails")} busy={busy} onClose={close}>
  <h2>{t("inventoryOps.movementDetails")}</h2>{error&&<ErrorState message={error} onRetry={load} retryLabel={t("business.retry")}/>}
  {loading?<p role="status">{t("common.loading")}</p>:row&&<>
   <h3>{String(row.product)} · {String(row.unit??"—")}</h3>
   <dl className="inventory-detail-grid"><div><dt>{t("inventoryOps.recordedQty")}</dt><dd>{String(row.qty)}</dd></div>
    {kind==="transfer"?<><div><dt>{t("xfer.fromBranch")}</dt><dd>{String(row.from_branch_name??"—")}</dd></div><div><dt>{t("inventoryOps.destination")}</dt><dd>{String(row.to_branch_name??"—")}</dd></div><div><dt>{t("inventoryOps.status")}</dt><dd>{t(`xfer.st_${row.status}`)}</dd></div><div><dt>{t("inventoryOps.received")}</dt><dd>{row.received_qty==null?t("inventoryOps.notRecorded"):String(row.received_qty)}</dd></div>{row.receipt_note!=null&&<div><dt>{t("inventoryOps.discrepancy")}</dt><dd>{String(row.receipt_note)}</dd></div>}</>:<div><dt>{t("inventoryOps.status")}</dt><dd>{t(row.voided?"inventoryOps.voided":"inventoryOps.recorded")}</dd></div>}
   </dl>
   <p>{String(row.note??"")}</p><details><summary>{t("inventoryOps.evidence")}</summary><p>{id}</p>{["created_at","sent_at","received_at","sent_by","received_by","logged_by_name"].map(k=>row[k]?<p key={k}>{t(`inventoryOps.${k}`)}: {String(row[k])}</p>:null)}</details>
   {(kind==="waste"&&!row.voided||receive)&&<form onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy} className="inventory-fieldset">
    <p className="page-sub">{t(kind==="waste"?"inventoryOps.correctionHelp":"inventoryOps.transferHelp")}</p>
    <Field label={t(kind==="waste"?"inventoryOps.correctQty":"inventoryOps.actualReceived")}><input required className="form-input" type="number" min="0" max={receive?Number(row.qty):undefined} step="any" value={qty} onChange={e=>setQty(e.target.value)}/></Field>
    <Field label={t("inventoryOps.reason")}><textarea required={kind==="waste"||Number(qty)!==Number(row.qty)} minLength={3} maxLength={1000} className="form-input" value={reason} onChange={e=>setReason(e.target.value)}/></Field>
    <button className="btn-gold">{t(kind==="waste"?"inventoryOps.saveCorrection":"inventoryOps.confirmReceiptButton")}</button>
   </fieldset></form>}
   {!!data?.events?.length&&<section><h3>{t("inventoryOps.corrections")}</h3>{data.events.map(e=><p key={e.id}>{new Date(e.recorded_at).toLocaleString(locale==="de"?"de-DE":"en-GB",{timeZone:"Europe/Berlin"})} · {String(e.request?.note??"")} · {String(e.before_data?.qty??"—")} → {String(e.result?.qty??e.result?.received_qty??"—")}</p>)}</section>}
  </>}
  <button className="btn-secondary" disabled={busy} onClick={close}>{t("common.close")}</button>
 </NativeDialog>;
}

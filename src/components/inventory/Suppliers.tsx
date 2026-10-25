"use client";
import { useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import NativeDialog from "@/components/NativeDialog";
import { Field, ErrorState } from "@/components/ui";
import { inventoryOperation } from "@/lib/queries/inventory-operations";
import type { Supplier } from "@/lib/inventory/operations";

export default function Suppliers({branch,suppliers,onSaved}:{branch:string;suppliers:Supplier[];onSaved:()=>void}) {
 const {t}=useLang();
 const [edit,setEdit]=useState<Partial<Supplier>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function save(){if(!edit)return;setBusy(true);setError("");try{
  const r=await inventoryOperation(branch,crypto.randomUUID(),"supplier_save",{...edit,name:edit.name??"",email:edit.email??"",lead_days:edit.lead_days??0,is_active:edit.is_active??true});
  if(!r.ok){setError(t(`inventoryOps.error_${r.error}`));return;}setEdit(null);onSaved();
 }catch{setError(t("inventoryOps.error_save"));}finally{setBusy(false);}}
 const close=()=>{if(!busy&&window.confirm(t("inventoryOps.discard")))setEdit(null);};
 return <>
  <div className="ui-toolbar"><h2>{t("inventoryOps.suppliers")}</h2><button className="btn-gold" onClick={()=>{setError("");setEdit({name:"",email:"",lead_days:0,is_active:true});}}>{t("inventoryOps.newSupplier")}</button></div>
  <div className="table-scroll" tabIndex={0} role="region" aria-label={t("inventoryOps.suppliers")}><table className="data-table"><thead><tr><th scope="col">{t("inventoryOps.supplier")}</th><th scope="col">{t("inventoryOps.email")}</th><th scope="col">{t("inventoryOps.leadDays")}</th><th scope="col">{t("inventoryOps.actions")}</th></tr></thead><tbody>
   {suppliers.map(s=><tr key={s.id}><td>{s.name}{!s.is_active&&<span className="muted"> · {t("inventoryOps.archived")}</span>}</td><td>{s.email||"—"}</td><td>{s.lead_days}</td><td><button className="btn-secondary" onClick={()=>{setError("");setEdit({...s});}}>{t("inventoryOps.edit")}</button></td></tr>)}
   {!suppliers.length&&<tr><td colSpan={4}>{t("inventoryOps.noSuppliers")}</td></tr>}
  </tbody></table></div>
  {edit&&<NativeDialog unsaved title={t("inventoryOps.supplier")} busy={busy} onClose={close}><form onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy} className="inventory-fieldset">
   <h2>{t("inventoryOps.supplier")}</h2>{error&&<ErrorState message={error}/>}
   <Field label={t("inventoryOps.name")}><input className="form-input" required maxLength={160} value={edit.name??""} onChange={e=>setEdit({...edit,name:e.target.value})}/></Field>
   <Field label={t("inventoryOps.email")}><input type="email" className="form-input" maxLength={254} value={edit.email??""} onChange={e=>setEdit({...edit,email:e.target.value})}/></Field>
   <Field label={t("inventoryOps.leadDays")}><input type="number" min="0" max="365" step="1" className="form-input" required value={edit.lead_days??0} onChange={e=>setEdit({...edit,lead_days:Number(e.target.value)})}/></Field>
   <label><input type="checkbox" checked={edit.is_active??true} onChange={e=>setEdit({...edit,is_active:e.target.checked})}/> {t("inventoryOps.active")}</label>
   <div className="row-actions"><button className="btn-gold" disabled={busy}>{t("common.save")}</button><button type="button" className="btn-secondary" disabled={busy} onClick={close}>{t("common.cancel")}</button></div>
  </fieldset></form></NativeDialog>}
 </>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import NativeDialog from "@/components/NativeDialog";
import { EmptyState, ErrorState, Field } from "@/components/ui";
import { getInventoryOperations, inventoryOperation } from "@/lib/queries/inventory-operations";
import type { Product } from "@/lib/inventory/operations";

type Data=Extract<Awaited<ReturnType<typeof getInventoryOperations>>,{ok:true}>;
type Form={id?:string;revision?:number;product:string;category:string;unit:string;soll:string;reorder_point:string;reorder_qty:string;supplier_id:string;is_active:boolean};
const blank:Form={product:"",category:"",unit:"",soll:"",reorder_point:"",reorder_qty:"",supplier_id:"",is_active:true};
export default function Products({onChanged}:{onChanged?:()=>void}){
 const {t}=useLang();const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[search,setSearch]=useState(""),[category,setCategory]=useState(""),[edit,setEdit]=useState<Form|null>(null),[busy,setBusy]=useState(false);const request=useRef(0);
 async function load(){const seq=++request.current;setLoading(true);setError("");try{const r=await getInventoryOperations("catalog");if(seq!==request.current)return;if(r.ok)setData(r);else setError(t(`inventoryOps.error_${r.error}`));}catch{if(seq===request.current)setError(t("inventoryOps.error_load"));}finally{if(seq===request.current)setLoading(false);}}
 useEffect(()=>{load();return()=>{request.current++;};},[]);
 function open(p?:Product){setError("");setEdit(p?{...p,unit:p.unit??"",soll:String(p.soll),reorder_point:p.reorder_point==null?"":String(p.reorder_point),reorder_qty:p.reorder_qty==null?"":String(p.reorder_qty),supplier_id:p.supplier_id??""}:{...blank});}
 const close=()=>{if(!busy&&window.confirm(t("inventoryOps.discard")))setEdit(null);};
 async function save(){if(!edit||!data)return;setBusy(true);setError("");try{
  const r=await inventoryOperation(data.branch.id,crypto.randomUUID(),"product_save",{...edit,soll:edit.soll.trim()===""?NaN:Number(edit.soll),reorder_point:edit.reorder_point===""?null:Number(edit.reorder_point),reorder_qty:edit.reorder_qty===""?null:Number(edit.reorder_qty),supplier_id:edit.supplier_id||null});
  if(!r.ok){setError(t(`inventoryOps.error_${r.error}`));return;}setEdit(null);await load();onChanged?.();
 }catch{setError(t("inventoryOps.error_save"));}finally{setBusy(false);}}
 const shown=data?.products.filter(p=>(!category||p.category===category)&&`${p.product} ${p.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))??[];
 return <section className="card" aria-label={t("inventoryOps.products")}>
  <div className="ui-toolbar"><h2>{t("inventoryOps.products")}</h2><button className="btn-gold" disabled={!data||loading} onClick={()=>open()}>{t("inventoryOps.newProduct")}</button></div>
  {!edit&&error?<ErrorState message={error} onRetry={load} retryLabel={t("business.retry")}/>:loading?<p role="status">{t("common.loading")}</p>:data&&<>
   <p className="page-sub">{data.branch.name} · {t("inventoryOps.catalogHelp")}</p>
   <div className="inventory-toolbar"><Field label={t("inventoryOps.search")}><input type="search" className="form-input" value={search} onChange={e=>setSearch(e.target.value)}/></Field><Field label={t("inv.category")}><select className="form-select" value={category} onChange={e=>setCategory(e.target.value)}><option value="">{t("inventoryWorkflow.allCategories")}</option>{[...new Set(data.products.map(p=>p.category))].map(c=><option key={c}>{c}</option>)}</select></Field></div>
   {shown.length===0?<EmptyState title={t("inventoryWorkflow.noMatches")}/>:<div className="table-scroll" tabIndex={0} role="region" aria-label={t("inventoryOps.products")}><table className="data-table"><thead><tr>{["product","target","reorderPoint","reorderQty","supplier","actions"].map(k=><th scope="col" key={k}>{t(`inventoryOps.${k}`)}</th>)}</tr></thead><tbody>{shown.map(p=><tr key={p.id}>
    <td><strong>{p.product}</strong><div className="muted">{p.category} · {p.unit||"—"}</div></td><td>{p.soll}</td><td>{p.reorder_point??"—"}</td><td>{p.reorder_qty??"—"}</td><td>{data.suppliers.find(s=>s.id===p.supplier_id)?.name||"—"}</td><td><button className="btn-secondary" onClick={()=>open(p)}>{t("inventoryOps.edit")}</button></td>
   </tr>)}</tbody></table></div>}
  </>}
  {edit&&<NativeDialog unsaved title={t("inventoryOps.editProduct")} busy={busy} onClose={close}><form onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy} className="inventory-fieldset"><h2>{t("inventoryOps.editProduct")}</h2><p className="page-sub">{t("inventoryOps.identityHelp")}</p>{error&&<ErrorState message={error}/>}
   <div className="ui-form-grid">{(["product","category","unit","soll","reorder_point","reorder_qty"] as const).map(key=><Field key={key} label={t(`inventoryOps.field_${key}`)}><input className="form-input" required={["product","category","soll"].includes(key)} type={["soll","reorder_point","reorder_qty"].includes(key)?"number":"text"} min={key==="reorder_qty"?"0.000001":"0"} step="any" value={edit[key]} onChange={e=>setEdit({...edit,[key]:e.target.value})}/></Field>)}</div>
   <Field label={t("inventoryOps.supplier")}><select className="form-select" value={edit.supplier_id} onChange={e=>setEdit({...edit,supplier_id:e.target.value})}><option value="">—</option>{data?.suppliers.map(s=><option key={s.id} value={s.id} disabled={!s.is_active}>{s.name}{!s.is_active?` · ${t("inventoryOps.archived")}`:""}</option>)}</select></Field>
   <label><input type="checkbox" checked={edit.is_active} onChange={e=>setEdit({...edit,is_active:e.target.checked})}/> {t("inventoryOps.active")}</label>
   <div className="row-actions"><button className="btn-gold" disabled={busy}>{t("common.save")}</button><button type="button" className="btn-secondary" disabled={busy} onClick={close}>{t("common.cancel")}</button></div>
  </fieldset></form></NativeDialog>}
 </section>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import InventoryNav from "@/components/InventoryNav";
import NativeDialog from "@/components/NativeDialog";
import Suppliers from "@/components/inventory/Suppliers";
import { EmptyState, ErrorState, Field, PageHeader, Panel, TabButton } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { getInventoryOperations, inventoryOperation } from "@/lib/queries/inventory-operations";
import { getPurchaseOrderDraft } from "@/lib/queries/inventory";
import { inventoryKey } from "@/lib/inventory/identity";
import { orderSummary } from "@/lib/inventory/orderDraft";
import type { InventoryAction } from "@/lib/inventory/operations";
import { fmtDay } from "@/lib/time/berlinDate";
import { formatEur } from "@/lib/format";

type Data=Extract<Awaited<ReturnType<typeof getInventoryOperations>>,{ok:true}>;
type OrderForm={id?:string;revision?:number;supplier_id:string;expected_date:string;note:string;lines:{product_id:string;qty:string;unit_price:string}[]};
type ReceiptForm=Record<string,{accepted:string;rejected:string;cost:string;note:string}>;
export default function PurchasingPage(){
 const {t,locale}=useLang();const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[tab,setTab]=useState("orders"),[search,setSearch]=useState("");
 const [edit,setEdit]=useState<OrderForm|null>(null),[receiving,setReceiving]=useState<ReceiptForm|null>(null),[invoice,setInvoice]=useState(""),[note,setNote]=useState(""),[reviewed,setReviewed]=useState(false);
 const request=useRef(0),mounted=useRef(true),command=useRef<{key:string;id:string}|null>(null);
 const money=(v:number)=>formatEur(v,locale,2);
 const errorText=(key:string)=>t(`inventoryOps.error_${key}`);
 async function load(id?:string){const seq=++request.current;setLoading(true);setError("");try{const r=await getInventoryOperations("purchasing",id);if(seq!==request.current||!mounted.current)return;if(!r.ok){setError(errorText(r.error));return;}setData(r);setNote("");setReviewed(false);const url=new URL(window.location.href);url.searchParams.delete("new");if(id)url.searchParams.set("order",id);else url.searchParams.delete("order");window.history.replaceState(null,"",url);}catch{if(seq===request.current)setError(errorText("load"));}finally{if(seq===request.current)setLoading(false);}}
 useEffect(()=>{mounted.current=true;const q=new URLSearchParams(window.location.search);load(q.get("order")||undefined);if(q.get("new"))setEdit({supplier_id:"",expected_date:"",note:"",lines:[{product_id:"",qty:"",unit_price:""}]});return()=>{mounted.current=false;request.current++;};},[]);
 const close=()=>{if(!busy&&window.confirm(t("inventoryOps.discard"))){setEdit(null);setReceiving(null);setError("");}};
 async function run(action:InventoryAction,body:Record<string,unknown>){if(!data||busy)return;setBusy(true);setError("");try{
  const key=JSON.stringify({action,body});if(command.current?.key!==key)command.current={key,id:crypto.randomUUID()};
  const r=await inventoryOperation(data.branch.id,command.current.id,action,body);if(!mounted.current)return;
  if(!r.ok){setError(errorText(r.error));return;}command.current=null;setEdit(null);setReceiving(null);setTab("orders");await load(r.result.id);
 }catch{if(mounted.current)setError(errorText("save"));}finally{if(mounted.current)setBusy(false);}}
 function start(){setError("");setEdit({supplier_id:data?.suppliers.find(s=>s.is_active)?.id||"",expected_date:"",note:"",lines:[{product_id:"",qty:"",unit_price:""}]});}
 async function suggestions(){if(!edit||!data)return;if(edit.lines.some(l=>l.product_id)&&!window.confirm(t("inventoryOps.discard")))return;setBusy(true);setError("");try{const r=await getPurchaseOrderDraft();if(!r.ok){setError(errorText("load"));return;}
  const lines=r.groups.flatMap(g=>g.items).flatMap(item=>{const product=data.products.find(p=>inventoryKey(p)===inventoryKey(item));return product&&(!edit.supplier_id||!product.supplier_id||product.supplier_id===edit.supplier_id)&&Number(item.qty)>0?[{product_id:product.id,qty:String(item.qty),unit_price:item.unitPrice==null?"":String(item.unitPrice)}]:[];});
  if(!lines.length){setError(t("orderDraft.emptyHelp"));return;}setEdit({...edit,lines});
 }catch{setError(errorText("load"));}finally{setBusy(false);}}
 function editSaved(){if(!data?.order)return;setError("");setEdit({id:data.order.id,revision:data.order.revision,supplier_id:data.order.supplier_id,expected_date:data.order.expected_date||"",note:data.order.note,lines:data.lines.map(l=>({product_id:l.product_id,qty:String(l.qty),unit_price:l.unit_price==null?"":String(l.unit_price)}))});}
 function saveOrder(){if(!edit)return;run("po_save",{...edit,expected_date:edit.expected_date||null,lines:edit.lines.map(l=>({product_id:l.product_id,qty:l.qty.trim()===""?NaN:Number(l.qty),unit_price:l.unit_price===""?null:Number(l.unit_price)}))});}
 function transition(action:InventoryAction){if(!data?.order||!window.confirm(t("inventoryOps.confirmAction")))return;run(action,{id:data.order.id,revision:data.order.revision,note});}
 function beginReceipt(){if(!data)return;setError("");setInvoice("");setReviewed(false);setReceiving(Object.fromEntries(data.lines.map(l=>[l.id,{accepted:"",rejected:"",cost:"",note:""}])));}
 function receive(){if(!data?.order||!receiving||!reviewed)return;const lines=Object.entries(receiving).filter(([,v])=>Number(v.accepted)>0||Number(v.rejected)>0).map(([id,v])=>({id,accepted:Number(v.accepted)||0,rejected:Number(v.rejected)||0,cost:Number(v.accepted)>0?(v.cost.trim()===""?NaN:Number(v.cost)):0,note:v.note}));if(!window.confirm(t("inventoryOps.confirmReceipt")))return;run("receive",{id:data.order.id,revision:data.order.revision,invoice,note,lines});}
 const total=orderSummary((data?.lines??[]).map(l=>({qty:l.qty,unitPrice:l.unit_price})));
 const formTotal=orderSummary((edit?.lines??[]).map(l=>({qty:l.qty,unitPrice:l.unit_price===""?null:Number(l.unit_price)})));
 const list=data?.orders.filter(o=>`${o.reference} ${o.supplier_name} ${o.status}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))??[];
 return <div className="inventory-page">
  <InventoryNav active="purchasing" canLeave={()=>!(edit||receiving)||window.confirm(t("inventoryOps.discard"))}/>
  <PageHeader title={t("inventoryOps.purchasing")} subtitle={data?.branch.name??t("common.loading")} actions={<button className="btn-gold" disabled={!data||busy||loading} onClick={start}>{t("inventoryOps.newOrder")}</button>}/>
  <div className="hub-tabs" role="group" aria-label={t("inventoryOps.purchasing")}><TabButton active={tab==="orders"} onClick={()=>setTab("orders")}>{t("inventoryOps.orders")}</TabButton><TabButton active={tab==="suppliers"} onClick={()=>setTab("suppliers")}>{t("inventoryOps.suppliers")}</TabButton><Link className="hub-tab" href="/inventory?view=forecast">{t("inventoryWorkflow.reorder")}</Link></div>
  {error&&!edit&&!receiving&&<ErrorState message={error} onRetry={()=>load(data?.order?.id)} retryLabel={t("business.retry")}/>}
  {loading?<p role="status">{t("common.loading")}</p>:data&&<>
   {tab==="suppliers"?<Panel><Suppliers branch={data.branch.id} suppliers={data.suppliers} onSaved={()=>load(data.order?.id)}/></Panel>:data.order?<>
    <button className="btn-secondary" onClick={()=>load()}>{t("inventoryOps.backOrders")}</button>
    <Panel title={`${data.order.reference} · ${t(`inventoryOps.state_${data.order.status}`)}`}>
     <p><strong>{data.order.supplier_name}</strong> · {data.order.supplier_email||"—"}</p>
     {data.order.expected_date&&<p>{t("inventoryOps.expected")}: {fmtDay(data.order.expected_date,locale)}</p>}
     <p>{data.order.note}</p><p className="ui-figure-lg">{total.complete?"":"≥ "}{money(total.value??0)}</p><p className="page-sub">{t("inventoryOps.priceHelp")}</p>{!total.complete&&<p className="tone-warn">{t("orderDraft.missingPrices",{n:total.missingPrices})}</p>}
     <div className="table-scroll" tabIndex={0} role="region" aria-label={t("inventoryOps.orderLines")}><table className="data-table"><thead><tr>{["product","ordered","unitPrice","received","remaining"].map(k=><th scope="col" key={k}>{t(`inventoryOps.${k}`)}</th>)}</tr></thead><tbody>{data.lines.map(l=><tr key={l.id}><td>{l.product}<div className="muted">{l.category} · {l.unit||"—"}</div></td><td>{l.qty}</td><td>{l.unit_price==null?"—":formatEur(l.unit_price,locale,4)}</td><td>{l.received_qty}</td><td>{Math.max(0,l.qty-l.received_qty)}</td></tr>)}</tbody></table></div>
     <p className="page-sub">{t("inventoryOps.sendHelp")}</p>
     {!["closed","cancelled"].includes(data.order.status)&&<Field label={t("inventoryOps.actionNote")}><input className="form-input" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></Field>}
     <div className="row-actions">
      {data.order.status==="draft"&&<><button className="btn-secondary" disabled={busy} onClick={editSaved}>{t("inventoryOps.edit")}</button><button className="btn-gold" disabled={busy} onClick={()=>transition("po_approve")}>{t("inventoryOps.approve")}</button></>}
      {data.order.status==="approved"&&<button className="btn-gold" disabled={busy||note.trim().length<3} onClick={()=>transition("po_send")}>{t("inventoryOps.markSent")}</button>}
      {["sent","partial"].includes(data.order.status)&&<button className="btn-gold" disabled={busy} onClick={beginReceipt}>{t("inventoryOps.receive")}</button>}
      {data.order.status==="partial"&&<button className="btn-secondary" disabled={busy||note.trim().length<3} onClick={()=>transition("po_close")}>{t("inventoryOps.closeRemainder")}</button>}
      {["draft","approved","sent"].includes(data.order.status)&&<button className="btn-quiet-danger" disabled={busy||note.trim().length<3} onClick={()=>transition("po_cancel")}>{t("inventoryOps.cancelOrder")}</button>}
     </div>
    </Panel>
    <Panel title={t("inventoryOps.timeline")}><ol>{(data.orderEvents??[]).map(e=><li key={e.id}><strong>{t(`inventoryOps.event_${e.action}`)}</strong> · {new Date(e.recorded_at).toLocaleString(locale==="de"?"de-DE":"en-GB",{timeZone:"Europe/Berlin"})}<p>{String(e.request.note??"")}</p><details><summary>{t("inventoryOps.evidence")}</summary>{e.actor_id} · {e.id}</details></li>)}</ol></Panel>
    <Panel title={t("inventoryOps.receipts")}>{!data.receipts.length?<p>{t("inventoryOps.noReceipts")}</p>:data.receipts.map(r=><details key={r.id} className="inventory-receipt"><summary>{r.invoice} · {new Date(r.received_at).toLocaleString(locale==="de"?"de-DE":"en-GB",{timeZone:"Europe/Berlin"})}</summary><p>{r.note}</p>{data.receiptLines.filter(l=>l.receipt_id===r.id).map(l=><p key={l.id}><strong>{data.lines.find(p=>p.id===l.order_line_id)?.product}</strong> · {t("inventoryOps.accepted")}: {l.accepted} · {t("inventoryOps.rejected")}: {l.rejected} · {money(l.cost)} · {l.note}</p>)}</details>)}</Panel>
   </>:<Panel title={t("inventoryOps.orders")}><p className="page-sub">{t("inventoryOps.latestOrders")}</p><Field label={t("inventoryOps.search")}><input className="form-input" type="search" value={search} onChange={e=>setSearch(e.target.value)}/></Field>
    {!list.length?<EmptyState title={t("inventoryOps.noOrders")}/>:<div className="table-scroll" tabIndex={0} role="region" aria-label={t("inventoryOps.orders")}><table role="table" className="data-table inventory-order-list"><thead><tr>{["reference","supplier","status","expected","actions"].map(k=><th scope="col" key={k}>{t(`inventoryOps.${k}`)}</th>)}</tr></thead><tbody>{list.map(o=><tr key={o.id}><td>{o.reference}</td><td>{o.supplier_name}</td><td><span className="status-badge">{t(`inventoryOps.state_${o.status}`)}</span></td><td data-label={t("inventoryOps.expected")}>{o.expected_date?fmtDay(o.expected_date,locale):"—"}</td><td><button className="btn-secondary" onClick={()=>load(o.id)}>{t("inventoryOps.open")}</button></td></tr>)}</tbody></table></div>}
   </Panel>}
  </>}
  {edit&&<NativeDialog wide unsaved title={t("inventoryOps.orderDraft")} busy={busy} onClose={close}><form onSubmit={e=>{e.preventDefault();saveOrder();}}><fieldset disabled={busy} className="inventory-fieldset"><h2>{t("inventoryOps.orderDraft")}</h2>{error&&<ErrorState message={error}/>}
   <div className="ui-form-grid"><Field label={t("inventoryOps.supplier")}><select required className="form-select" value={edit.supplier_id} onChange={e=>setEdit({...edit,supplier_id:e.target.value})}><option value="">{t("inventoryOps.chooseSupplier")}</option>{data?.suppliers.filter(s=>s.is_active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label={t("inventoryOps.expected")}><input type="date" className="form-input" value={edit.expected_date} onChange={e=>setEdit({...edit,expected_date:e.target.value})}/></Field></div>
   <p className="page-sub">{t("inventoryOps.supplierHelp")}</p><button type="button" className="btn-secondary" onClick={suggestions}>{t("inventoryOps.useSuggestions")}</button>
   <div className="table-scroll" tabIndex={0} role="region" aria-label={t("inventoryOps.orderLines")}><table className="data-table"><thead><tr>{["product","ordered","unitPrice","actions"].map(k=><th scope="col" key={k}>{t(`inventoryOps.${k}`)}</th>)}</tr></thead><tbody>{edit.lines.map((l,i)=><tr key={i}>
    <td><select required className="form-select" aria-label={`${t("inventoryOps.product")} ${i+1}`} value={l.product_id} onChange={e=>setEdit({...edit,lines:edit.lines.map((v,j)=>j===i?{...v,product_id:e.target.value}:v)})}><option value="">—</option>{data?.products.map(p=><option key={p.id} value={p.id}>{p.product} · {p.unit||"—"}</option>)}</select></td>
    {(["qty","unit_price"] as const).map(key=><td key={key}><input required={key==="qty"} type="number" min={key==="qty"?"0.000001":"0"} step="any" className="form-input quantity-input" aria-label={`${t(key==="qty"?"inventoryOps.ordered":"inventoryOps.unitPrice")} ${i+1}`} value={l[key]} onChange={e=>setEdit({...edit,lines:edit.lines.map((v,j)=>j===i?{...v,[key]:e.target.value}:v)})}/></td>)}
    <td><button type="button" className="btn-secondary" onClick={()=>setEdit({...edit,lines:edit.lines.filter((_,j)=>i!==j)})}>{t("common.delete")}</button></td>
   </tr>)}</tbody></table></div>
   <button type="button" className="btn-secondary" onClick={()=>setEdit({...edit,lines:[...edit.lines,{product_id:"",qty:"",unit_price:""}]})}>{t("inventoryOps.addLine")}</button>
   <p>{formTotal.complete?"":"≥ "}{money(formTotal.value??0)} · {t("inventoryOps.priceHelp")}</p>
   <Field label={t("inventoryOps.note")}><textarea className="form-input" maxLength={1000} value={edit.note} onChange={e=>setEdit({...edit,note:e.target.value})}/></Field>
   <div className="row-actions"><button className="btn-gold" disabled={!edit.lines.length}>{t("common.save")}</button><button type="button" className="btn-secondary" onClick={close}>{t("common.cancel")}</button></div>
  </fieldset></form></NativeDialog>}
  {receiving&&data&&<NativeDialog wide unsaved title={t("inventoryOps.receive")} busy={busy} onClose={close}><form onSubmit={e=>{e.preventDefault();receive();}}><fieldset disabled={busy} className="inventory-fieldset"><h2>{t("inventoryOps.receive")} · {data.order?.reference}</h2><p>{t("inventoryOps.receiptHelp")}</p>{error&&<ErrorState message={error}/>}
   <Field label={t("inventoryOps.invoice")}><input required className="form-input" maxLength={160} value={invoice} onChange={e=>setInvoice(e.target.value)}/></Field>
   <div className="table-scroll" tabIndex={0} role="region" aria-label={t("inventoryOps.receive")}><table className="data-table"><thead><tr>{["product","remaining","accepted","rejected","acceptedCost","discrepancy"].map(k=><th scope="col" key={k}>{t(`inventoryOps.${k}`)}</th>)}</tr></thead><tbody>{data.lines.map(l=><tr key={l.id}><td>{l.product} · {l.unit}</td><td>{Math.max(0,l.qty-l.received_qty)}</td>{(["accepted","rejected","cost","note"] as const).map(key=><td key={key}><input type={key==="note"?"text":"number"} min="0" step="any" className={key==="note"?"form-input":"form-input quantity-input"} aria-label={`${t(`inventoryOps.${key==="cost"?"acceptedCost":key}`)}: ${l.product}`} value={receiving[l.id][key]} onChange={e=>{setReceiving({...receiving,[l.id]:{...receiving[l.id],[key]:e.target.value}});setReviewed(false);}}/></td>)}</tr>)}</tbody></table></div>
   <label><input type="checkbox" required checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> {t("inventoryOps.reviewReceipt")}</label>
   <div className="row-actions"><button className="btn-gold" disabled={!reviewed}>{t("inventoryOps.postReceipt")}</button><button type="button" className="btn-secondary" onClick={close}>{t("common.cancel")}</button></div>
  </fieldset></form></NativeDialog>}
 </div>;
}


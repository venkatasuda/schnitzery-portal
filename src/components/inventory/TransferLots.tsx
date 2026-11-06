"use client";
import {useEffect,useRef,useState} from "react";
import NativeDialog from "@/components/NativeDialog";
import {Field,ErrorState} from "@/components/ui";
import {useLang} from "@/components/LanguageProvider";
import {fmtDay} from "@/lib/time/berlinDate";
import {getLotTransfer,postLotTransfer} from "@/lib/queries/inventory-lot-transfers";
type Data=Extract<Awaited<ReturnType<typeof getLotTransfer>>,{ok:true}>;
export default function TransferLots({id,onClose,onSaved}:{id:string;onClose:()=>void;onSaved:()=>void}){
 const {locale}=useLang(),s=(en:string,de:string)=>locale==="de"?de:en;
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false),[qty,setQty]=useState<Record<string,string>>({}),[note,setNote]=useState(""),[reviewed,setReviewed]=useState(false);
 const command=useRef<{key:string;id:string}|null>(null);
 async function load(){setError(false);setReviewed(false);try{const r=await getLotTransfer(id);if(!r.ok){setError(true);return;}setData(r);}catch{setError(true);}}
 useEffect(()=>{void load();},[id]);
 const sending=data?.transfer.status==="requested"&&data.transfer.from_branch_id===data.branch;
 const receiving=data?.transfer.status==="sent"&&data.transfer.to_branch_id===data.branch&&data.lots.length>0;
 const rows=sending?data!.batches.map(b=>({...b,max:b.remaining_qty})):data?.lots.map(l=>({...l,max:l.sent_qty}))??[];
 async function save(){if(!data||!reviewed||(!sending&&!receiving))return;
  const lines=rows.filter(r=>!sending||qty[r.id]?.trim()).map(r=>({id:r.id,qty:qty[r.id]?.trim()?Number(qty[r.id]):NaN})),key=JSON.stringify({lines,note});
  if(!command.current||command.current.key!==key)command.current={key,id:crypto.randomUUID()};
  setBusy(true);setError(false);try{const r=await postLotTransfer(id,command.current.id,sending?"send":"receive",lines,note);if(!r.ok){setError(true);return;}onSaved();onClose();}catch{setError(true);}finally{setBusy(false);}}
 const dirty=!!note||Object.values(qty).some(Boolean),close=()=>{if(!busy&&(!dirty||window.confirm(s("Discard unsaved lot selections?","Ungespeicherte Chargenauswahl verwerfen?"))))onClose();};
 return <NativeDialog title={s("Transfer batches","Transferchargen")} busy={busy} unsaved={dirty} onClose={close}>
  <h2>{s("Transfer batches","Transferchargen")}</h2>
  {error&&<ErrorState message={s("Transfer could not be saved or loaded. Refresh balances and retry; no partial transfer is posted.","Transfer konnte nicht gespeichert oder geladen werden. Bestände aktualisieren und erneut versuchen; keine Teilbuchung erfolgt.")} onRetry={load} retryLabel={s("Refresh","Aktualisieren")}/>}
  {!data?(error?null:<p role="status">{s("Loading…","Lädt…")}</p>):<><h3>{data.transfer.product} · {data.transfer.qty} {data.transfer.unit}</h3>
   <p>{s("Dispatch removes the selected source lots. Receipt creates destination lots with the same expiry and lot reference. Record shortages per lot; no purchase or sales revenue is created.","Versand reduziert die ausgewählten Quellchargen. Empfang erstellt Zielchargen mit gleichem Ablaufdatum und Chargenbezug. Fehlmengen je Charge erfassen; kein Einkauf oder Umsatz wird erzeugt.")}</p>
   {data.transfer.status==="sent"&&!data.lots.length&&<p role="status">{s("Legacy transfer: lot details were not captured. Use the original receipt details; do not invent expiry dates.","Alter Transfer: Chargendetails wurden nicht erfasst. Ursprüngliche Empfangsdetails verwenden; keine Ablaufdaten erfinden.")}</p>}
   <form onSubmit={e=>{e.preventDefault();void save();}}><fieldset className="inventory-fieldset" disabled={busy}>
    {rows.map((r,i)=><div className="card" key={r.id}><p>{r.lot_number||r.id.slice(0,8)} · {r.expiry_date?fmtDay(r.expiry_date,locale):s("Unknown expiry","Ablauf unbekannt")} · {s("Maximum","Maximum")}: {r.max} {data.transfer.unit}</p>
     {(sending||receiving)?<Field label={`${s("Quantity","Menge")} ${i+1}`}><input className="form-input" type="number" step="any" min={sending?0.000001:0} max={r.max} required={!!receiving} value={qty[r.id]??""} onChange={e=>{setQty({...qty,[r.id]:e.target.value});setReviewed(false);}}/></Field>:<p>{s("Received","Empfangen")}: {"received_qty" in r?String(r.received_qty??"—"):"—"}</p>}
    </div>)}
    {(sending||receiving)&&<><Field label={s("Dispatch reference / receipt discrepancy","Versandbeleg / Empfangsabweichung")}><textarea className="form-input" required minLength={3} maxLength={1000} value={note} onChange={e=>{setNote(e.target.value);setReviewed(false);}}/></Field>
     <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>{s("I checked every lot, quantity and label.","Ich habe jede Charge, Menge und Kennzeichnung geprüft.")}</label>
     <button className="btn-gold" disabled={!reviewed||!rows.length}>{sending?s("Dispatch selected batches","Ausgewählte Chargen versenden"):s("Receive checked batches","Geprüfte Chargen empfangen")}</button></>}
   </fieldset></form></>}
  <button className="btn-secondary" disabled={busy} onClick={close}>{s("Close","Schließen")}</button>
 </NativeDialog>;
}

"use client";
import { useRef,useState } from "react";
import NativeDialog from "@/components/NativeDialog";
import { Field } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { berlinToday } from "@/lib/time/berlinDate";
import { inventoryOperation } from "@/lib/queries/inventory-operations";
import { validOperation,type Product,type Supplier } from "@/lib/inventory/operations";
import ReceiptBatches,{blankReceiptLot,type ReceiptLotInput} from "./ReceiptBatches";
import DeliveryNoteReader from "./DeliveryNoteReader";
import { checkNote,matchProduct,stockQty,type ParsedNote } from "@/lib/inventory/delivery-note";
type Line={product_id:string;accepted:string;rejected:string;cost:string;note:string;batches:ReceiptLotInput[]};
const blank=():Line=>({product_id:"",accepted:"",rejected:"0",cost:"",note:"",batches:[]});
// Long form: bring a new error into view and announce it (stable ref → runs once per message via key).
const reveal=(el:HTMLElement|null)=>{el?.scrollIntoView({block:"center"});el?.focus();};
// costHidden: shift leaders record quantities only — every line cost is sent as unknown (null) and the field is hidden.
// submit: alternative server action (the shift-leader one); defaults to the manager inventoryOperation.
type Submit=(branch:string,command:string,body:unknown)=>Promise<{ok:boolean;error?:string}>;
export default function DirectReceiving({branch,products,suppliers,onSaved,onClose,costHidden=false,submit}:{branch:string;products:Product[];suppliers:Pick<Supplier,"id"|"name"|"is_active">[];onSaved:()=>Promise<void>;onClose:()=>void;costHidden?:boolean;submit?:Submit}){
 const {locale}=useLang(),s=(en:string,de:string)=>locale==="de"?de:en;
 const [supplier,setSupplier]=useState(""),[invoice,setInvoice]=useState(""),[date,setDate]=useState(berlinToday),[note,setNote]=useState(""),[lines,setLines]=useState<Line[]>([blank()]),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const command=useRef<{body:string;id:string}|null>(null);
 function change(index:number,update:Partial<Line>){setReviewed(false);setError("");setLines(prev=>prev.map((v,i)=>i===index?{...v,...update}:v));}
 // A delivery note read from a photo/PDF pre-fills the form. Lines without a sure product match or a derivable
 // quantity stay open for the person to complete; nothing is saved until they review and post.
 const [scan,setScan]=useState<{lines:number;matched:number;totalOk:boolean|null;open:string[]}|null>(null);
 function applyNote(n:ParsedNote){
  const known=suppliers.find(p=>p.is_active&&n.supplier&&(p.name.toLowerCase().includes(n.supplier.toLowerCase().split(/\s+/)[0])||n.supplier.toLowerCase().includes(p.name.toLowerCase())));
  setSupplier(known?.name??n.supplier??"");setInvoice(n.reference??"");if(n.date&&n.date<=berlinToday())setDate(n.date);
  const open:string[]=[];let matched=0;
  const next=n.lines.map((l):Line=>{
   const id=matchProduct(l.description,products.map(p=>({id:p.id,product:p.product,category:p.category,unit:p.unit}))),p=products.find(x=>x.id===id);
   const q=p?stockQty(l,p.unit):null,accepted=q!=null?String(q):"";
   if(p&&q!=null)matched++;else open.push(l.description);
   return {product_id:p?.id??"",accepted,rejected:"0",cost:costHidden||l.lineTotal==null?"":String(l.lineTotal),note:[l.article,l.description].filter(Boolean).join(" "),
    batches:accepted?[{...blankReceiptLot(accepted),lot:l.lot??"",expiry:l.expiry??""}]:[]};
  });
  setLines(next.length?next:[blank()]);setReviewed(false);setError("");
  setScan({lines:n.lines.length,matched,totalOk:checkNote(n).totalOk,open});
 }
 const close=()=>{if(!busy&&window.confirm(s("Discard this unsaved delivery?","Ungespeicherte Lieferung verwerfen?")))onClose();};
 async function save(){if(busy||!reviewed)return;setError("");
  const body={supplier,invoice,received_date:date,note,lines:lines.map(l=>({product_id:l.product_id,accepted:Number(l.accepted),rejected:Number(l.rejected),cost:costHidden?null:Number(l.accepted)===0?0:l.cost.trim()===""?null:Number(l.cost),note:l.note,batches:Number(l.accepted)>0?l.batches.map(b=>({qty:Number(b.qty),lot:b.lot,expiry:b.expiry||null,expiry_note:b.expiry_note})):[]}))};
  const off=lines.map(l=>({l,sum:l.batches.reduce((n,b)=>n+(Number(b.qty)||0),0)})).find(({l,sum})=>Number(l.accepted)>0&&Math.abs(sum-Number(l.accepted))>1e-9);
  if(off){const p=products.find(p=>p.id===off.l.product_id);setError(s(`${p?.product??"Product"}: batches add up to ${off.sum} ${p?.unit??""}, accepted is ${off.l.accepted} ${p?.unit??""}. Make the batch quantities match.`,`${p?.product??"Produkt"}: Chargen ergeben ${off.sum} ${p?.unit??""}, angenommen sind ${off.l.accepted} ${p?.unit??""}. Chargenmengen angleichen.`));return;}
  if(!validOperation("receive_direct",body)){setError(s("Check products, quantities, rejection notes and batch totals. Each accepted quantity needs matching expiry batches; explain missing dates.","Produkte, Mengen, Ablehnungsgründe und Chargensummen prüfen. Angenommene Mengen benötigen passende Ablaufchargen; fehlende Daten begründen."));return;}
  const serialized=JSON.stringify(body);if(command.current?.body!==serialized)command.current={body:serialized,id:crypto.randomUUID()};setBusy(true);
  try{const r=submit?await submit(branch,command.current.id,body):await inventoryOperation(branch,command.current.id,"receive_direct",body);if(!r.ok){setError(r.error==="conflict"?s("Reference already recorded or changed. Check saved receipts before retrying.","Referenz bereits erfasst oder geändert. Vor erneutem Versuch gespeicherte Belege prüfen."):s("Receipt was not confirmed. Inputs retained; check saved records before retrying.","Empfang nicht bestätigt. Eingaben bleiben erhalten; vor erneutem Versuch gespeicherte Belege prüfen."));return;}await onSaved();}
  catch{setError(s("Receipt could not be confirmed. Check saved records before retrying.","Empfang nicht bestätigt. Vor erneutem Versuch gespeicherte Belege prüfen."));}finally{setBusy(false);}
 }
 return <NativeDialog wide unsaved title={s("Receive a delivery","Lieferung annehmen")} busy={busy} onClose={close}><form onSubmit={e=>{e.preventDefault();void save();}}><fieldset className="inventory-recipe-fields" disabled={busy}><legend className="sr-only">{s("Delivery receipt","Wareneingangsbeleg")}</legend>{error&&<p role="alert" tabIndex={-1} key={error} ref={reveal}>{error}</p>}
  <DeliveryNoteReader onNote={applyNote} disabled={busy}/>
  {scan&&<div className="note-scan" role="status"><strong>{s(`Read ${scan.lines} lines · ${scan.matched} filled in`,`${scan.lines} Positionen gelesen · ${scan.matched} ausgefüllt`)}{scan.totalOk===true?s(" · lines add up to the net total"," · Summe stimmt mit Nettosumme"):scan.totalOk===false?s(" · lines do NOT add up to the net total — check the amounts"," · Summe weicht von der Nettosumme ab — Beträge prüfen"):""}</strong>
   {scan.open.length>0&&<><span>{s("Choose the product and quantity yourself for:","Produkt und Menge selbst wählen für:")}</span><ul>{scan.open.map((d,i)=><li key={i}>{d}</li>)}</ul></>}</div>}
  <div className="inventory-insight-coverage"><Field label={s("Supplier","Lieferant")}><input className="form-input" required maxLength={160} list="direct-suppliers" aria-label={s("Supplier","Lieferant")} value={supplier} onChange={e=>{setSupplier(e.target.value);setReviewed(false);}}/><datalist id="direct-suppliers">{suppliers.filter(p=>p.is_active).map(p=><option value={p.name} key={p.id}/>)}</datalist></Field><Field label={s("Invoice / delivery reference","Rechnungs- / Lieferscheinreferenz")}><input className="form-input" required maxLength={160} value={invoice} onChange={e=>{setInvoice(e.target.value);setReviewed(false);}}/></Field><Field label={s("Delivery date","Lieferdatum")}><input className="form-input" type="date" required min="2000-01-01" max={berlinToday()} value={date} onChange={e=>{setDate(e.target.value);setReviewed(false);}}/></Field></div>
  {lines.map((line,index)=>{const p=products.find(p=>p.id===line.product_id);return <fieldset className="inventory-recipe-line" key={index}><legend>{s("Delivery item","Lieferposition")} {index+1}</legend><Field label={`${s("Product","Produkt")} ${index+1}`}><select className="form-select" required value={line.product_id} onChange={e=>change(index,{...blank(),product_id:e.target.value})}><option value="">{s("Choose product","Produkt wählen")}</option>{products.map(p=><option key={p.id} value={p.id}>{p.product} · {p.category} · {p.unit||"—"}</option>)}</select></Field><Field label={`${s("Accepted quantity","Angenommene Menge")} ${index+1} (${p?.unit??"—"})`}><input className="form-input" type="number" required min="0" max="999999999" step="any" value={line.accepted} onChange={e=>change(index,{accepted:e.target.value,batches:line.batches.length===0||line.batches.length===1&&line.batches[0].qty===line.accepted?[{...(line.batches[0]??blankReceiptLot()),qty:e.target.value}]:line.batches})}/></Field><Field label={`${s("Rejected quantity","Abgelehnte Menge")} ${index+1}`}><input className="form-input" type="number" required min="0" max="999999999" step="any" value={line.rejected} onChange={e=>change(index,{rejected:e.target.value})}/></Field>{!costHidden&&<><Field label={`${s("Accepted line cost (€)","Kosten angenommener Position (€)")} ${index+1}`}><input className="form-input" type="number" min="0" max="999999999" step="any" value={line.cost} onChange={e=>change(index,{cost:e.target.value})}/></Field></>}<Field label={`${s("Rejection reason / note","Ablehnungsgrund / Notiz")} ${index+1}`}><input className="form-input" required={Number(line.rejected)>0} minLength={Number(line.rejected)>0?3:undefined} maxLength={1000} value={line.note} onChange={e=>change(index,{note:e.target.value})}/></Field>{Number(line.accepted)>0&&p&&<ReceiptBatches product={p.product} unit={p.unit} accepted={Number(line.accepted)} lots={line.batches} onChange={batches=>change(index,{batches})}/>}<button type="button" className="btn-secondary" disabled={lines.length===1} onClick={()=>{setLines(prev=>prev.filter((_,i)=>i!==index));setReviewed(false);}}>{s("Remove item","Position entfernen")} {index+1}</button></fieldset>;})}
  <button type="button" className="btn-secondary" disabled={lines.length>=500} onClick={()=>{setLines(prev=>[...prev,blank()]);setReviewed(false);}}>{s("Add delivery item","Lieferposition hinzufügen")}</button><Field label={s("Receipt note","Belegnotiz")}><textarea className="form-input" maxLength={1000} value={note} onChange={e=>{setNote(e.target.value);setReviewed(false);}}/></Field><label className="inventory-prep-confirm"><input type="checkbox" required checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>{s("I checked quantities, label dates and the delivery reference. This is not a physical stock count.","Ich habe Mengen, Etikettdaten und Lieferreferenz geprüft. Dies ist keine physische Bestandszählung.")}</label><div className="row-actions"><button type="submit" className="btn-gold" disabled={!reviewed}>{s("Post delivery","Lieferung buchen")}</button><button type="button" className="btn-secondary" onClick={close}>{s("Cancel","Abbrechen")}</button></div>
 </fieldset></form></NativeDialog>;
}

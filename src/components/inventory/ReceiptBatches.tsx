"use client";
import { Field } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
export type ReceiptLotInput={qty:string;expiry:string;expiry_note:string;lot:string};
export const blankReceiptLot=(qty=""):ReceiptLotInput=>({qty,expiry:"",expiry_note:"",lot:""});
export default function ReceiptBatches({product,unit,accepted,lots,onChange}:{product:string;unit:string|null;accepted:number;lots:ReceiptLotInput[];onChange:(lots:ReceiptLotInput[])=>void}){
 const {locale}=useLang(),s=(en:string,de:string)=>locale==="de"?de:en;
 const total=lots.reduce((n,l)=>n+(Number(l.qty)||0),0);
 return <fieldset className="inventory-recipe-line"><legend>{product} · {s("Delivery batches","Lieferchargen")}</legend>
  <p>{s("Allocated / accepted","Zugeordnet / angenommen")}: {total.toLocaleString(locale==="de"?"de-DE":"en-GB",{maximumFractionDigits:6})} / {accepted} {unit}</p>
  {lots.map((lot,index)=><fieldset className="inventory-recipe-line" key={index}><legend>{s("Batch","Charge")} {index+1}</legend>
   <Field label={`${s("Batch quantity","Chargenmenge")} ${index+1}: ${product} (${unit??"—"})`}><input className="form-input" type="number" required min="0.000001" step="any" value={lot.qty} onFocus={e=>e.target.select()} onChange={e=>onChange(lots.map((v,i)=>i===index?{...v,qty:e.target.value}:v))}/></Field>
   <Field label={`${s("Expiry date","Ablaufdatum")} ${index+1}: ${product}`}><input className="form-input" type="date" value={lot.expiry} onChange={e=>onChange(lots.map((v,i)=>i===index?{...v,expiry:e.target.value,expiry_note:""}:v))}/></Field>
   <Field label={`${s("Lot number (if shown)","Chargennummer (falls angegeben)")} ${index+1}: ${product}`}><input className="form-input" maxLength={160} value={lot.lot} onChange={e=>onChange(lots.map((v,i)=>i===index?{...v,lot:e.target.value}:v))}/></Field>
   {!lot.expiry&&<Field label={`${s("Reason expiry is unavailable / not applicable","Grund: Ablaufdatum fehlt / nicht zutreffend")} ${index+1}: ${product}`}><input className="form-input" required minLength={3} maxLength={500} value={lot.expiry_note} onChange={e=>onChange(lots.map((v,i)=>i===index?{...v,expiry_note:e.target.value}:v))}/></Field>}
   <button type="button" className="btn-secondary" onClick={()=>onChange(lots.filter((_,i)=>i!==index))}>{s("Remove batch","Charge entfernen")} {index+1}</button>
  </fieldset>)}
  <button type="button" className="btn-secondary" disabled={lots.length>=100} onClick={()=>onChange([...lots,blankReceiptLot(accepted>total?String(accepted-total):"")])}>{s("Add another expiry batch","Weitere Ablaufcharge hinzufügen")}</button>
 </fieldset>;
}

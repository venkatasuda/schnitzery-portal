"use client";
import { useEffect,useRef,useState } from "react";
import Link from "next/link";
import InventoryNav from "@/components/InventoryNav";
import { useLang } from "@/components/LanguageProvider";
import { Field,PageHeader,Panel } from "@/components/ui";
import { getInventoryRecipes,saveInventoryRecipe } from "@/lib/queries/inventory-recipes";
import { convertIngredient,recipeCost,type RecipeVersion } from "@/lib/inventory/recipes";
import { formatEur,formatPct } from "@/lib/format";

type Data=Extract<Awaited<ReturnType<typeof getInventoryRecipes>>,{ok:true}>;
type Line={product_id:string;qty:string;unit:string};
const blank=():Line=>({product_id:"",qty:"",unit:""});
export default function InventoryRecipesPage(){
 const {locale}=useLang(),s=(en:string,de:string)=>locale==="de"?de:en;
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 const [name,setName]=useState(""),[portions,setPortions]=useState("1"),[price,setPrice]=useState(""),[lines,setLines]=useState<Line[]>([blank()]),[netConfirmed,setNetConfirmed]=useState(false);
 const sequence=useRef(0),command=useRef<{body:string;id:string}|null>(null);
 async function load(){const seq=++sequence.current;setLoading(true);setError("");try{const r=await getInventoryRecipes();if(seq!==sequence.current)return;if(r.ok){setData(r);setNetConfirmed(false);}else setError(r.error);}catch{if(seq===sequence.current)setError("load");}finally{if(seq===sequence.current)setLoading(false);}}
 useEffect(()=>{void load();return()=>{sequence.current++;};},[]);
 const ingredients=lines.flatMap(l=>{const p=data?.products.find(p=>p.id===l.product_id);const qty=p?.unit?convertIngredient(Number(l.qty),l.unit,p.unit):null;return p&&qty!=null?[{product_id:p.id,product:p.product,category:p.category??"",unit:p.unit!,qty,entered_qty:Number(l.qty),entered_unit:l.unit}]:[];});
 const valid=!!name.trim()&&ingredients.length===lines.length&&Number(portions)>0&&price.trim()!==""&&Number(price)>=0;
 const draft:RecipeVersion={id:"preview",name,portions:Number(portions),net_price:Number(price),ingredients,created_at:"",prices_net_confirmed:netConfirmed};
 const cost=recipeCost(draft,data?.products??[]);
 const money=(v:number|null)=>formatEur(v,locale,2);
 function editLine(index:number,update:Partial<Line>){setSaved(false);setNetConfirmed(false);setLines(prev=>prev.map((l,i)=>i===index?{...l,...update}:l));}
 async function save(){if(!data||!valid||busy)return;setBusy(true);setSaved(false);setError("");
  const body=JSON.stringify({name,portions,price,lines,netConfirmed});if(command.current?.body!==body)command.current={body,id:crypto.randomUUID()};
  try{const r=await saveInventoryRecipe(data.branch.id,command.current.id,name,Number(portions),Number(price),lines.map(l=>({...l,qty:Number(l.qty)})),netConfirmed);if(!r.ok){setError(r.error);return;}command.current=null;await load();setSaved(true);}catch{setError("save");}finally{setBusy(false);}
 }
 function copy(r:RecipeVersion){if((name||lines.some(l=>l.product_id))&&!window.confirm(s("Replace the unsaved recipe draft?","Ungespeicherten Rezeptentwurf ersetzen?")))return;setName(r.name);setPortions(String(r.portions));setPrice(String(r.net_price));setLines(r.ingredients.map(i=>({product_id:i.product_id,qty:String(i.entered_qty),unit:i.entered_unit})));setNetConfirmed(false);setSaved(false);}
 return <div className="inventory-page"><InventoryNav active="reports"/><PageHeader title={s("Recipe costing","Rezeptkalkulation")} subtitle={data?.branch.name??s("Choose a branch to plan ingredient costs.","Filiale wählen, um Zutatenkosten zu planen.")} actions={<Link className="btn-secondary" href="/inventory/insights">{s("Business insights","Geschäftsauswertung")}</Link>}/>
  <p className="business-note">{s("Planning only: ingredients are not deducted from stock. Each save creates an immutable recipe version. Costs use current recorded delivery prices, not historic menu profitability. Enter selling prices excluding VAT.","Nur Planung: Kein Bestandsabzug. Jedes Speichern erstellt eine unveränderliche Rezeptversion. Kosten verwenden aktuelle erfasste Lieferpreise, keine historischen Speisenergebnisse. Verkaufspreise ohne MwSt. eingeben.")}</p>
  {loading?<p role="status">{s("Loading…","Wird geladen…")}</p>:!data?<div className="card" role="alert"><p>{s("Recipe planning is unavailable. Choose a branch or contact the administrator.","Rezeptplanung nicht verfügbar. Filiale wählen oder Administration kontaktieren.")}</p><button className="btn-secondary" onClick={load}>{s("Retry","Erneut versuchen")}</button></div>:<>
   {error&&<p role="alert">{s("Could not save. Check the ingredient units and try again. Your draft is retained.","Speichern fehlgeschlagen. Zutateneinheiten prüfen und erneut versuchen. Der Entwurf bleibt erhalten.")}</p>}
   {saved&&<p role="status">{s("Recipe version saved.","Rezeptversion gespeichert.")}</p>}
   <Panel title={s("New recipe version","Neue Rezeptversion")}><form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy} className="inventory-recipe-fields"><legend className="sr-only">{s("Recipe inputs","Rezeptangaben")}</legend>
    <div className="inventory-insight-coverage"><Field label={s("Dish name","Gerichtname")}><input className="form-input" required maxLength={160} value={name} onChange={e=>{setName(e.target.value);setSaved(false);}}/></Field><Field label={s("Portions per batch","Portionen pro Ansatz")}><input className="form-input" type="number" required min="0.000001" max="999999" step="any" value={portions} onChange={e=>setPortions(e.target.value)}/></Field><Field label={s("Net selling price per portion (€)","Nettoverkaufspreis pro Portion (€)")}><input className="form-input" type="number" required min="0" max="999999" step="any" value={price} onChange={e=>setPrice(e.target.value)}/></Field></div>
    {lines.map((l,index)=>{const p=data.products.find(p=>p.id===l.product_id);const converted=p?.unit?convertIngredient(Number(l.qty),l.unit,p.unit):null;return <fieldset key={index} className="inventory-recipe-line"><legend>{s("Ingredient","Zutat")} {index+1}</legend>
     <Field label={s("Product","Produkt")}><select className="form-select" required value={l.product_id} onChange={e=>{const p=data.products.find(p=>p.id===e.target.value);editLine(index,{product_id:e.target.value,unit:p?.unit??""});}}><option value="">{s("Choose product","Produkt wählen")}</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.product} · {p.category} · {p.unit||s("unit missing","Einheit fehlt")} · {formatEur(p.price,locale,4)}</option>)}</select></Field>
     <Field label={s("Quantity for the whole batch","Menge für den gesamten Ansatz")}><input className="form-input" required type="number" min="0.000001" step="any" value={l.qty} onChange={e=>editLine(index,{qty:e.target.value})}/></Field>
     <Field label={s("Entered unit","Eingabeeinheit")}><select className="form-select" required value={l.unit} onChange={e=>editLine(index,{unit:e.target.value})}><option value="">{s("Choose unit","Einheit wählen")}</option>{[...new Set([p?.unit,"kg","g","l","ml","pcs"].filter((v):v is string=>!!v))].map(u=><option key={u} value={u}>{u}</option>)}</select></Field>
     <p className="muted">{converted==null?s("Choose compatible units; pack, mass and volume conversions are never guessed.","Kompatible Einheiten wählen; Packungs-, Gewichts- und Volumenumrechnungen werden nie geschätzt."):`${converted.toLocaleString(locale==="de"?"de-DE":"en-GB",{maximumFractionDigits:6})} ${p?.unit}`}</p>
     <button type="button" className="btn-secondary" disabled={lines.length===1} onClick={()=>setLines(prev=>prev.filter((_,i)=>i!==index))}>{s("Remove ingredient","Zutat entfernen")} {index+1}</button>
    </fieldset>})}
    <button type="button" className="btn-secondary" disabled={lines.length>=100} onClick={()=>setLines(prev=>[...prev,blank()])}>{s("Add ingredient","Zutat hinzufügen")}</button>
    <label><input type="checkbox" checked={netConfirmed} onChange={e=>setNetConfirmed(e.target.checked)}/> {s("I verified that the ingredient purchase prices exclude VAT. Without this review, contribution and percentage are withheld.","Ich habe geprüft, dass die Zutateneinkaufspreise ohne MwSt. sind. Ohne diese Prüfung bleiben Beitrag und Quote ausgeblendet.")}</label>
    <div className="inventory-insight-kpis"><article className="business-kpi"><span>{s("Ingredient cost per portion","Zutatenkosten pro Portion")}</span><strong>{valid?money(cost.perPortion):"—"}</strong></article><article className="business-kpi"><span>{s("Ingredient contribution before labour and overheads","Beitrag vor Personal- und Gemeinkosten")}</span><strong>{valid?money(cost.contribution):"—"}</strong></article><article className="business-kpi"><span>{s("Ingredient cost / net price","Zutatenkosten / Nettopreis")}</span><strong>{valid?formatPct(cost.ingredientPct,locale):"—"}</strong></article></div>
    {!cost.total.complete&&<p>{s("Some delivery prices are missing. Contribution is withheld.","Einige Lieferpreise fehlen. Der Beitrag wird nicht ausgewiesen.")}</p>}
    <button className="btn-gold" disabled={!valid||busy} type="submit">{busy?s("Saving…","Wird gespeichert…"):s("Save new version","Neue Version speichern")}</button>
   </fieldset></form></Panel>
   <Panel title={s("Saved versions · latest 80","Gespeicherte Versionen · letzte 80")}><div className="table-scroll" role="region" aria-label={s("Recipe versions","Rezeptversionen")} tabIndex={0}><table className="data-table"><thead><tr>{[s("Dish / version","Gericht / Version"),s("Portions","Portionen"),s("Current ingredient cost / portion","Aktuelle Zutatenkosten / Portion"),s("Contribution review","Beitragsprüfung"),s("Action","Aktion")].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{data.recipes.map(r=>{const c=recipeCost({...r,prices_net_confirmed:false},data.products);return <tr key={r.id}><th scope="row">{r.name}<div className="muted">{new Date(r.created_at).toLocaleString(locale==="de"?"de-DE":"en-GB",{timeZone:"Europe/Berlin"})} · {r.id.slice(0,8)}</div></th><td>{r.portions}</td><td>{money(c.perPortion)}</td><td>{s("Copy and review current price basis","Kopieren und aktuelle Preisbasis prüfen")}</td><td><button className="btn-secondary" disabled={busy} onClick={()=>copy(r)}>{s("Copy as new version","Als neue Version kopieren")}</button></td></tr>;})}{!data.recipes.length&&<tr><td colSpan={5}>{s("No saved recipes yet.","Noch keine gespeicherten Rezepte.")}</td></tr>}</tbody></table></div></Panel>
  </>}
 </div>;
}

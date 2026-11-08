"use client";
// Recipe yields (unchanged from the former Prep planning page): confirmed yields let a prep item
// show the raw ingredients needed for its amount.
import { useEffect,useRef,useState } from "react";
import { Field,Panel } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { berlinToday } from "@/lib/time/berlinDate";
import { getInventoryPreparation,saveInventoryYield } from "@/lib/queries/inventory-preparation";
type Data=Extract<Awaited<ReturnType<typeof getInventoryPreparation>>,{ok:true}>;
export default function RecipeYields(){
 const {locale}=useLang(),s=(en:string,de:string)=>locale==="de"?de:en;
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [recipeId,setRecipe]=useState(""),[output,setOutput]=useState(""),[unit,setUnit]=useState("kg"),[losses,setLosses]=useState<string[]>([]),[confirmed,setConfirmed]=useState(false),[note,setNote]=useState("");
 const command=useRef<{body:string;id:string}|null>(null);
 const number=(n:number)=>n.toLocaleString(locale==="de"?"de-DE":"en-GB",{maximumFractionDigits:6});
 async function load(){setLoading(true);setError("");try{const r=await getInventoryPreparation(berlinToday());if(r.ok)setData(r);else{setData(null);setError(r.error);}}catch{setData(null);setError("load");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 const recipesById=new Map(data?.recipes.map(r=>[r.id,r])),recipe=recipesById.get(recipeId);
 const validYield=!!recipe&&output.trim()!==""&&Number(output)>0&&Number(output)<1e9&&losses.length===recipe.ingredients.length&&losses.every((n,i)=>n.trim()!==""&&Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=recipe.ingredients[i].qty);
 async function save(){
  if(!data||busy)return;setBusy(true);setError("");setMessage("");
  const body=JSON.stringify({branch:data.branch.id,recipeId,output,unit,losses,confirmed,note});
  if(command.current?.body!==body)command.current={body,id:crypto.randomUUID()};
  try{const r=await saveInventoryYield(data.branch.id,command.current.id,recipeId,Number(output),unit,losses.map(Number),confirmed,note);if(!r.ok){setError(r.error);return;}command.current=null;await load();setMessage(s("Yield version saved.","Ausbeuteversion gespeichert."));}
  catch{setError("save");}finally{setBusy(false);}
 }
 if(loading)return <p role="status">{s("Loading recipe yields…","Rezeptausbeuten werden geladen…")}</p>;
 if(!data)return <button className="btn-secondary" onClick={()=>load()}>{s("Retry","Erneut versuchen")}</button>;
 return <>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{s("Could not save the yield. Unsaved fields are retained.","Ausbeute konnte nicht gespeichert werden. Ungespeicherte Felder bleiben erhalten.")}</p>}
  <Panel title={s("Recipe yields (optional, for ingredient amounts)","Rezeptausbeuten (optional, für Zutatenmengen)")}><form onSubmit={e=>{e.preventDefault();void save();}}><fieldset className="inventory-recipe-fields" disabled={busy}><legend className="sr-only">{s("Recipe yield","Rezeptausbeute")}</legend>
   <Field label={s("Recipe version","Rezeptversion")}><select className="form-select" required value={recipeId} onChange={e=>{const r=recipesById.get(e.target.value);setRecipe(e.target.value);setLosses(r?.ingredients.map(()=>"")??[]);setOutput("");setConfirmed(false);setNote("");}}><option value="">{s("Choose saved recipe","Gespeichertes Rezept wählen")}</option>{data.recipes.map(r=><option key={r.id} value={r.id}>{r.name} · {r.id.slice(0,8)}</option>)}</select></Field>
   {!data.recipes.length&&<p>{s("Save a recipe with raw ingredient quantities first (Recipes & costing).","Zuerst ein Rezept mit rohen Zutatenmengen speichern (Rezepte & Kalkulation).")}</p>}
   <div className="inventory-insight-coverage"><Field label={s("Usable output per batch","Nutzbare Menge pro Ansatz")}><input className="form-input" type="number" min="0.000001" max="999999999" step="any" required value={output} onChange={e=>{setOutput(e.target.value);setConfirmed(false);}}/></Field><Field label={s("Output unit","Ausgabeeinheit")}><select className="form-select" value={unit} onChange={e=>{setUnit(e.target.value);setConfirmed(false);}}>{["kg","l","pcs"].map(u=><option key={u}>{u}</option>)}</select></Field></div>
   {recipe?.ingredients.map((i,index)=><div className="inventory-recipe-line" key={index}><span>{i.product} · {s("Raw per batch","Roh pro Ansatz")}: {number(i.qty)} {i.unit}</span><Field label={`${s("Expected trimming","Erwarteter Verschnitt")} ${index+1} (${i.unit})`}><input className="form-input" type="number" min="0" max={i.qty} step="any" required value={losses[index]??""} onChange={e=>{setLosses(prev=>prev.map((v,n)=>n===index?e.target.value:v));setConfirmed(false);}}/></Field></div>)}
   <Field label={s("Yield evidence / notes","Ausbeutenachweis / Notizen")}><textarea className="form-input" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></Field>
   <label className="inventory-prep-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{s("I verified the usable batch output and trimming quantities.","Ich habe nutzbare Ansatzmenge und Verschnitt geprüft.")}</label>
   <button type="submit" className="btn-gold" disabled={!validYield||busy}>{s("Save yield version","Ausbeuteversion speichern")}</button>
  </fieldset></form>
  <details><summary>{s("Saved yield versions","Gespeicherte Ausbeuteversionen")} ({data.yields.length})</summary><ul>{[...data.yields].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(y=><li key={y.id}>{recipesById.get(y.recipe_id)?.name} · {number(y.output_qty)} {y.output_unit} · {y.confirmed?s("Confirmed","Bestätigt"):s("Unconfirmed","Unbestätigt")} · {y.id.slice(0,8)}</li>)}</ul></details></Panel>
 </>;
}

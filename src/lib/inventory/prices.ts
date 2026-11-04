import { isCalendarDate } from "../time/berlinDate";
import { latestPrice } from "../analytics/coverage";
import { inventoryKey } from "./identity";
export type PriceKind = "invoice_reference"|"supplier_quote"|"online_estimate"|"manual";
export type PriceReference = {item:string;source:string;article_no:string;pack_size:string;bought_quantity:string;quote_qty:number|null;quote_unit:string|null;price:number|null;basis:"net"|"gross"|null;vat_pct:number|null;observed_date:string|null;kind:PriceKind;line_total:number|null;notes:string};
export type PriceBody = {pack_qty:number;pack_price:number;basis:"net"|"gross";vat_pct:number|null;effective_date:string;source:string;source_type:PriceKind;note:string;reference_import_id:string|null;reference_index:number|null;reviewed:boolean};
export type PriceVersion = Omit<PriceBody,"reviewed"> & {id:string;product_id:string;revision:number;product:string;category:string|null;unit:string;net_unit_price:number;created_at:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const text=(v:unknown,max:number,required=false)=>typeof v==="string"&&v.length<=max&&(!required||v.trim().length>0);
const quantity=(v:unknown,positive=false)=>typeof v==="number"&&Number.isFinite(v)&&v>=(positive?Number.MIN_VALUE:0)&&v<1e9;
export const priceKinds:PriceKind[]=["invoice_reference","supplier_quote","online_estimate","manual"];
export function validPriceReference(r:unknown):r is PriceReference {
  return object(r)&&text(r.item,160,true)&&text(r.source,300,true)&&text(r.article_no,160)&&text(r.pack_size,160)&&text(r.bought_quantity,160)&&text(r.notes,2000)
    &&(r.quote_qty===null||quantity(r.quote_qty,true))&&(r.quote_unit===null||text(r.quote_unit,30,true))&&(r.price===null||quantity(r.price))&&(r.line_total===null||quantity(r.line_total))
    &&(r.basis===null||r.basis==="net"||r.basis==="gross")&&(r.vat_pct===null||typeof r.vat_pct==="number"&&Number.isFinite(r.vat_pct)&&r.vat_pct>=0&&r.vat_pct<=100)
    &&(r.observed_date===null||isCalendarDate(r.observed_date)&&r.observed_date>="2000-01-01"&&r.observed_date<="2100-12-31")&&priceKinds.includes(r.kind as PriceKind);
}
export function parsePriceImport(text:string):PriceReference[]|null {
  if(text.length>1_000_000)return null;
  try{const value=JSON.parse(text);return object(value)&&value.format==="schnitzery-price-reference-v1"&&Array.isArray(value.rows)&&value.rows.length>0&&value.rows.length<=500&&value.rows.every(validPriceReference)?value.rows:null;}catch{return null;}
}
export function validPriceBody(b:unknown):b is PriceBody {
  return object(b)&&quantity(b.pack_qty,true)&&quantity(b.pack_price)&&(b.basis==="net"||b.basis==="gross")&&(b.vat_pct===null||typeof b.vat_pct==="number"&&Number.isFinite(b.vat_pct)&&b.vat_pct>=0&&b.vat_pct<=100)&&(b.basis!=="gross"||b.vat_pct!==null)
    &&isCalendarDate(b.effective_date)&&b.effective_date>="2000-01-01"&&b.effective_date<="2100-12-31"&&text(b.source,300,true)&&priceKinds.includes(b.source_type as PriceKind)&&text(b.note,2000,true)&&(b.note as string).trim().length>=3
    &&(b.reference_import_id===null&&b.reference_index===null||typeof b.reference_import_id==="string"&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(b.reference_import_id)&&Number.isInteger(b.reference_index)&&Number(b.reference_index)>=0)&&b.reviewed===true;
}
type Purchase={qty:unknown;cost:unknown;purchase_date:string};
export function ingredientPrice(product:{id:string;product:string;category?:string|null;unit?:string|null},purchases:Purchase[],versions:PriceVersion[],today:string) {
  const actual=latestPrice(purchases,today);
  const actualDay=purchases.filter(p=>p.purchase_date<=today&&Number(p.qty)>0&&p.cost!=null&&p.cost!==""&&Number.isFinite(Number(p.cost))&&Number(p.cost)>=0&&Number.isFinite(Number(p.qty))).map(p=>p.purchase_date).sort().at(-1)??null;
  const reference=versions.filter(v=>v.product_id===product.id&&inventoryKey(v)===inventoryKey(product)&&v.effective_date<=today&&Number.isFinite(Number(v.net_unit_price))&&Number(v.net_unit_price)>=0).sort((a,b)=>b.effective_date.localeCompare(a.effective_date)||b.revision-a.revision)[0];
  if(reference&&(!actualDay||reference.effective_date>actualDay))return{price:Number(reference.net_unit_price),price_kind:"reference" as const,price_date:reference.effective_date,price_source:reference.source};
  return{price:actual,price_kind:actual==null?"missing" as const:"receipt" as const,price_date:actualDay,price_source:null};
}

import {createHmac,timingSafeEqual} from "node:crypto";
import {isCalendarDate} from "../time/berlinDate";
export type PosDailyPayload={format:"schnitzery-pos-daily-v1"|"schnitzery-pos-items-v1";external_id:string;currency:"EUR";days:{date:string;gross_sales:number}[];items?:{date:string;sku:string;qty:number}[]};
export function validPosDaily(value:unknown,today:string):value is PosDailyPayload{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;const p=value as PosDailyPayload;
 const daily=(p.format==="schnitzery-pos-daily-v1"||p.format==="schnitzery-pos-items-v1")&&p.currency==="EUR"&&typeof p.external_id==="string"&&p.external_id.trim().length>0&&p.external_id.length<=160&&Array.isArray(p.days)&&p.days.length>0&&p.days.length<=400&&new Set(p.days.map(d=>d?.date)).size===p.days.length&&p.days.every(d=>d&&isCalendarDate(d.date)&&d.date>="2000-01-01"&&d.date<=today&&typeof d.gross_sales==="number"&&Number.isFinite(d.gross_sales)&&d.gross_sales>=0&&d.gross_sales<=1e7&&Math.abs(d.gross_sales*100-Math.round(d.gross_sales*100))<1e-7);
 if(!daily)return false;
 if(p.format==="schnitzery-pos-daily-v1")return p.items===undefined;
 return Array.isArray(p.items)&&p.items.length>0&&p.items.length<=2000&&new Set(p.items.map(i=>JSON.stringify([i?.date,i?.sku]))).size===p.items.length&&p.items.every(i=>i&&p.days.some(d=>d.date===i.date)&&typeof i.sku==="string"&&i.sku.trim()===i.sku&&i.sku.length>0&&i.sku.length<=160&&Number.isFinite(i.qty)&&i.qty>0&&i.qty<=1e6);
}
export function verifyPosSignature(body:string,timestamp:string,signature:string,secret:string,now=Date.now()){
 if(secret.length<32||!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!/^sha256=[0-9a-f]{64}$/.test(signature))return false;
 const actual=Buffer.from(signature.slice(7),"hex"),expected=createHmac("sha256",secret).update(`${timestamp}.${body}`).digest();return timingSafeEqual(actual,expected);
}

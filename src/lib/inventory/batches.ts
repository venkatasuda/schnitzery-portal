import { isCalendarDate } from "../time/berlinDate";
export type ReceiptBatch={qty:number;expiry:string|null;expiry_note:string;lot:string};
export type StockBatch={production_id?:string|null;id:string;product:string;category:string|null;unit:string|null;qty:number;remaining_qty:number;expiry_date:string|null;received_date:string;status:string;note:string|null;lot_number:string;expiry_note:string;receipt_reference:string;receipt_line_id:string|null;purchase_id:string|null;daysToExpiry:number|null;flag:"expired"|"soon"|"ok"|"unknown"};
export function validReceiptBatches(value:unknown,accepted:number):value is ReceiptBatch[]{
 if(!Array.isArray(value)||value.length>100||!Number.isFinite(accepted)||accepted<0)return false;
 if(accepted===0)return value.length===0;
 if(!value.length)return false;
 let total=0;
 for(const b of value){
  if(!b||typeof b!=="object"||typeof b.qty!=="number"||!Number.isFinite(b.qty)||b.qty<=0||b.qty>=1e9||typeof b.lot!=="string"||b.lot.length>160||typeof b.expiry_note!=="string"||b.expiry_note.length>500||!(isCalendarDate(b.expiry)||(b.expiry===null&&b.expiry_note.trim().length>=3)))return false;
  total+=b.qty;
 }
 return Math.abs(total-accepted)<=Number.EPSILON*Math.max(1,total,accepted)*value.length*4;
}
export function batchFlag(date:string|null,today:string){
 if(date==null)return{daysToExpiry:null,flag:"unknown" as const};
 const daysToExpiry=Math.round((Date.parse(date+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000);
 return{daysToExpiry,flag:daysToExpiry<0?"expired" as const:daysToExpiry<=3?"soon" as const:"ok" as const};
}

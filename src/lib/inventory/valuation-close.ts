export type ValuationLine={source_id:string;batch_id:string;kind:"on_hand"|"in_transit";product:string;category:string|null;unit:string|null;qty:number;cost_review_id:string|null;cost_revision:number|null;net_unit_cost:number|null;value_net:number|null};
export type ValuationSnapshot={captured_at:string;method:string;currency:"EUR";lines:ValuationLine[];total_net:number;unpriced:number;unreconciled:{product:string;category:string;unit:string;ist:number|null;tracked_qty:number;count_date:string|null}[];complete:boolean};
export function valuationCsv(snapshot:ValuationSnapshot){
 const cell=(value:unknown)=>{let text=String(value??"");if(/^[=+\-@\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return [["kind","product","category","unit","quantity","net_unit_cost_eur","net_value_eur","batch_id","cost_review_id"],...snapshot.lines.map(l=>[l.kind,l.product,l.category,l.unit,l.qty,l.net_unit_cost,l.value_net,l.batch_id,l.cost_review_id])].map(row=>row.map(cell).join(",")).join("\r\n");
}

import { figure, latestPrice, spendFigure } from "../analytics/coverage";
import { inventoryKey } from "./identity";

type Item = { product: string; category?: string | null; unit?: string | null };
export type InsightProduct = Item & { id: string; soll: unknown; reorder_point?: unknown; reorder_qty?: unknown };
export type InsightPurchase = Item & { qty: unknown; cost: unknown; purchase_date: string; supplier?: string | null };
export type InsightCount = Item & { ist: unknown; count_date: string };
export type InsightWaste = Item & { qty: unknown; work_date: string; reason: string };
export type InsightBatch = Item & { id: string; qty: unknown; expiry_date: string };
export type InsightOrder = { id: string; supplier_id: string; supplier_name: string; reference: string; status: string; expected_date: string | null; created_at: string };
export type InsightLine = { id: string; order_id: string; qty: unknown; received_qty: unknown; unit_price: unknown };
export type InsightReceipt = { id: string; order_id: string; received_at: string };
export type InsightReceiptLine = { receipt_id: string; order_line_id: string; accepted: unknown; rejected: unknown };
const num = (n: unknown): number | null => n == null || n === "" || !Number.isFinite(Number(n)) || Number(n) < 0 ? null : Number(n);
const day = (date: string) => Date.parse(`${date}T12:00:00Z`);
const round = (n: number) => Math.round(n * 100) / 100;
export type InsightAction = { kind: "count" | "price" | "expiry" | "order" | "waste"; label: string; value: number | null; href: string; priority: number };

// Prices are comparable only within the same product/category/unit identity.
// These are management estimates at recorded delivery prices, not a financial stock ledger.
export function inventoryInsights(input: {
  today: string; from: string; previousFrom: string; products: InsightProduct[]; counts: InsightCount[];
  purchases: InsightPurchase[]; waste: InsightWaste[]; batches: InsightBatch[];
  orders: InsightOrder[]; lines: InsightLine[]; receipts: InsightReceipt[]; receiptLines: InsightReceiptLine[];
}) {
  const { today, from, previousFrom } = input;
  const purchases = new Map<string, InsightPurchase[]>();
  for (const p of input.purchases) if (p.purchase_date <= today) {
    const key = inventoryKey(p); purchases.set(key, [...(purchases.get(key) ?? []), p]);
  }
  const latest = new Map<string, InsightCount>();
  for (const c of input.counts) if (c.count_date <= today) {
    const key = inventoryKey(c), old = latest.get(key);
    if (!old || c.count_date >= old.count_date) latest.set(key, c);
  }
  const actions: InsightAction[] = [];
  const stock = input.products.map(p => {
    const key = inventoryKey(p), count = latest.get(key), qty = num(count?.ist);
    const history = purchases.get(key) ?? [], price = latestPrice(history, today);
    const age = count ? Math.round((day(today) - day(count.count_date)) / 86400000) : null;
    const value = qty === 0 ? 0 : qty != null && price != null ? round(qty * price) : null;
    const target = num(p.soll), threshold = num(p.reorder_point) ?? target;
    const fresh = age != null && age <= 1;
    const suggested = fresh && qty != null && threshold != null && qty <= threshold
      ? Math.max(0, (target ?? threshold) - qty, num(p.reorder_qty) ?? 0) : null;
    if (!fresh || qty == null) actions.push({kind:"count",label:p.product,value:null,href:"/inventory?view=count",priority:2});
    const dates = [...new Set(history.filter(r => num(r.qty) != null && Number(r.qty) > 0 && num(r.cost) != null).map(r => r.purchase_date))].sort();
    const priorPrice = dates.length > 1 ? latestPrice(history, dates[dates.length - 2]) : null;
    const priceChange = price != null && priorPrice != null && priorPrice > 0 ? round((price / priorPrice - 1) * 100) : null;
    const periodQty = history.filter(r => r.purchase_date >= from).reduce((n,r) => n + (num(r.qty) ?? 0),0);
    const priceExposure = price != null && priorPrice != null ? round(Math.max(0, price-priorPrice)*periodQty) : null;
    if (priceChange != null && priceChange >= 5) actions.push({kind:"price",label:p.product,value:priceExposure,href:"/inventory?view=deliveries",priority:3});
    return {...p,qty,price,value,countDate:count?.count_date ?? null,priceDate:dates.at(-1)??null,age,fresh,suggested,priceChange,priorPrice,priceExposure};
  });
  const stockValue = figure(stock.reduce((n,p)=>n+(p.value??0),0),{counts:stock.filter(p=>p.qty==null).length,prices:stock.filter(p=>p.qty!=null&&p.qty>0&&p.price==null).length});
  function wastePeriod(start: string, end: string, inclusive: boolean) {
    const rows = input.waste.filter(w=>w.work_date>=start&&(inclusive?w.work_date<=end:w.work_date<end));
    const byReason = new Map<string,{reason:string;value:number;entries:number;unpriced:number}>();
    let value=0,missing=0;
    for(const w of rows){
      const price=latestPrice(purchases.get(inventoryKey(w))??[],w.work_date),qty=num(w.qty);
      const amount=qty===0?0:price!=null&&qty!=null?price*qty:null;
      if(amount==null)missing++;else value+=amount;
      const r=byReason.get(w.reason)??{reason:w.reason,value:0,entries:0,unpriced:0};
      r.entries++;if(amount==null)r.unpriced++;else r.value+=amount;byReason.set(w.reason,r);
    }
    return {figure:figure(value,{prices:missing}),entries:rows.length,reasons:[...byReason.values()].map(r=>({...r,value:round(r.value)})).sort((a,b)=>b.value-a.value)};
  }
  const waste=wastePeriod(from,today,true),previousWaste=wastePeriod(previousFrom,from,false);
  if(waste.entries)actions.push({kind:"waste",label:String(waste.entries),value:waste.figure.complete?waste.figure.value:null,href:"/waste",priority:3});
  const expiry=input.batches.filter(b=>b.expiry_date<=new Date(day(today)+3*86400000).toISOString().slice(0,10)).map(b=>{
    const qty=num(b.qty),price=latestPrice(purchases.get(inventoryKey(b))??[],today);
    return {...b,value:qty===0?0:qty!=null&&price!=null?round(qty*price):null,expired:b.expiry_date<today};
  }).sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date));
  for(const b of expiry)actions.push({kind:"expiry",label:b.product,value:b.value,href:"/expiry",priority:b.expired?0:1});
  const expiryValue=figure(expiry.reduce((n,b)=>n+(b.value??0),0),{prices:expiry.filter(b=>b.value==null).length});
  const open=input.orders.filter(o=>["sent","partial"].includes(o.status));
  const overdue=open.filter(o=>o.expected_date!=null&&o.expected_date<today);
  for(const o of overdue)actions.push({kind:"order",label:o.reference,value:null,href:`/inventory/purchasing?order=${o.id}`,priority:1});
  const orderLines=new Map<string,InsightLine[]>();
  for(const l of input.lines)orderLines.set(l.order_id,[...(orderLines.get(l.order_id)??[]),l]);
  const outstanding=spendFigure(open.flatMap(o=>{
    const lines=orderLines.get(o.id)??[];
    return lines.length?lines.map(l=>({cost:num(l.unit_price)==null||num(l.qty)==null||num(l.received_qty)==null?null:Math.max(0,Number(l.qty)-Number(l.received_qty))*Number(l.unit_price)})):[{cost:null}];
  }));
  const supplierMap=new Map<string,{id:string;name:string;orders:number;due:number;onTime:number;late:number;fill:number;fillLines:number;rejection:number;receiptLines:number}>();
  const receiptOrders=new Map(input.receipts.map(r=>[r.id,r.order_id]));
  for(const o of input.orders.filter(o=>o.created_at.slice(0,10)>=from&&o.created_at.slice(0,10)<=today&&!["draft","cancelled","approved"].includes(o.status))){
    const s=supplierMap.get(o.supplier_id)??{id:o.supplier_id,name:o.supplier_name,orders:0,due:0,onTime:0,late:0,fill:0,fillLines:0,rejection:0,receiptLines:0};
    s.orders++; const lines=orderLines.get(o.id)??[];
    if(o.expected_date&&o.expected_date<today){
      s.due++;
      const onTimeReceipts=new Set(input.receipts.filter(r=>r.order_id===o.id&&new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(r.received_at))<=o.expected_date!).map(r=>r.id));
      const accepted=new Map<string,number>();
      for(const r of input.receiptLines)if(onTimeReceipts.has(r.receipt_id))accepted.set(r.order_line_id,(accepted.get(r.order_line_id)??0)+(num(r.accepted)??0));
      const full=lines.length>0&&lines.every(l=>num(l.qty)!=null&&Number(l.qty)>0&&(accepted.get(l.id)??0)>=Number(l.qty));
      if(full)s.onTime++;else s.late++;
    }
    for(const l of lines){const q=num(l.qty),r=num(l.received_qty);if(q!=null&&q>0&&r!=null){s.fill+=Math.min(1,r/q);s.fillLines++;}}
    for(const r of input.receiptLines.filter(r=>receiptOrders.get(r.receipt_id)===o.id)){
      const a=num(r.accepted),b=num(r.rejected);if(a!=null&&b!=null&&a+b>0){s.rejection+=b/(a+b);s.receiptLines++;}
    }
    supplierMap.set(o.supplier_id,s);
  }
  const suppliers=[...supplierMap.values()].map(s=>({...s,onTimePct:s.due?round(s.onTime/s.due*100):null,fillPct:s.fillLines?round(s.fill/s.fillLines*100):null,rejectionPct:s.receiptLines?round(s.rejection/s.receiptLines*100):null})).sort((a,b)=>b.late-a.late||a.name.localeCompare(b.name));
  const periodPurchases=input.purchases.filter(p=>p.purchase_date>=from&&p.purchase_date<=today);
  const previousPurchases=input.purchases.filter(p=>p.purchase_date>=previousFrom&&p.purchase_date<from);
  const spend=spendFigure(periodPurchases),previousSpend=spendFigure(previousPurchases);
  return {stock,stockValue,waste,previousWaste,expiry,expiryValue,outstanding,suppliers,spend,previousSpend,
    wasteChange:waste.figure.complete&&previousWaste.figure.complete&&previousWaste.entries>0?round(waste.figure.value-previousWaste.figure.value):null,
    overdue:overdue.length,openOrders:open.length,
    actions:actions.sort((a,b)=>a.priority-b.priority||(b.value??-1)-(a.value??-1)).slice(0,12),
    coverage:{products:stock.length,counted:stock.filter(p=>p.qty!=null).length,fresh:stock.filter(p=>p.fresh&&p.qty!=null).length,priced:stock.filter(p=>p.price!=null).length},
  };
}

export function inventoryInsightsCsv(branch: string, from: string, today: string, stock: ReturnType<typeof inventoryInsights>["stock"]): string {
  const cell=(v:unknown)=>{
    let text=String(v??"");
    if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
    return `"${text.replaceAll('"','""')}"`;
  };
  const rows:unknown[][]=[["branch","report_from","report_to","product","category","unit","last_count_date","last_count_qty","last_delivery_unit_price_eur","estimated_value_eur","fresh_count","target_reorder_qty"],
    ...stock.map(p=>[branch,from,today,p.product,p.category,p.unit,p.countDate,p.qty,p.price,p.value,p.fresh,p.suggested])];
  return "\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n");
}

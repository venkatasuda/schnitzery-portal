import { isCalendarDate } from "../time/berlinDate";

export type ProductionDraft = {
  output_product_id: string|null; date: string|null; qty: number|null; expected_qty: number|null;
  expiry: string|null; lot: string; note: string; inputs: { batch_id: string|null; qty: number|null; planned_qty?: number|null }[];
};
export type ProductionRun = {
  id: string; status: "draft"|"posted"|"cancelled"; revision: number; draft: ProductionDraft;
  product: string|null; category: string|null; unit: string|null; qty: number|null; expected_qty: number|null;
  output_batch_id: string|null; production_date: string|null; created_at: string; posted_at: string|null; reversed_at: string|null;
};
export type ProductionBatch = {id:string; product:string; category:string|null; unit:string|null; remaining_qty:number; expiry_date:string|null; received_date:string; lot_number:string};
export type ProductionInput = {id:string; batch_id:string; stock_action_id:string; product:string; category:string|null; unit:string; qty:number;planned_qty:number|null;unit_cost:number|null;cost_source:{kind:string;purchase_id?:string;run_id?:string;tax_basis:string}|null};
const id = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const quantity = (v: unknown) => v === null || typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e9;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function validProductionDraft(d: unknown): d is ProductionDraft {
  if (!object(d) || !(d.output_product_id === null || id(d.output_product_id)) || !quantity(d.qty) || !quantity(d.expected_qty)
    || !(d.date === null || isCalendarDate(d.date) && d.date >= "2000-01-01" && d.date <= "2100-12-31")
    || !(d.expiry === null || isCalendarDate(d.expiry)) || typeof d.lot !== "string" || d.lot.length > 160
    || typeof d.note !== "string" || d.note.length > 1000 || !Array.isArray(d.inputs) || d.inputs.length > 100) return false;
  if (!d.inputs.every(line => object(line) && (line.batch_id === null || id(line.batch_id)) && quantity(line.qty) && (line.planned_qty===undefined || line.planned_qty===null || typeof line.planned_qty==="number" && Number.isFinite(line.planned_qty) && line.planned_qty>=0 && line.planned_qty<1e9))) return false;
  const batches = d.inputs.map(line => line.batch_id).filter(v => v !== null);
  return new Set(batches).size === batches.length;
}
export function productionVariance(actual: number|null, expected: number|null) {
  if (actual === null || expected === null || !Number.isFinite(actual) || actual <= 0 || !Number.isFinite(expected) || expected <= 0) return null;
  const percent=(actual / expected - 1) * 100;
  return Number.isFinite(percent)?{ quantity: actual - expected, percent }:null;
}

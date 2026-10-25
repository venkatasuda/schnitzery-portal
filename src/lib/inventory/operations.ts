export type InventoryAction = "supplier_save" | "product_save" | "po_save" | "po_approve" | "po_send" | "po_cancel" | "po_close" | "receive" | "waste_correct" | "transfer_receive";
export type Supplier = { id: string; name: string; email: string; lead_days: number; is_active: boolean; revision: number };
export type Product = { id: string; product: string; category: string; unit: string | null; soll: number; reorder_point: number | null; reorder_qty: number | null; supplier_id: string | null; revision: number; is_active: boolean };
export type PurchaseOrder = { id: string; supplier_id: string; supplier_name: string; supplier_email: string; reference: string; status: "draft" | "approved" | "sent" | "partial" | "closed" | "cancelled"; expected_date: string | null; note: string; revision: number; created_at: string };
export type PurchaseLine = { id: string; product_id: string; product: string; category: string; unit: string | null; qty: number; unit_price: number | null; received_qty: number };
export type Receipt = { id: string; invoice: string; note: string; received_at: string };
export type ReceiptLine = { id: string; receipt_id: string; order_line_id: string; accepted: number; rejected: number; cost: number; note: string };
export const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const number = (v: unknown, positive = false) => typeof v === "number" && Number.isFinite(v) && (positive ? v > 0 : v >= 0);
const text = (v: unknown, max: number, required = false) => typeof v === "string" && v.length <= max && (!required || v.trim().length > 0);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function validOperation(action: InventoryAction, body: unknown): body is Record<string, unknown> {
  if (!object(body) || (body.id != null && !uuid(body.id)) || (body.note != null && !text(body.note, 1000))) return false;
  if (body.id != null && (!Number.isInteger(body.revision) || !number(body.revision))) return false;
  if (action === "supplier_save") return text(body.name, 160, true) && text(body.email, 254) && (!body.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email as string)) && Number.isInteger(body.lead_days) && number(body.lead_days) && (body.lead_days as number) <= 365 && typeof body.is_active === "boolean";
  if (action === "product_save") return text(body.product,160,true) && text(body.category,100,true) && text(body.unit,30) && number(body.soll) && (body.reorder_point == null || number(body.reorder_point)) && (body.reorder_qty == null || number(body.reorder_qty,true)) && (body.supplier_id == null || uuid(body.supplier_id)) && typeof body.is_active === "boolean";
  if (action === "po_save") return uuid(body.supplier_id) && (body.expected_date == null || (typeof body.expected_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expected_date))) && Array.isArray(body.lines) && body.lines.length > 0 && body.lines.length <= 500 && body.lines.every(l=>object(l)&&uuid(l.product_id)&&number(l.qty,true)&&(l.unit_price==null||number(l.unit_price))) && new Set(body.lines.map(l=>l.product_id)).size===body.lines.length;
  if (!uuid(body.id)) return false;
  if (action === "receive") return text(body.invoice,160,true) && Array.isArray(body.lines) && body.lines.length > 0 && body.lines.length <= 500 && body.lines.every(l=>object(l)&&uuid(l.id)&&number(l.accepted)&&number(l.rejected)&&number(l.cost)&&text(l.note,1000)) && new Set(body.lines.map(l=>l.id)).size===body.lines.length;
  if (action === "waste_correct") return number(body.qty) && object(body.before) && text(body.note,1000,true) && (body.note as string).trim().length>=3;
  if (action === "transfer_receive") return number(body.qty);
  return ["po_approve","po_send","po_cancel","po_close"].includes(action);
}

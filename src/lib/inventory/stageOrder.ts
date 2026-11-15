// Reorder worksheet → purchase order form: one supplier's lines are handed over in this browser tab
// (sessionStorage) and turned into a pre-filled, unsaved order. Nothing is written until the manager saves it.
import { inventoryKey } from "./identity";

export const STAGE_KEY = "po-stage";
export type StagedItem = { product: string; category: string; unit: string; qty: number | string; unitPrice: number | null };
export type Staged = { supplier: string; items: StagedItem[] };
type Product = { id: string; product: string; category: string; unit: string | null; supplier_id: string | null; is_active: boolean };
type Supplier = { id: string; name: string; is_active: boolean };

// Lines for the order form. Supplier matched by name (case-insensitive); products by identity; qty must be > 0.
// Products that no longer exist are skipped and counted, so the form can say so instead of silently dropping them.
export function stagedOrder(staged: Staged, products: Product[], suppliers: Supplier[]) {
  const supplier = suppliers.find((s) => s.is_active && s.name.trim().toLocaleLowerCase() === staged.supplier.trim().toLocaleLowerCase());
  let skipped = 0;
  const lines = staged.items.flatMap((item) => {
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) return [];
    const product = products.find((p) => p.is_active && inventoryKey(p) === inventoryKey(item));
    if (!product) { skipped++; return []; }
    return [{ product_id: product.id, qty: String(qty), pack_id: "", unit_price: item.unitPrice == null ? "" : String(item.unitPrice) }];
  });
  return { supplier_id: supplier?.id ?? "", lines, skipped };
}

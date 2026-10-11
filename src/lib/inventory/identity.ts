// Legacy inventory rows identify an item by its category, name and unit together.
export function inventoryKey(item: { category?: string | null; product: string; unit?: string | null }): string {
  return JSON.stringify([item.category || "", item.product, item.unit || ""]);
}

export function validInventoryItem(item: { product?: unknown; category?: unknown; unit?: unknown }): boolean {
  return typeof item.product === "string" && item.product.trim().length > 0 && item.product.length <= 256 &&
    (item.category == null || (typeof item.category === "string" && item.category.length <= 128)) &&
    (item.unit == null || (typeof item.unit === "string" && item.unit.length <= 32));
}

// Counting in packs: "2 × 5 kg crate + 1.4 kg loose" → 11.4 (base unit). Pure, used by the count sheet.
// Blank fields count as 0; both blank = nothing entered (null). Negative or non-numeric input is invalid (NaN).
export function packTotal(packs: string, packQty: number, loose: string): number | null {
  if (packs.trim() === "" && loose.trim() === "") return null;
  const p = packs.trim() === "" ? 0 : Number(packs), l = loose.trim() === "" ? 0 : Number(loose);
  if (!Number.isFinite(p) || !Number.isFinite(l) || p < 0 || l < 0 || !(packQty > 0)) return NaN;
  return Math.round((p * packQty + l) * 1000) / 1000; // grams/ml precision, no float noise
}

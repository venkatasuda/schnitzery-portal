import { describe, expect, it } from "vitest";
import { validProductionDraft, productionVariance } from "./production";
const blank = { output_product_id:null, date:null, qty:null, expected_qty:null, expiry:null, lot:"", note:"", inputs:[] };
const batch = "11111111-1111-4111-8111-111111111111";
describe("manual production foundation", () => {
  it("allows incomplete drafts without inventing quantities or dates", () => {
    expect(validProductionDraft(blank)).toBe(true);
    expect(validProductionDraft({...blank,inputs:[{batch_id:null,qty:null}]})).toBe(true);
  });
  it("rejects duplicate allocation and invalid quantities before a write", () => {
    expect(validProductionDraft({...blank,inputs:[{batch_id:batch,qty:1},{batch_id:batch,qty:2}]})).toBe(false);
    for (const qty of [0,-1,NaN,Infinity,"1",undefined]) expect(validProductionDraft({...blank,qty})).toBe(false);
    expect(validProductionDraft({...blank,inputs:[{batch_id:batch,qty:1,planned_qty:2}]})).toBe(true);
    expect(validProductionDraft({...blank,inputs:[{batch_id:batch,qty:1,planned_qty:0}]})).toBe(true);
    expect(validProductionDraft({...blank,inputs:[{batch_id:batch,qty:1,planned_qty:-2}]})).toBe(false);
    expect(validProductionDraft({...blank,date:"2026-02-30"})).toBe(false);
    expect(validProductionDraft({...blank,inputs:[{batch_id:"foreign-or-invalid",qty:1}]})).toBe(false);
  });
  it("compares actual and expected output in the finished item's unit", () => {
    expect(productionVariance(9,10)).toEqual({quantity:-1,percent:expect.closeTo(-10)});
    expect(productionVariance(10,null)).toBeNull();
    expect(productionVariance(10,0)).toBeNull();
    expect(productionVariance(1,Number.MIN_VALUE)).toBeNull();
    expect(productionVariance(12,10)?.quantity).toBe(2);
  });
});

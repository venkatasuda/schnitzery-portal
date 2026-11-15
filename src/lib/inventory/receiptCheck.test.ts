import { expect, it } from "vitest";
import { checkLine, checkReceipt } from "./receiptCheck";

const line = { id: "a", qty: 10, received_qty: 0, unit_price: 5 };
const e = (accepted: string, rejected = "", cost = "") => ({ accepted, rejected, cost });

it("classifies each line and prices the differences at the order price", () => {
  expect(checkLine(line, e("10", "", "50"))).toEqual({ status: "match", shortageEur: 0, rejectedEur: 0, overbillEur: 0 });
  expect(checkLine(line, e("8", "", "40"))).toEqual({ status: "short", shortageEur: 10, rejectedEur: 0, overbillEur: 0 });
  expect(checkLine(line, e("9", "1", "45"))).toEqual({ status: "rejected", shortageEur: 0, rejectedEur: 5, overbillEur: 0 });
  expect(checkLine(line, e("10", "", "55.5"))).toEqual({ status: "over", shortageEur: 0, rejectedEur: 0, overbillEur: 5.5 });
  expect(checkLine({ ...line, received_qty: 6 }, e("4", "", ""))).toMatchObject({ status: "match", overbillEur: null }); // remaining 4, invoice cost unknown
});
it("keeps unknown unknown and leaves untouched lines out", () => {
  expect(checkLine({ ...line, unit_price: null }, e("8"))).toEqual({ status: "short", shortageEur: null, rejectedEur: null, overbillEur: null });
  expect(checkLine(line, e("-1"))).toMatchObject({ status: "unknown" });
  expect(checkLine(line, e(""))).toMatchObject({ status: "open" });
});
it("adds up a whole receipt into one possible supplier claim", () => {
  const lines = [line, { id: "b", qty: 4, received_qty: 0, unit_price: 2.5 }, { id: "c", qty: 1, received_qty: 0, unit_price: 9 }];
  const r = checkReceipt(lines, { a: e("8", "", "41"), b: e("3", "1", "7.5") }); // c not in this delivery
  expect(r).toEqual({ shortage: 10, rejected: 2.5, overbill: 1, claim: 13.5, complete: true, lines: 2 });
  expect(checkReceipt([{ ...line, unit_price: null }], { a: e("8") }).complete).toBe(false);
});

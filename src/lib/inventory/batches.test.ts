import { expect,it } from "vitest";
import { batchFlag,validReceiptBatches } from "./batches";
it("requires complete quantity allocation and real expiry dates or explicit missing-date reasons",()=>{
 const lot={qty:2,expiry:"2026-11-05",expiry_note:"",lot:"A"};
 expect(validReceiptBatches([lot,{...lot,qty:3,expiry:"2026-11-12",lot:"B"}],5)).toBe(true);
 for(const value of [[],[lot],[{...lot,qty:NaN}],[{...lot,qty:0}],[{...lot,expiry:"2026-02-30"}],[{...lot,expiry:null}]])expect(validReceiptBatches(value,5)).toBe(false);
 expect(validReceiptBatches([{...lot,expiry:null,expiry_note:"Packaging, no label date"}],2)).toBe(true);
 expect(validReceiptBatches([{...lot,qty:.1},{...lot,qty:.2}],.3)).toBe(true);
 expect(validReceiptBatches([],0)).toBe(true);expect(validReceiptBatches([lot],0)).toBe(false);
});
it("keeps unknown expiry separate from expired, today, soon and later",()=>{
 expect(batchFlag(null,"2026-11-03").flag).toBe("unknown");
 expect(batchFlag("2026-11-02","2026-11-03").flag).toBe("expired");
 expect(batchFlag("2026-11-03","2026-11-03").daysToExpiry).toBe(0);
 expect(batchFlag("2026-11-06","2026-11-03").flag).toBe("soon");
 expect(batchFlag("2026-11-07","2026-11-03").flag).toBe("ok");
});

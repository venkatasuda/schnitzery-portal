import {expect,it} from "vitest";
import {createHmac} from "node:crypto";
import {validPosDaily,verifyPosSignature} from "./pos-ingest";
it("requires bounded daily EUR totals and a fresh exact HMAC signature",()=>{
 const payload={format:"schnitzery-pos-daily-v1",external_id:"example",currency:"EUR",days:[{date:"2026-01-01",gross_sales:123.45}]};
 expect(validPosDaily(payload,"2026-01-02")).toBe(true);expect(validPosDaily({...payload,days:[...payload.days,...payload.days]},"2026-01-02")).toBe(false);
 expect(validPosDaily({...payload,currency:"USD"},"2026-01-02")).toBe(false);expect(validPosDaily(payload,"2025-12-31")).toBe(false);
 const timestamp="1793788800",body=JSON.stringify(payload),secret="synthetic-test-secret-longer-than-32-chars",now=Number(timestamp)*1000;
 const signature="sha256="+createHmac("sha256",secret).update(`${timestamp}.${body}`).digest("hex");
 expect(verifyPosSignature(body,timestamp,signature,secret,now)).toBe(true);
 expect(verifyPosSignature(body+" ",timestamp,signature,secret,now)).toBe(false);
 expect(verifyPosSignature(body,timestamp,signature,secret,now+301000)).toBe(false);
 expect(verifyPosSignature(body,timestamp,"sha256=xx",secret,now)).toBe(false);
});

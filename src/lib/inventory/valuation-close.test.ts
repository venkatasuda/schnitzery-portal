import {expect,it} from "vitest";
import {valuationCsv,type ValuationSnapshot} from "./valuation-close";
it("exports frozen evidence without spreadsheet formula injection or treating unknown costs as zero",()=>{
 const snapshot={lines:[{kind:"on_hand",product:'=SUM(1,2) "rice"',category:"Dry",unit:"kg",qty:2,net_unit_cost:null,value_net:null,batch_id:"batch",cost_review_id:null}]} as ValuationSnapshot;
 const csv=valuationCsv(snapshot);
 expect(csv).toContain('"\'=SUM(1,2) ""rice"""');
 expect(csv).toContain('"2","","","batch",""');
 expect(snapshot.lines[0].net_unit_cost).toBeNull();
});

// Codex review C/D (docs/ops/REVIEW-C-D.md): the eight reproduced bugs, now asserted
// as the SAFE behaviour. Converted from scripts/audit/review-c-d.cjs.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,require:n=>n.endsWith('coverage')?coverage:require(n),Date,Intl,Set,Map});return out;}
function harness(file,names){const source=fs.readFileSync(file,'utf8'),end=source.indexOf('(async () => {');assert(end>0);const box={module:{exports:{}},require,console,Date,Intl,Set,Map};vm.runInNewContext(source.slice(0,end)+'\nmodule.exports={'+names+'};',box);return box.module.exports;}
const coverage=load('src/lib/analytics/coverage.ts'),rec=load('src/lib/inventory/reconciliation.ts');
const count=(id,date,ist,unit='kg')=>({id,date,ist,unit});
(async()=>{
 // 4: opening count during transit → uncertain
 const transit=rec.reconcileIntervals([count('a','2026-10-02',14),count('b','2026-10-05',10)],[{kind:'incoming',date:'2026-10-01',until:'2026-10-04',qty:4,unit:'kg'},{kind:'received',date:'2026-10-04',qty:4,unit:'kg'}])[0];
 assert.equal(transit.status,'uncertain');assert.deepEqual([...transit.reasons],['in_transit']);
 // 5: invalid count in between → uncertain, not silently bridged
 const invalid=rec.reconcileIntervals([count('a','2026-10-01',10),count('invalid','2026-10-02',NaN),count('b','2026-10-03',5)],[])[0];
 assert.equal(invalid.status,'uncertain');assert.deepEqual([...invalid.reasons],['invalid']);
 // 3: different units on one day are not recounts
 const units=rec.reconcileIntervals([count('kg1','2026-10-01',100),count('bag1','2026-10-01',10,'bag'),count('kg2','2026-10-03',80),count('bag2','2026-10-03',8,'bag')],[]);
 assert.equal(units[0].status,'uncertain');assert.deepEqual([...units[0].reasons],['unit']);
 const inv=harness('scripts/checks/inventory-data.cjs','tables,exportsObject,count,master');
 const {tables,master}=inv;
 tables.inventory_master=[master('Oil','Dry'),master('Rice','Dry')];tables.inventory_counts=[inv.count('Oil','Dry','2026-10-08',10,'o1'),inv.count('Oil','Dry','2026-10-10',5,'o2'),inv.count('Rice','Dry','2026-10-09',100,'r1')];
 tables.inventory_purchases=[{...master('Oil','Dry'),purchase_date:'2026-09-20',qty:10,cost:20},{...master('Rice','Dry'),purchase_date:'2026-09-20',qty:100,cost:100}];
 tables.daily_sales=[{branch_id:'branch',sale_date:'2026-10-09',amount:100}];tables.attendance_logs=[{branch_id:'branch',work_date:'2026-10-09',duration_mins:60,status:'complete'}];
 // 1: a product with one count is missing from usage; no cost-of-goods %
 const missing=await inv.exportsObject.getInventoryAnalytics();
 assert.equal(missing.usageComplete,false);assert.equal(missing.cogsPct,null);assert.equal(missing.usageMissing.counts,1);
 // 2: no counts at all → stock value unknown, not a complete €0
 tables.inventory_counts=[];const noCounts=await inv.exportsObject.getInventoryAnalytics();
 assert.equal(noCounts.stockValue,null);assert.equal(noCounts.stockComplete,false);
 // 6: retained journal evidence of a deleted transfer → usage withheld
 tables.inventory_master=[master('Oil','Dry')];
 tables.inventory_counts=[inv.count('Oil','Dry','2026-10-08',10,'o1'),inv.count('Oil','Dry','2026-10-10',5,'o2')];
 tables.stock_transfers=[];tables.stock_events=[{source_table:'stock_transfers',branch_ids:['branch'],source_id:'deleted-transfer',operation:'UPDATE',before_status:'requested',after_status:'sent',recorded_at:'2026-10-09T10:00:00Z'}];
 const deleted=await inv.exportsObject.getInventoryAnalytics();
 assert.equal(deleted.usageComplete,false);assert.equal(deleted.totalUsageEur,null);
 tables.stock_events=[];
 // 9: future-dated records are not current actuals
 const business=harness('scripts/checks/business.cjs','tables,api');
 business.tables.attendance_logs=[{user_id:'manager',branch_id:'branch',work_date:'2026-10-11',duration_mins:60}];
 business.tables.daily_sales=[{branch_id:'branch',sale_date:'2026-10-11',amount:100},{branch_id:'branch',sale_date:'2026-10-20',amount:1000}];
 business.tables.inventory_purchases=[{branch_id:'branch',purchase_date:'2026-10-11',cost:30},{branch_id:'branch',purchase_date:'2026-10-20',cost:300}];
 const future=await business.api.getBranchAnalytics({period:'monthly',date:'2026-10-11'});
 assert.equal(future.metrics.totalSales,100);assert.equal(future.business.purchaseSpend,30);
 // 7: a change of status or movement breakdown makes a review stale
 const shown={used:10,expected:20,closing:10,status:'unusual',delivered:7,received:0,sent:0,wasted:0,opening:3,reasons:[]};
 assert.equal(rec.sameSnapshot({...shown,status:'gain',delivered:0,received:7},shown),false);
 assert.equal(rec.sameSnapshot(shown,{...shown}),true);
 // 10: CSV export carries completeness and the honest ratio name
 const csv=fs.readFileSync('src/app/(app)/summary/page.tsx','utf8');
 assert.ok(csv.includes('Wage confirmed')&&csv.includes('incomplete (lower bound)')&&csv.includes('Purchase spend / sales %')&&!csv.includes('"Food cost %"'));
 // 8 is covered by scripts/checks/stock-reconciliation.cjs (isolated Postgres) and stock-reconciliation-query.cjs.
 console.log('Review C/D: all ten findings hold as fixed (safe behaviour asserted).');
})().catch(e=>{console.error(e);process.exitCode=1;});

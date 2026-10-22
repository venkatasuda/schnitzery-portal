// Review-only executable reproductions. Does not call production or change app code.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
function load(file){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,require:n=>n.endsWith('coverage')?coverage:require(n),Date,Intl,Set,Map});return out;}
function harness(file,names){const source=fs.readFileSync(file,'utf8'),end=source.indexOf('(async () => {');assert(end>0);const box={module:{exports:{}},require,console,Date,Intl,Set,Map};vm.runInNewContext(source.slice(0,end)+'\nmodule.exports={'+names+'};',box);return box.module.exports;}
const coverage=load('src/lib/analytics/coverage.ts'),rec=load('src/lib/inventory/reconciliation.ts'),valuation=load('src/lib/inventory/valuation.ts');
const observed=[];function record(name,result){observed.push({name,result});console.log(name+': '+JSON.stringify(result));}
const count=(id,date,ist,unit='kg')=>({id,date,ist,unit});
(async()=>{
 const transit=rec.reconcileIntervals([count('a','2026-10-02',14),count('b','2026-10-05',10)],[{kind:'incoming',date:'2026-10-01',until:'2026-10-04',qty:4,unit:'kg'},{kind:'received',date:'2026-10-04',qty:4,unit:'kg'}])[0];
 assert.equal(transit.status,'ok');assert.equal(transit.used,8);record('opening_count_during_transit',{status:transit.status,used:transit.used,reasons:transit.reasons});
 const invalid=rec.reconcileIntervals([count('a','2026-10-01',10),count('invalid','2026-10-02',NaN),count('b','2026-10-03',5)],[])[0];
 assert.equal(invalid.status,'ok');record('invalid_count_silently_bridged',{status:invalid.status,from:invalid.from,to:invalid.to});
 const units=rec.reconcileIntervals([count('kg1','2026-10-01',100),count('bag1','2026-10-01',10,'bag'),count('kg2','2026-10-03',80),count('bag2','2026-10-03',8,'bag')],[]);
 assert.equal(units.length,1);assert.equal(units[0].status,'ok');assert.equal(units[0].used,2);record('different_units_treated_as_recounts',{intervals:units.length,used:units[0].used,status:units[0].status});
 const inv=harness('scripts/checks/inventory-data.cjs','tables,exportsObject,count,master');
 const {tables,master}=inv;
 tables.inventory_master=[master('Oil','Dry'),master('Rice','Dry')];tables.inventory_counts=[inv.count('Oil','Dry','2026-10-08',10,'o1'),inv.count('Oil','Dry','2026-10-10',5,'o2'),inv.count('Rice','Dry','2026-10-09',100,'r1')];
 tables.inventory_purchases=[{...master('Oil','Dry'),purchase_date:'2026-09-20',qty:10,cost:20},{...master('Rice','Dry'),purchase_date:'2026-09-20',qty:100,cost:100}];
 tables.daily_sales=[{branch_id:'branch',sale_date:'2026-10-09',amount:100}];tables.attendance_logs=[{branch_id:'branch',work_date:'2026-10-09',duration_mins:60,status:'complete'}];
 const missing=await inv.exportsObject.getInventoryAnalytics();assert.equal(missing.usageComplete,true);assert.equal(missing.cogsPct,10);record('one_count_product_missing_from_usage_coverage',{usageComplete:missing.usageComplete,cogsPct:missing.cogsPct,usage:missing.totalUsageEur});
 tables.inventory_counts=[];const noCounts=await inv.exportsObject.getInventoryAnalytics();assert.equal(noCounts.stockValue,0);assert.equal(noCounts.stockComplete,true);record('no_counts_stock_value',{value:noCounts.stockValue,complete:noCounts.stockComplete});
 // Current tables contain no transfer row, but retained evidence contains a sent leg.
 tables.inventory_counts=[inv.count('Oil','Dry','2026-10-08',10,'o1'),inv.count('Oil','Dry','2026-10-10',5,'o2')];
 tables.stock_transfers=[];tables.stock_events=[{source_id:'deleted-transfer',operation:'UPDATE',before_status:'requested',after_status:'sent',recorded_at:'2026-10-09T10:00:00Z'}];
 const deleted=await inv.exportsObject.getInventoryAnalytics();assert.equal(deleted.usageComplete,true);assert.equal(deleted.totalUsageEur,10);record('deleted_transfer_evidence_not_consulted',{usage:deleted.totalUsageEur,complete:deleted.usageComplete});
 const business=harness('scripts/checks/business.cjs','tables,api');
 business.tables.attendance_logs=[{user_id:'manager',branch_id:'branch',work_date:'2026-10-11',duration_mins:60}];
 business.tables.daily_sales=[{branch_id:'branch',sale_date:'2026-10-11',amount:100},{branch_id:'branch',sale_date:'2026-10-20',amount:1000}];
 business.tables.inventory_purchases=[{branch_id:'branch',purchase_date:'2026-10-11',cost:30},{branch_id:'branch',purchase_date:'2026-10-20',cost:300}];
 const future=await business.api.getBranchAnalytics({period:'monthly',date:'2026-10-11'});assert.equal(future.metrics.totalSales,1100);assert.equal(future.business.coverage.sales.complete,true);record('future_records_count_as_current_actuals',{today:'2026-10-11',sales:future.metrics.totalSales,spend:future.business.purchaseSpend,complete:future.business.coverage.sales.complete});
 const ui=fs.readFileSync('src/app/(app)/inventory/Reconciliation.tsx','utf8');const ast=ts.createSourceFile('r.tsx',ui,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const decl=ast.statements.find(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText()==='changedSince'));
 const box={exports:{}};vm.runInNewContext(ts.transpileModule(decl.getText()+'\nexports.changed=changedSince;',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,box);
 const changed=box.exports.changed({used:10,expected:20,closing:10,status:'unusual',delivered:7,received:0,sent:0,wasted:0,review:{figures:{used:10,expected:20,closing:10,status:'gain',delivered:0,received:7,sent:0,wasted:0}}});
 assert.equal(changed,false);record('review_hides_changed_status_and_movements',{changed});
 fs.writeFileSync('.audit-db/review-c-d/reproductions.json',JSON.stringify(observed,null,2));
 console.log('Reproduced '+observed.length+' incorrect outcomes against actual source. These are bug demonstrations, not correctness passes.');
})().catch(e=>{console.error(e);process.exitCode=1;});

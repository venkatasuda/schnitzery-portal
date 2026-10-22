// Release C: the reconciliation query is manager-only, branch-scoped, and a review
// stores figures recomputed on the server — never figures sent by the browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const load=(file,req)=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:req,Intl,Date,JSON,Number,Map,Object,String});return exports;};
const lib=load('src/lib/inventory/reconciliation.ts',()=>({}));
const readAll=load('src/lib/supabase/readAll.ts',()=>({}));
let role='manager';const calls=[],inserts=[];
const data={
  inventory_counts:[{id:'c1',product:'Oil',category:'Dry',unit:'l',count_date:'2026-10-01',ist:10},{id:'c2',product:'Oil',category:'Dry',unit:'l',count_date:'2026-10-05',ist:12}],
  inventory_purchases:[],waste_log:[],stock_transfers:[],stock_events:[],stock_reconciliation_reviews:[],
};
const chain=table=>{const q=new Proxy({}, {get:(_,k)=>{
  if(k==='then')return r=>r({data:data[table],error:null});
  if(k==='range')return async()=>({data:data[table],error:null});
  if(k==='insert')return async row=>{inserts.push([table,row]);return{error:null};};
  if(k==='maybeSingle')return async()=>({data:table==='branches'&&calls.some(c=>c[0]==='branches'&&c[1]==='eq'&&c[3]==='hq-visible')?{id:'hq-visible'}:null,error:null});
  return (...a)=>{calls.push([table,k,...a]);return q;};}});return q;};
const db={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from:t=>t==='users'?{select:()=>({eq:()=>({single:async()=>({data:{role,branch_id:'own'}})})})}:chain(t)};
const q=load('src/lib/queries/reconciliation.ts',n=>n.endsWith('/readAll')?readAll:n.endsWith('/server')?{createClient:async()=>db}:n.endsWith('berlinDate')?{berlinToday:()=>'2026-10-21'}:n.endsWith('inventory/reconciliation')?lib:(()=>{throw Error(n);})());
(async()=>{
  for(const d of [0,6,181,1.5,NaN])assert.equal((await q.getReconciliation(d)).ok,false);
  assert.equal(calls.length,0,'Invalid periods fail before database access');
  role='staff';assert.equal((await q.getReconciliation()).ok,false);assert.equal(calls.length,0,'Staff never read stock data');
  role='manager';const r=await q.getReconciliation(90);
  assert.equal(r.ok,true);assert.equal(r.rows.length,1);assert.equal(r.rows[0].status,'gain');
  for(const t of ['inventory_counts','inventory_purchases','waste_log','stock_reconciliation_reviews'])assert.ok(calls.some(c=>c[0]===t&&c[1]==='eq'&&c[2]==='branch_id'&&c[3]==='own'),`${t} scoped to own branch`);
  assert.equal((await q.addReconciliationReview('c1','c2','x')).code,'noteLength');
  assert.equal((await q.addReconciliationReview('c1','zz','Delivery missing')).code,'changed','Unknown interval is refused');
  assert.equal(inserts.length,0);
  assert.equal((await q.addReconciliationReview('c1','c2','  Delivery 03.10 missing  ')).ok,true);
  const [table,row]=inserts[0];
  assert.equal(table,'stock_reconciliation_reviews');assert.equal(row.branch_id,'own');assert.equal(row.note,'Delivery 03.10 missing');
  assert.deepEqual({...row.figures},{opening:10,delivered:0,received:0,sent:0,wasted:0,closing:12,expected:10,used:-2,status:'gain',reasons:row.figures.reasons});
  assert.equal(row.reviewed_by,undefined,'Reviewer comes from the database session, not the client');
  // HQ branch picker: only owners may pick, and only a branch RLS lets them read.
  calls.length=0;assert.equal((await q.getReconciliation(90,'hq-visible')).ok,false,'A manager cannot pick another branch');
  assert.ok(!calls.some(c=>c[0]==='inventory_counts'));
  role='brand_owner';
  assert.equal((await q.getReconciliation(90,'hidden')).error,'Branch access denied.');
  const hq=await q.getReconciliation(90,'hq-visible');assert.equal(hq.ok,true);assert.equal(hq.branch,'hq-visible');
  assert.ok(calls.some(c=>c[0]==='inventory_counts'&&c[1]==='eq'&&c[3]==='hq-visible'));
  console.log('Stock reconciliation query: manager-only, own branch, HQ picker bounded by RLS, server-computed review figures.');
})().catch(e=>{console.error(e);process.exitCode=1;});

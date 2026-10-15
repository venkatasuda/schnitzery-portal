const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,resolve){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:resolve});return exports;}
(async()=>{
  let role='manager',loggedIn=true,dbError=false;const calls=[];
  const events=Array.from({length:101},(_,i)=>({id:200-i}));
  const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data:dbError?null:events,error:dbError?{}:null}):(...args)=>{calls.push([key,...args]);return chain;}});
  const query=load('src/lib/queries/stock-history.ts',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:loggedIn?{id:'manager'}:null}})},from:table=>{calls.push(['from',table]);return table==='users'?{select:()=>({eq:()=>({single:async()=>({data:{role,branch_id:'own-branch'}})})})}:chain;}})})).getStockHistory;
  for(const args of [['fake'],['all',-1],['all',NaN],['all',1.5]])assert.equal((await query(...args)).ok,false);
  assert.equal(calls.length,0,'Invalid filters fail before database access');
  role='staff';assert.equal((await query()).ok,false);assert.ok(!calls.some(c=>c[1]==='stock_events'));
  role='manager';let result=await query('waste_log',150);assert.equal(result.rows.length,100);assert.equal(result.next,101);
  assert.ok(calls.some(c=>c[0]==='contains'&&c[1]==='branch_ids'&&c[2][0]==='own-branch'));
  assert.ok(calls.some(c=>c[0]==='lt'&&c[1]==='id'&&c[2]===150));
  dbError=true;assert.equal((await query()).ok,false);loggedIn=false;assert.equal((await query()).ok,false);
  for(const response of [{ok:false},new Error('Disconnected'),{ok:true,rows:[],next:undefined},{ok:true,rows:[{id:1,source_table:'waste_log',source_id:'source',operation:'DELETE',before_row:{product:'<script>bad</script>',qty:4},after_row:null,actor_id:'actor',recorded_at:'2026-10-15T10:00:00Z'}]}]){
    const states=[],effects=[];let cursor=0,initial=true;
    const hooks={...React,useState(v){const i=cursor++;if(initial)states[i]=v;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useEffect(fn){if(initial)effects.push(fn);}};
    const component=load('src/app/(app)/inventory/StockHistory.tsx',name=>{
      if(name==='react')return hooks;
      if(name.includes('LanguageProvider'))return{useLang:()=>({t:k=>k,locale:'en'})};
      if(name.includes('stock-history'))return{getStockHistory:async()=>{if(response instanceof Error)throw response;return response;}};
      return require(name);
    }).default;
    component();effects.forEach(fn=>fn());await new Promise(r=>setImmediate(r));initial=false;cursor=0;
    const html=renderToStaticMarkup(component());
    if(!response.ok)assert.match(html,/role="alert"/);
    else if(response.rows.length===0)assert.match(html,/stockHistory.empty/);
    else{assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);assert.match(html,/4 → —/);assert.match(html,/stockHistory.DELETE/);assert.doesNotMatch(html,/<script>/);}
  }
  console.log('History branch/role/filter boundaries, keyset pagination, network recovery, empty/deleted rows and escaping pass.');
})().catch(e=>{console.error(e);process.exitCode=1});

// Synthetic-only checks of the real order query, money helper and React screen.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function mod(source,require){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,console});return exports;}
const coverage=mod(fs.readFileSync('src/lib/analytics/coverage.ts','utf8'),require);
const money=mod(fs.readFileSync('src/lib/inventory/orderDraft.ts','utf8'),()=>coverage);
const key=row=>JSON.stringify([row.category,row.product,row.unit]);
const source=fs.readFileSync('src/lib/queries/inventory.ts','utf8');
const ast=ts.createSourceFile('inventory.ts',source,ts.ScriptTarget.Latest,true);
const query=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='getPurchaseOrderDraft').getText(ast);
let endDate,fail=false;
const rows=[{product:'Oil',category:'Dry',unit:'L',qty:10,cost:20,purchase_date:'2026-10-10',supplier:'A'},
 {product:'Rice',category:'Dry',unit:'kg',qty:10,cost:null,purchase_date:'2026-10-10'},
 {product:'Free',category:'Dry',unit:'kg',qty:2,cost:0,purchase_date:'2026-10-10'},
 {product:'Small',category:'Dry',unit:'kg',qty:100,cost:.5,purchase_date:'2026-10-10'},
 {product:'Oil',category:'Dry',unit:'L',qty:10,cost:1,purchase_date:'2026-12-01'}];
const db={from(){return this;},select(){return this;},eq(_key,value){assert.equal(value,'branch-a');return this;},lte(_key,date){endDate=date;return this;},order(){return this;}};
const queryExports={};
vm.runInNewContext(ts.transpileModule(query,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports:queryExports,
 getDepletionForecast:async()=>({ok:true,items:rows.slice(0,4).map((row,i)=>({...row,suggested:[5,2,1,100][i]}))}),
 getMe:async()=>({supabase:db,user:{id:'manager'},branchId:'branch-a'}),todayStr:()=> '2026-10-23',inventoryKey:key,
 readAll:async()=>fail?{data:null,error:{message:'Unavailable'}}:{data:rows.filter(row=>row.purchase_date<=endDate)},latestPrice:coverage.latestPrice,...money});
const fixture={ok:true,groups:[{supplier:'A',items:[{product:'Known',category:'Dry',unit:'kg',qty:2,unitPrice:10},{product:'Unknown',category:'Dry',unit:'kg',qty:3,unitPrice:null}]}]};
const harness=fs.readFileSync('scripts/checks/workspace-ux.cjs','utf8').split('(async()=>{')[0];
const box={module:{exports:{}},require,console,setImmediate,setTimeout,URL,URLSearchParams};vm.runInNewContext(harness+'\nmodule.exports={ui,find};',box);
const {ui,find}=box.module.exports,flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const result=await queryExports.getPurchaseOrderDraft();
 const items=result.groups.flatMap(g=>g.items);
 assert.equal(items.find(i=>i.product==='Rice').unitPrice,null,'Missing price never becomes free');
 assert.equal(items.find(i=>i.product==='Free').unitPrice,0,'Explicit free item remains valid');
 assert.equal(items.find(i=>i.product==='Oil').unitPrice,2,'Future purchase is excluded');
 assert.equal(items.find(i=>i.product==='Small').lineCost,.5,'Do not round fractional unit prices before multiplication');
 assert.equal(result.total,10.5);assert.equal(result.complete,false);assert.equal(result.missingPrices,1);
 fail=true;assert.equal((await queryExports.getPurchaseOrderDraft()).ok,false);
 assert.equal(money.orderSummary([{qty:0,unitPrice:null}]).missingPrices,0,'Excluded line does not spoil selected total');
 assert.equal(money.orderSummary([{qty:'',unitPrice:1}]).invalidQuantities,1);
 assert.equal(money.orderSummary([{qty:-1,unitPrice:1}]).complete,false);
 const screen=await ui('inventory/order',fixture);
 assert.match(screen.render(),/orderDraft.knownAmount.*≥/);assert.match(screen.render(),/orderDraft.missingPrices/);
 assert.doesNotMatch(screen.render(),/po.nothing/);
 find(screen.tree(),e=>e.type==='input').props.onChange({target:{value:'-1'}});
 assert.match(screen.render(),/aria-invalid="true"/);assert.match(screen.render(),/orderDraft.invalidQuantities/);
 assert.equal(find(screen.tree(),e=>e.type==='button'&&e.props.onClick?.name==='print').props.disabled,true);
 for(const error of [()=>({ok:false,error:'Unavailable'}),()=>{throw new Error('Disconnected');}]){
  const broken=await ui('inventory/order',error);assert.match(broken.render(),/role="alert"/);assert.doesNotMatch(broken.render(),/orderDraft.empty|po.nothing/);
 }
 let calls=0,old,newer;
 const race=await ui('inventory/order',()=>++calls===1?{ok:false}:new Promise(resolve=>{if(calls===2)old=resolve;else newer=resolve;}));
 const retry=find(race.tree(),e=>typeof e.props?.onRetry==='function').props.onRetry;
 retry();retry();
 newer({...fixture,groups:[{supplier:'Newest',items:fixture.groups[0].items}]});await flush();
 old({...fixture,groups:[{supplier:'Oldest',items:fixture.groups[0].items}]});await flush();
 assert.match(race.render(),/Newest/);assert.doesNotMatch(race.render(),/Oldest/);
 const inventoryData={ok:true,products:[{id:'known',product:'Known',category:'Dry',unit:'kg',soll:1},{id:'unknown',product:'Unknown',category:'Dry',unit:'kg',soll:1}],counts:[{product:'Known',category:'Dry',unit:'kg',ist:2}],lowStock:[]};
 const overview=await ui('inventory',inventoryData,'http://schnitzery.localhost/inventory?view=overview');
 assert.match(overview.render(),/inventoryWorkspace.countProgress/);assert.match(overview.render(),/1 \/ 2/);assert.doesNotMatch(overview.render(),/<form/);
 assert.equal((overview.render().match(/aria-current="page"/g)||[]).length,1,'One selected inventory area');
 const filtered=await ui('inventory',inventoryData,'http://schnitzery.localhost/inventory?view=count&category=Dry&q=Known&status=good');
 assert.match(filtered.render(),/inventoryWorkspace.countedQuantity/);assert.match(filtered.render(),/>Known</);assert.doesNotMatch(filtered.render(),/>Unknown</);
 const invalidCountData={...inventoryData,counts:[...inventoryData.counts,{product:'Unknown',category:'Dry',unit:'kg',ist:null}]};
 const invalidCounts=await ui('inventory',invalidCountData,'http://schnitzery.localhost/inventory?view=overview');
 assert.match(invalidCounts.render(),/1 \/ 2/,'A null legacy count must remain unknown');
 const drilldown=await ui('inventory',inventoryData,'http://schnitzery.localhost/inventory?view=overview&category=Missing&q=Hidden');
 find(drilldown.tree(),e=>e.type==='button'&&JSON.stringify(e.props.children).includes('inventoryWorkspace.needsCount')).props.onClick();
 await flush();
 assert.match(drilldown.render(),/>Unknown</,'Count coverage drill-down must clear unrelated filters');
 assert.doesNotMatch(drilldown.render(),/>Known</);
 console.log('Inventory overview, count drill-down and order drafts: pricing, invalid data, persistent errors and stale responses pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});

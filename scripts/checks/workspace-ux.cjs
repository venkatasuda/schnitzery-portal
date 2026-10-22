const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function moduleAt(file, resolve) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { exports, require: resolve, URL, setTimeout, console });
  return exports;
}
async function ui(page, result) {
  const states=[], effects=[]; let cursor=0, initial=true;
  const hooks={...React,useState(value){const i=cursor++; if(initial) states[i]=value; return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useEffect(fn){if(initial)effects.push(fn);},useRef(value){return {current:value};}};
  const component=moduleAt(`src/app/(app)/${page}/page.tsx`, name=>{
    if(name==='react')return hooks;
    if(name==='@/lib/time/berlinDate')return {berlinToday:()=> '2026-10-13'};
    if(name.startsWith('@/lib/queries/'))return new Proxy({}, {get:()=>async()=>{if(result instanceof Error)throw result; return result;}});
    if(name==='@/components/LanguageProvider')return {useLang:()=>({t:k=>k})};
    if(name==='next/link')return {__esModule:true,default:({href,children,...rest})=>React.createElement('a',{href,...rest},children)};
    if(name==='@/components/Toast')return {toast(){}};
    if(name.startsWith('@/components/'))return {__esModule:true,default:()=>null,CardSkeleton:()=>null,Skeleton:()=>null};
    return require(name);
  }).default;
  component(); for(const effect of effects) effect(); await new Promise(r=>setImmediate(r)); initial=false;
  return {render(){cursor=0;return renderToStaticMarkup(component());},tree(){cursor=0;return component();}};
}
function find(tree,test){if(!tree||typeof tree!=='object')return null; if(test(tree))return tree; for(const child of React.Children.toArray(tree.props?.children)){const found=find(child,test);if(found)return found;}return null;}
(async()=>{
  for(const page of ['staff','settings','profile','labor','attendance-hub']){
    for(const fail of [{ok:false,error:'Database unavailable'},new Error('Disconnected')]){
      const rendered=(await ui(page,fail)).render();
      assert.match(rendered,/role="alert"/); assert.match(rendered,/business.retry/);
      assert.doesNotMatch(rendered,/staff.noActive|set.save|type="checkbox"/);
    }
  }
  const labor=(await ui('labor',{ok:true,laborCost:25,monthSales:0,recordedSalesDays:0,missingWageStaff:1,staff:[],sales:[]})).render();
  assert.match(labor,/lab.missingWageCost/); assert.match(labor,/lab.wageBasis/);
  assert.doesNotMatch(labor,/€25|€0/); assert.match(labor,/aria-label="lab.date"/); assert.match(labor,/aria-label="lab.revenue"/);
  const staff=await ui('staff',{ok:true,staff:[{id:'a',full_name:'Anna',employee_code:'STG-001',team:'Kitchen',status:'active'},{id:'b',full_name:'Ben',employee_code:'STG-002',team:'Cashier',status:'active'}]});
  assert.match(staff.render(),/aria-pressed="true"/);
  find(staff.tree(),e=>e.type==='input'&&e.props.type==='search').props.onChange({target:{value:'STG-002'}});
  assert.match(staff.render(),/Ben/); assert.doesNotMatch(staff.render(),/Anna/);
  find(staff.tree(),e=>e.type==='input'&&e.props.type==='search').props.onChange({target:{value:'nothing'}});
  assert.match(staff.render(),/staff.noMatches/); assert.doesNotMatch(staff.render(),/staff.noActive/);
  find(staff.tree(),e=>e.type==='button'&&e.props.children==='staff.addNew').props.onClick();
  const dialog=find(staff.tree(),e=>e.type==='dialog');assert.equal(dialog.props['aria-labelledby'],'add-staff-title');assert.equal(typeof dialog.props.onCancel,'function');
  assert.ok(find(dialog,e=>e.type==='input'&&e.props.type==='password'));
  let role='staff', error=null, branch='branch-a', writes=0, reads=0;
  const client={auth:{getUser:async()=>({data:{user:{id:'caller'}}})},from(table){
    const q={select:()=>q,eq:()=>q,single:async()=>({data:{role,branch_id:branch}}),maybeSingle:async()=>{reads++;return {data:null,error};},upsert:async input=>{writes++;assert.equal(input.branch_id,branch);return {error:null};},insert:async()=>({error:null})};return q;
  }};
  const admin=moduleAt('src/lib/queries/admin.ts',name=>name==='@/lib/supabase/server'?{createClient:async()=>client}:{});
  assert.equal((await admin.getBranchSettings()).ok,false);assert.equal((await admin.saveBranchSettings(false,'off')).ok,false);assert.equal(reads+writes,0);
  for(role of ['manager','branch_owner','brand_owner','super_admin']){
    error={message:'Database unavailable'};assert.equal((await admin.getBranchSettings()).ok,false);
    error=null;assert.equal((await admin.getBranchSettings()).settings.gps_mode,'off');
    assert.equal((await admin.saveBranchSettings('false','off')).ok,false);assert.equal((await admin.saveBranchSettings(true,'invalid')).ok,false);
    assert.equal((await admin.saveBranchSettings(true,'required')).ok,true);
  }
  assert.equal(writes,4);branch=null;assert.equal((await admin.getBranchSettings()).ok,false);assert.equal((await admin.saveBranchSettings(true,'required')).ok,false);assert.equal(writes,4);
  const laborClient={auth:{getUser:async()=>({data:{user:{id:'caller'}}})},from(table){const q={table,count:1,select:()=>q,eq:()=>q,gte:()=>q,lt:()=>q,lte:()=>q,order:()=>q,single:async()=>({data:{role:'manager',branch_id:'branch-a'}})};return q;}};
  const calc=moduleAt('src/lib/pay/calculations.ts',require);
  const laborQueries=moduleAt('src/lib/queries/labor.ts',name=>({
    '@/lib/supabase/server':{createClient:async()=>laborClient},
    '@/lib/time/berlinDate':{berlinToday:()=> '2026-10-17',monthRange:()=>({from:'2026-10-01',next:'2026-11-01'})},
    '@/lib/pay/calculations':calc,
    '@/lib/pay/wages':{wageMapForBranches:async()=>({a:0})},
    '@/lib/analytics/coverage':moduleAt('src/lib/analytics/coverage.ts',()=>({})),
    '@/lib/supabase/readAll':{readAll:async q=>({data:q.table==='attendance_logs'?[{user_id:'a',clock_in:'2026-10-01T08:00:00Z',clock_out:'2026-10-01T09:00:00Z'}]:[],error:null})},
  })[name]);
  const zeroRate=await laborQueries.getLaborSummary();
  assert.equal(zeroRate.ok,true);assert.equal(zeroRate.withWage,1);assert.equal(zeroRate.missingWageStaff,0);assert.equal(zeroRate.recordedSalesDays,0);assert.equal(zeroRate.laborPct,null,'No sales: no ratio');assert.equal(zeroRate.coverage.labor.complete,true,'A confirmed €0 wage is complete');
  // Release D: monthly summary never prices an employee without a confirmed wage at €0.
  const noWage=moduleAt('src/lib/queries/labor.ts',name=>({
    '@/lib/supabase/server':{createClient:async()=>laborClient},
    '@/lib/time/berlinDate':{berlinToday:()=> '2026-10-17',monthRange:()=>({ym:'2026-10',from:'2026-10-01',to:'2026-10-31',next:'2026-11-01'})},
    '@/lib/pay/calculations':calc,
    '@/lib/pay/wages':{wageMapForBranches:async()=>({})},
    '@/lib/analytics/coverage':moduleAt('src/lib/analytics/coverage.ts',()=>({})),
    '@/lib/supabase/readAll':{readAll:async q=>({data:q.table==='attendance_logs'?[{user_id:'a',work_date:'2026-10-01',clock_in:'2026-10-01T08:00:00Z',clock_out:'2026-10-01T09:00:00Z'}]:q.table==='daily_sales'?[{amount:100,sale_date:'2026-10-01'}]:q.table==='users'?[{id:'a',full_name:'A'}]:[],error:null})},
  })[name]);
  const month=await noWage.getMonthlySummary();
  assert.equal(month.ok,true);assert.equal(month.complete,false);assert.equal(month.laborPct,null);assert.equal(month.rows[0].laborCost,null);assert.equal(month.coverage.labor.missing.wages,1);
  console.log('Workspace failure/search/dialog checks, labour coverage and role/input boundaries pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});

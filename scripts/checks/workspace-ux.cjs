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
  const hooks={...React,useState(value){const i=cursor++; if(initial) states[i]=value; return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useEffect(fn){if(initial)effects.push(fn);},useRef(){return {current:null};}};
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
  for(const page of ['staff','settings','profile','labor']){
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
  console.log('Staff search/dialog, recoverable page failures, settings role/input/branch boundaries pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function moduleAt(file, resolve, url = 'http://schnitzery.localhost:3100/inventory?view=count') {
  const exports = {};
  const location = new URL(url);
  const window = { location, addEventListener(){}, removeEventListener(){}, history:{replaceState(_state,_title,url){location.href=String(url);},pushState(_state,_title,url){location.href=String(url);}} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { exports, require: resolve, URL, URLSearchParams, window, crypto:require('node:crypto').webcrypto, setTimeout, console });
  return exports;
}
async function ui(page, result, url) {
  const states=[], effects=[]; let cursor=0, initial=true;
  const hooks={...React,useState(value){const i=cursor++; if(initial) states[i]=value; return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useEffect(fn){if(initial)effects.push(fn);},useRef(value){const i=cursor++;if(initial)states[i]={current:value};return states[i];}};
  const component=moduleAt(`src/app/(app)/${page}/page.tsx`, function resolve(name){
    if(name==='react')return hooks;
    if(name==='recharts')return new Proxy({}, {get:()=>()=>null});
    if(name==='@/lib/time/berlinDate')return {...moduleAt('src/lib/time/berlinDate.ts',require),berlinToday:()=> '2026-10-13'};
    if(name.startsWith('@/lib/queries/'))return new Proxy({}, {get:(_target,key)=>async(...args)=>{if(result instanceof Error)throw result;if(key==='getInventoryContext')return {ok:true,branch:{id:'branch',name:'Test branch'},countDate:'2026-10-13'}; return typeof result==='function'?result(key,args):result;}});
    if(name==='@/lib/inventory/identity')return moduleAt('src/lib/inventory/identity.ts',require);
    if(name==='@/lib/format')return moduleAt('src/lib/format.ts',require);
    if(name==='@/lib/format')return moduleAt('src/lib/format.ts',require);
    if(name==='@/lib/inventory/orderDraft')return moduleAt('src/lib/inventory/orderDraft.ts',()=>moduleAt('src/lib/analytics/coverage.ts',require));
    if(name==='@/components/InventoryNav')return moduleAt('src/components/InventoryNav.tsx',resolve);
    if(name.startsWith('./'))return {__esModule:true,default:()=>null};
    if(name==='@/components/LanguageProvider')return {useLang:()=>({t:k=>k})};
    if(name==='next/link')return {__esModule:true,default:({href,children,...rest})=>React.createElement('a',{href,...rest},children)};
    if(name==='@/lib/i18n/serverMessages')return{serverText:m=>m};if(name==='@/components/Toast')return {toast(){}};
    if(name==='@/components/ui')return moduleAt('src/components/ui.tsx',require); // real kit, not a stub
    if(name.startsWith('@/components/'))return {__esModule:true,default:()=>null,CardSkeleton:()=>null,Skeleton:()=>null};
    return require(name);
  },url).default;
  component(); for(const effect of effects) effect(); await new Promise(r=>setImmediate(r)); initial=false;
  return {render(){cursor=0;return renderToStaticMarkup(component());},tree(){cursor=0;return component();}};
}
function find(tree,test){if(!tree||typeof tree!=='object')return null; if(test(tree))return tree; for(const child of React.Children.toArray(tree.props?.children)){const found=find(child,test);if(found)return found;}return null;}
(async()=>{
  // Escape must respect the owner's discard confirmation instead of closing natively.
  const NativeDialog=moduleAt('src/components/NativeDialog.tsx',name=>name==='react'?{...React,useRef:()=>({current:null}),useEffect(){}}:require(name)).default;
  let cancelled=false,closeCalls=0;
  NativeDialog({title:'Draft',onClose:()=>closeCalls++,children:null}).props.onCancel({preventDefault(){cancelled=true;}});
  assert.equal(cancelled,true);assert.equal(closeCalls,1);
  NativeDialog({title:'Draft',busy:true,onClose:()=>closeCalls++,children:null}).props.onCancel({preventDefault(){}});
  assert.equal(closeCalls,1,'Busy dialogs cannot be dismissed with Escape');
  const Nav=moduleAt('src/components/ManagementNav.tsx',name=>name==='next/navigation'?{usePathname:()=>'/inventory'}:name==='next/link'?{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}:name==='@/components/LanguageProvider'?{useLang:()=>({t:key=>key})}:require(name)).default;
  assert.match(renderToStaticMarkup(Nav({role:'manager'})),/management-sidebar/);
  const mobile=Nav({role:'manager',mobile:true});
  assert.match(renderToStaticMarkup(mobile),/popoverTarget="management-menu"/i);
  const menu=find(mobile,e=>e.props?.id==='management-menu');assert.equal(menu.props.popover,'auto');
  let hidden=false;menu.props.onClick({target:{closest:()=>({})},currentTarget:{hidePopover(){hidden=true;}}});assert.equal(hidden,true,'Navigation closes the mobile menu');
  // Exercise the actual count form, including keyboard submit and failed-save retry.
  let attempts=0;
  const product={id:'oil',product:'Oil',category:'Dry goods',unit:'L',soll:10};
  const inventory=await ui('inventory',(name,args)=>{
    if(name==='saveCount') { attempts++; assert.equal(args[2],7); if(attempts===1)throw Error('Disconnected'); return {ok:true}; }
    return {ok:true,products:[product],counts:[{...product,ist:5}],lowStock:[]};
  });
  assert.match(inventory.render(),/Oil/);
  const zeroTarget=await ui('inventory',{ok:true,products:[{...product,soll:0}],counts:[{...product,soll:0,ist:0}],lowStock:[]});
  const gridToggle=find(zeroTarget.tree(),e=>e.type==='button'&&e.props.children==='inv.viewGrid');
  assert.ok(gridToggle,'Grid control is available');gridToggle.props.onClick();
  assert.match(zeroTarget.render(),/inv-tile green/,'Zero stock meets a zero target in grid and list');
  find(inventory.tree(),e=>e.type==='input'&&e.props.type==='number').props.onChange({target:{value:'7'}});
  assert.equal(find(inventory.tree(),e=>e.type==='input'&&e.props.type==='number').props.value,'7');
  assert.equal(find(inventory.tree(),e=>e.type==='button'&&e.props.type==='submit').props.disabled,false);
  let prevented=false;
  find(inventory.tree(),e=>e.type==='form').props.onSubmit({preventDefault(){prevented=true;}});
  await new Promise(r=>setImmediate(r));
  assert.equal(prevented,true); assert.equal(attempts,1);
  assert.equal(find(inventory.tree(),e=>e.type==='input'&&e.props.type==='number').props.value,'7','Failed save retains the count');
  assert.equal(find(inventory.tree(),e=>e.type==='button'&&e.props.type==='submit').props.disabled,false,'Failed save releases busy state');
  find(inventory.tree(),e=>e.type==='form').props.onSubmit({preventDefault(){}});
  await new Promise(r=>setImmediate(r));
  assert.equal(attempts,2);
  assert.equal(find(inventory.tree(),e=>e.type==='input'&&e.props.type==='number').props.value,'','Successful retry clears the saved input');
  for(const page of ['inventory','staff','settings','profile','labor','attendance-hub']){
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
  const admin=moduleAt('src/lib/queries/admin.ts',name=>name==='@/lib/supabase/server'?{createClient:async()=>client}:name==='@/lib/activeBranch'?{activeBranchFor:async(_db,p)=>p?.branch_id??null}:{});
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
    '@/lib/activeBranch':{activeBranchFor:async(_db,p)=>p?.branch_id??null},
    '@/lib/auth/rank':{rankOf:r=>({super_admin:5,brand_owner:4,branch_owner:3,manager:2,staff:1})[r]||0},
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
    '@/lib/activeBranch':{activeBranchFor:async(_db,p)=>p?.branch_id??null},
    '@/lib/auth/rank':{rankOf:r=>({super_admin:5,brand_owner:4,branch_owner:3,manager:2,staff:1})[r]||0},
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

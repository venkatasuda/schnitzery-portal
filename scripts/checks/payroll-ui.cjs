const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const ui={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ui.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:ui,require});
async function render(result,report=false){
  let reportHtml='';
  const states=[],effects=[];let cursor=0,initial=true;
  const hooks={...React,useState(value){const i=cursor++;if(initial)states[i]=typeof value==='function'?value():value;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},
    useRef(value){const i=cursor++;if(initial)states[i]={current:value};return states[i];},useCallback:fn=>fn,useEffect(fn){if(initial)effects.push(fn);}};
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/(app)/export/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
    {exports,Date,setTimeout(){},window:{open:()=>({document:{write:html=>{reportHtml=html;},close(){}},focus(){},print(){}})},require(name){if(name==='react')return hooks;if(name==='@/lib/time/berlinDate')return{berlinMonth:()=> report?'2026-09<script>alert(1)</script>':'2026-09'};
      if(name==='@/lib/queries/payroll')return{getPayrollSummary:async()=>result};
      if(name==='@/components/LanguageProvider')return{useLang:()=>({t:key=>key})};
      if(name==='@/lib/i18n/serverMessages')return{serverText:m=>m};if(name==='@/components/Toast')return{toast(){}};if(name==='@/components/Skeleton')return{CardSkeleton:()=>null};
      if(name==='@/components/ui')return ui;if(name==='@/components/Icon')return{__esModule:true,default:()=>null};
      if(name==='next/link')return{__esModule:true,default:props=>React.createElement('a',props)};return require(name);}});
  exports.default();for(const effect of effects)effect();await new Promise(resolve=>setImmediate(resolve));initial=false;cursor=0;
  const tree=exports.default();
  if(report){
    function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node?.props)return;if(node.type==='button'&&node.props.children==='pay.exportReport')node.props.onClick();visit(node.props.children);}
    visit(tree);return reportHtml;
  }
  return renderToStaticMarkup(tree);
}
(async()=>{
  let html=await render({ok:false,error:'Database unavailable'});assert.match(html,/role="alert"/);assert.match(html,/Database unavailable/);assert.doesNotMatch(html,/pay.noHours/);
  const result={ok:true,history:[],revision:'a'.repeat(32),rows:[{userId:'one',name:'Test employee',team:'Kitchen',paidH:1,gross:null,wage:null}],totals:{paidH:1,gross:null},settings:{otDailyHours:8,nightStart:'22:00',nightEnd:'06:00'},
    readiness:{canApprove:false,unapprovedShifts:1,missingWages:1,invalidShifts:0,monthClosed:true},run:{status:'draft',frozen:false}};
  html=await render(result);assert.match(html,/<table class="data-table"/);assert.match(html,/scope="row"/);assert.match(html,/pay.reviewShifts/);assert.match(html,/pay.missingRates/);assert.match(html,/<button[^>]*disabled=""[^>]*>pay.approveBtn/);
  result.run={status:'approved',frozen:true};html=await render(result);assert.match(html,/pay.frozen/);assert.doesNotMatch(html,/pay.approveBtn/);
  result.run.frozen=false;html=await render(result);assert.match(html,/pay.legacy/);
  result.rows[0].name='<script>alert(2)</script>';
  html=await render(result,true);assert.doesNotMatch(html,/<script>/);assert.match(html,/2026-09&lt;script&gt;/);assert.match(html,/&lt;script&gt;alert\(2\)/);
  console.log('Payroll UI displays read errors, structured employee table, approval blockers and frozen/legacy history labels.');
})().catch(error=>{console.error(error);process.exitCode=1;});

const assert = require('node:assert/strict');
const AB={activeBranchFor:async(_db,p)=>p?.branch_id??null,accessibleBranchIds:async()=>[]}; // multi-branch resolver stub: home branch
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    {exports,Date,Intl,Set,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only'}},require:name => imports[name]});
  return exports;
}
const revision='a'.repeat(32);
const source = { logs:[{id:'log',user_id:'employee',work_date:'2026-09-10',clock_in:'2026-09-10T08:00Z',clock_out:'2026-09-10T08:15Z',duration_mins:15,breaks:[],approval_status:'pending'}],
  staff:[{id:'employee',full_name:'Test',team:'Kitchen'}], wageBasis:'effective-dated',wages:[{user_id:'employee',work_date:'2026-09-10',hourly_wage:20}],settings:{otDailyHours:8,nightStart:'22:00',nightEnd:'06:00'} };
let run={status:'draft'}, stored, inputError, rpcCalls=0, approvalCalls=0;
const client={auth:{getUser:async()=>({data:{user:{id:'manager'}}})},from(table){
  const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:[]}),single:async()=>({data:table==='users'?{role:'manager',branch_id:'branch'}:{snapshot:stored,approved_name:'Manager'}}),maybeSingle:async()=>({data:run})};return q;
},rpc:async()=>{rpcCalls++;return{data:{source,revision},error:inputError}}};
const api=load('src/lib/queries/payroll.ts',{
  '@/lib/supabase/server':{createClient:async()=>client},
  '@/lib/activeBranch':AB,
  '@supabase/supabase-js':{createClient:()=>({rpc:async(name,args)=>{approvalCalls++;assert.equal(args.p_actor,'manager');assert.equal(args.p_snapshot.totals.gross,5);return{};}})},
  '@/lib/time/berlinDate':{berlinMonth:()=> '2026-10',monthRange:()=>({from:'2026-09-01',next:'2026-10-01'})},
  '@/lib/pay/calculations':load('src/lib/pay/calculations.ts'),
});
(async()=>{
  let result=await api.getPayrollSummary('2026-09');
  assert.equal(result.rows[0].gross,5);assert.equal(result.rows[0].paidH,0.3);
  assert.equal(result.readiness.unapprovedShifts,1);assert.equal(result.readiness.canApprove,false);
  assert.equal((await api.setPayrollApproval('2026-09',true,undefined,revision)).ok,false);assert.equal(approvalCalls,0);
  source.logs[0].approval_status='approved';
  source.wages[0].hourly_wage=null;
  result=await api.getPayrollSummary('2026-09');assert.equal(result.totals.gross,null);assert.equal(result.readiness.missingWages,1);
  source.wages[0].hourly_wage=20;
  source.logs.push({...source.logs[0],id:'invalid',clock_in:null,clock_out:null,duration_mins:0});
  result=await api.getPayrollSummary('2026-09');assert.equal(result.rows[0].shifts,2);assert.equal(result.rows[0].invalidShifts,1);assert.equal(result.rows[0].gross,null);assert.equal(result.totals.gross,null);
  source.logs.pop();
  result=await api.getPayrollSummary('2026-09');assert.equal(result.readiness.canApprove,true);
  assert.equal((await api.setPayrollApproval('2026-09',true,undefined,'b'.repeat(32))).ok,false);assert.equal(approvalCalls,0);
  assert.equal((await api.setPayrollApproval('2026-09',true,undefined,revision)).ok,true);assert.equal(approvalCalls,1);
  source.logs.push({...source.logs[0],id:'later',work_date:'2026-09-20',clock_in:'2026-09-20T08:00Z',clock_out:'2026-09-20T09:00Z'});
  source.wages.push({user_id:'employee',work_date:'2026-09-20',hourly_wage:25});
  result=await api.getPayrollSummary('2026-09');assert.equal(result.rows[0].gross,30);assert.equal(result.rows[0].rates.length,2);assert.equal(result.rows[0].wage,null);assert.equal(result.readiness.canApprove,true);
  source.wages[1].hourly_wage=null;result=await api.getPayrollSummary('2026-09');assert.equal(result.rows[0].gross,null);assert.equal(result.readiness.missingWages,1);
  source.wages[1].hourly_wage=-1;result=await api.getPayrollSummary('2026-09');assert.equal(result.rows[0].gross,null);assert.equal(result.totals.gross,null);
  source.logs.pop();source.wages.pop();result=await api.getPayrollSummary('2026-09');
  stored={rows:result.rows,totals:result.totals,settings:result.settings,revision};
  run={status:'approved',approval_id:'archive',approved_by:'Manager'};
  source.wages[0].hourly_wage=999;inputError={message:'Current inputs unavailable'};
  const before=rpcCalls;result=await api.getPayrollSummary('2026-09');
  assert.equal(result.totals.gross,5);assert.equal(result.run.frozen,true);assert.equal(rpcCalls,before,'Frozen payroll must not request current wages or attendance');
  run={status:'draft'};result=await api.getPayrollSummary('2026-09');assert.equal(result.ok,false);assert.equal(result.error,inputError.message);
  console.log('Actual payroll query preserves exact pay, blocks incomplete/stale approvals, reports failures and loads frozen figures.');
})().catch(error=>{console.error(error);process.exitCode=1;});

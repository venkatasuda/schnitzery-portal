const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const actor='00000000-0000-0000-0000-000000000001',log='00000000-0000-0000-0000-000000000002';
let role='manager',emptyUpdate=false,nameFailure=false,updatedFilters,inserted;
const tables={users:[{id:actor,full_name:'Manager'},{id:'employee',full_name:'Employee',team:'Kitchen'}],attendance_logs:[...Array.from({length:100},(_,i)=>({id:'recent'+i,branch_id:'branch',status:'complete',work_date:'2026-09-01',approval_status:'approved'})),{id:log,user_id:'employee',branch_id:'branch',status:'complete',work_date:'2026-01-01',approval_status:'pending'}]};
const client={auth:{getUser:async()=>({data:{user:{id:actor}}})},from(table){
  const filters=[];let limit=Infinity,update;
  const rows=()=>tables[table].filter(r=>filters.every(([k,v])=> k==='pending'?r.approval_status==null||r.approval_status==='pending':k==='in'?v[1].includes(r[v[0]]):r[k]===v)).slice(0,limit);
  const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},in:(k,v)=>{filters.push(['in',[k,v]]);return q;},or:()=>{filters.push(['pending']);return q;},order:()=>q,limit:n=>{limit=n;return q;},
    insert:value=>{inserted=value;return{error:null};},update:value=>{update=value;return q;},single:async()=>({data:{role,branch_id:'branch'}}),maybeSingle:async()=>{updatedFilters=filters;return{data:emptyUpdate?null:rows()[0]};},
    then:(resolve,reject)=>Promise.resolve({data:rows(),error:table==='users'&&nameFailure?{message:'Names unavailable'}:null}).then(resolve,reject)};return q;
}};
function load(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Date,Set,URL,require:name=>imports[name]});return exports;}
const imports={'@/lib/supabase/server':{createClient:async()=>client},'@/lib/supabase/readAll':{readAll:async q=>await q},'@/lib/time/berlinDate':{berlinToday:()=> '2026-10-12',berlinMonth:()=> '2026-10',isCalendarDate:d=>typeof d==='string'&&/^2026-09-\d\d$/.test(d)}};
const api=load('src/lib/queries/live-attendance.ts',imports),corrections=load('src/lib/queries/corrections.ts',imports);
(async()=>{
  let result=await api.getAttendanceApprovals();assert.equal(result.ok,true);assert.equal(result.rows.length,1);assert.equal(result.rows[0].id,log,'Old pending shift must remain visible behind more than 80 approved shifts');
  tables.attendance_logs.push(...Array.from({length:100},(_,i)=>({id:'pending'+i,user_id:'employee',branch_id:'branch',status:'complete',work_date:'2026-01-01',approval_status:'pending'})));
  result=await api.getAttendanceApprovals();assert.equal(result.rows.length,101,'Do not silently cap a filtered pending queue at 80');
  nameFailure=true;assert.equal((await api.getAttendanceApprovals()).ok,false);nameFailure=false;
  assert.equal((await api.setAttendanceApproval(log,'approved')).ok,true);assert.ok(updatedFilters.some(([k,v])=>k==='branch_id'&&v==='branch'));assert.ok(updatedFilters.some(([k])=>k==='pending'));
  emptyUpdate=true;assert.equal((await api.setAttendanceApproval(log,'approved')).ok,false);
  assert.equal((await api.setAttendanceApproval(log,'other')).ok,false);
  role='staff';assert.equal((await api.getAttendanceApprovals()).ok,false);assert.equal((await api.setAttendanceApproval(log,'approved')).ok,false);
  assert.equal((await corrections.submitCorrection(null)).ok,false);
  assert.equal((await corrections.decideCorrection(log,null)).ok,false);
  assert.equal((await corrections.submitCorrection({type:'incorrect',targetDate:'2026-09-10',reason:123})).ok,false);
  assert.equal((await corrections.submitCorrection({type:'missing',targetDate:'2026-09-10',reason:'Test',requestedClockIn:'garbage'})).ok,false);
  assert.equal((await corrections.submitCorrection({type:'missing',targetDate:'2026-09-10',reason:'Test',requestedClockIn:'2026-09-10T08:00:00Z',evidenceUrl:'javascript:alert(1)'})).ok,false);
  assert.equal((await corrections.submitCorrection({type:'missing',targetDate:'2026-09-10',reason:'Test',requestedClockIn:'2026-09-10T08:00:00Z',requestedClockOut:'2026-09-10T09:00:00Z',user_id:'other',branch_id:'other'})).ok,true);
  assert.equal(inserted.user_id,actor);assert.equal(inserted.branch_id,'branch');assert.equal(inserted.status,'pending');
  console.log('Attendance queue retains old pending shifts, rejects stale/invalid decisions and validates correction inputs.');
})().catch(error=>{console.error(error);process.exitCode=1;});

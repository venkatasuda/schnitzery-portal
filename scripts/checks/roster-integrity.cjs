const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let role='manager',people=[{id:'employee',full_name:'Real name'}],changed={id:'roster',roster_data:{}},writes=[];
const chain=table=>{let mutation=false;const q=new Proxy({}, {get:(_,method)=>{
 if(method==='then')return (resolve,reject)=>Promise.resolve({data:table==='users'?people:changed,error:null}).then(resolve,reject);
 return (...args)=>{if(['insert','update'].includes(method)){mutation=true;writes.push([table,method,...args]);}if(mutation&&['eq','is'].includes(method))writes.push([method,...args]);if(method==='single')return Promise.resolve({data:{role,branch_id:'branch'},error:null});return q;};}});return q;};
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/queries/schedule.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,require:n=>{
 if(n.endsWith('/server'))return {createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'manager'}}})},from:chain})};
 if(n.endsWith('schedule-constants'))return {DAYS:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],SHIFT_MODEL:{Kitchen:[{shift:'Morning'}]}};
 if(n.endsWith('berlinDate'))return {isCalendarDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d)};
 if(n.endsWith('calculations'))return {};throw Error(n);
}});
(async()=>{
 const roster={Monday:[{user_id:'employee',name:'Forged',team:'Kitchen',shift:'Morning'}]},expected={id:'roster',roster:{Monday:[]}};
 assert.equal((await out.saveRoster('2026-10-19',roster,undefined)).ok,false);assert.equal(writes.length,0);
 role='staff';assert.equal((await out.saveRoster('2026-10-19',roster,expected)).ok,false);assert.equal(writes.length,0);role='manager';
 people=[];assert.equal((await out.saveRoster('2026-10-19',roster,expected)).ok,false);assert.equal(writes.length,0);people=[{id:'employee',full_name:'Real name'}];
 assert.equal((await out.saveRoster('2026-10-20',roster,expected)).ok,false);
 assert.equal((await out.saveRoster('2026-10-19',{Monday:[{...roster.Monday[0],shift:'25:99–26:00'}]},expected)).ok,false);
 assert.equal((await out.saveRoster('2026-10-19',roster,expected)).ok,true);
 assert.equal(writes[0][2].roster_data.Monday[0].name,'Real name');assert(writes.some(x=>x[0]==='eq'&&x[1]==='roster_data'&&x[2]===JSON.stringify(expected.roster)));
 changed=null;const result=await out.saveRoster('2026-10-19',roster,expected);assert.equal(result.ok,false);assert.match(result.error,/changed elsewhere/);
 console.log('Roster: role/branch/staff/time boundaries and snapshot compare-and-swap reject unsafe saves.');
})().catch(e=>{console.error(e);process.exitCode=1;});


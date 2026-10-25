// Actual server boundary and React screen; synthetic data, no network/database.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const harness=fs.readFileSync('scripts/checks/workspace-ux.cjs','utf8').split('(async()=>{')[0];
const box={module:{exports:{}},require,console,setImmediate,setTimeout,URL,URLSearchParams};
vm.runInNewContext(harness+'\nmodule.exports={ui,find};',box);
const {ui,find}=box.module.exports;
const branch='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',line='33333333-3333-4333-8333-333333333333';
let userRole='manager',active=branch,calls=0;
const db={auth:{getUser:async()=>({data:{user:{id:'manager'}}})},from(){return this},select(){return this},eq(){return this},single:async()=>({data:{role:userRole,branch_id:branch,status:'active'}}),rpc:async()=>{calls++;return{data:{id:session},error:null}}};
const exportsBox={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/queries/count-sessions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsBox,require(name){
 if(name==='@/lib/supabase/server')return{createClient:async()=>db};
 if(name==='@/lib/activeBranch')return{activeBranchFor:async()=>active,MULTI_BRANCH_ROLES:['manager','branch_owner','brand_owner','super_admin']};
 if(name==='@/lib/supabase/readAll')return{};
 throw Error(name);
}});
const fixture={ok:true,branch:{id:branch,name:'Test branch'},sessions:[{id:session,status:'draft',count_date:'2026-10-24',revision:0}],session:{id:session,status:'draft',count_date:'2026-10-24',revision:0},lines:[{id:line,product:'Rice',category:'Dry',unit:'kg',target:4,quantity:null}]};
(async()=>{
 const edit=exportsBox.editCountSession;
 assert.equal((await edit(branch,session,'save',0,[{id:line,quantity:-1}])).error,'invalid');
 assert.equal((await edit(branch,session,'save',0,[{id:line,quantity:NaN}])).error,'invalid');
 assert.equal((await edit(branch,session,'save',0,[{id:line,quantity:0},{id:line,quantity:1}])).error,'invalid');
 userRole='staff';assert.equal((await edit(branch,session,'start',0)).error,'access');
 userRole='manager';active=session;assert.equal((await edit(branch,session,'start',0)).error,'access');
 active=branch;assert.equal((await edit(branch,session,'save',0,[{id:line,quantity:0}])).ok,true);assert.equal(calls,1);
 const screen=await ui('inventory/counts',fixture);
 assert.match(screen.render(),/countSession.title/);
 let complete=find(screen.tree(),e=>e.type==='button'&&e.props.children==='countSession.complete');
 assert.equal(complete.props.disabled,true,'Cannot complete an uncounted draft');
 find(screen.tree(),e=>e.type==='input'&&e.props.type==='number').props.onChange({target:{value:'0'}});
 assert.match(screen.render(),/countSession.unsaved/);
 assert.equal(find(screen.tree(),e=>e.type==='button'&&e.props.children==='countSession.complete').props.disabled,true,'Must save before completing');
 const closed=await ui('inventory/counts',{...fixture,session:{...fixture.session,status:'completed'},lines:[{...fixture.lines[0],quantity:0}]});
 assert.doesNotMatch(closed.render(),/type="number"/,'Completed snapshots are read only');
 const failed=await ui('inventory/counts',{ok:false,error:'load'});assert.match(failed.render(),/role="alert"/);
 console.log('Count sessions: role/branch/input boundaries, zero quantities, saved-before-complete, closed snapshots and visible load errors pass.');
})().catch(error=>{console.error(error);process.exitCode=1});

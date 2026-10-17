const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
function load(file,imports,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in imports)return imports[n];throw Error(n);},...globals});return exports;}
(async()=>{
 const values=new Map();let denied=false,user='A',rpcCalls=0,lastPayload=[],reply;
 const storage={getItem:k=>values.get(k)||null,removeItem:k=>values.delete(k),setItem:(k,v)=>{if(denied)throw Error('Quota exceeded');values.set(k,v);}};
 let tail=Promise.resolve();const nav={onLine:false,locks:{request:(_key,fn)=>{const next=tail.then(fn);tail=next.catch(()=>{});return next;}}};
 class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}}
 const common={localStorage:storage,navigator:nav,window:{dispatchEvent(){}},crypto,CustomEvent,Date,Set};
 const queue=load('src/lib/offline/attendanceQueue.ts',{'./device':{getDeviceId:()=> 'fixture'}},common);
 const server=load('src/lib/queries/attendance-sync.ts',{
   '@/lib/time/berlinDate':{isCalendarDate:s=>{const d=new Date(s);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}},
   '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:user?{id:user}:null}})},rpc:async(_name,args)=>{rpcCalls++;lastPayload=args.p_events;return {data:{results:reply?reply(lastPayload):lastPayload.map(e=>({event_uuid:e.event_uuid,status:'applied'}))},error:null};}})}
 },common);
 const sync=load('src/lib/offline/sync.ts',{'./attendanceQueue':queue,'@/lib/queries/attendance-sync':server,'@/lib/supabase/client':{createClient:()=>({auth:{getUser:async()=>({data:{user:user?{id:user}:null}})}})}},common);
 queue.setQueueOwner('A');const a=await queue.captureOffline('clock_in');
 assert.equal((await sync.flushQueue()).offline,true);assert.equal(rpcCalls,0);
 queue.setQueueOwner('B');const b=await queue.captureOffline('clock_in');
 const legacy={...a,event_uuid:crypto.randomUUID(),user_id:null};storage.setItem('sz_attendance_queue',JSON.stringify([...queue.readQueue(),legacy]));
 assert.equal(queue.readQueueMine('B').length,1);assert.equal(queue.readQueueMine(null).length,0);
 assert.equal(queue.readStranded('B').length,1,'Other employee records are not exposed as this users stranded records');
 nav.onLine=true;user='B';reply=()=>[{event_uuid:b.event_uuid,status:'rejected'},{event_uuid:a.event_uuid,status:'applied'}];
 assert.equal((await sync.flushQueue()).synced,0);assert.equal(queue.readQueue().length,3,'Invalid and foreign acknowledgements cannot erase work');
 reply=()=>[{event_uuid:b.event_uuid,status:'applied'},{event_uuid:b.event_uuid,status:'applied'}];
 assert.equal((await sync.flushQueue()).synced,1);assert.equal(queue.readQueue().length,2);
 user='A';const before=rpcCalls;assert.equal((await sync.flushQueue()).ok,false);assert.equal(rpcCalls,before,'Changed account cannot sync from the old rendered screen');
 queue.setQueueOwner('A');reply=rows=>rows.map(e=>({event_uuid:e.event_uuid,status:'recorded_with_error'}));
 assert.equal((await sync.flushQueue()).needsReview,1);assert.equal(queue.readQueue().length,1,'Ownerless legacy record is retained');
 assert.equal((await server.syncOfflineEvents([legacy])).results.length,0);
 assert.equal((await server.syncOfflineEvents([{...a,event_uuid:'not-a-uuid'}])).results.length,0);
 denied=true;await assert.rejects(queue.captureOffline('clock_out'),/not saved/);assert.equal(queue.readQueue().length,1);
 denied=false;queue.setQueueOwner(null);await assert.rejects(queue.captureOffline('clock_in'),/identity/);
 queue.setQueueOwner('A');await Promise.all(Array.from({length:101},()=>queue.captureOffline('clock_in')));
 assert.equal(queue.readQueueMine('A').length,101,'Concurrent captures cannot overwrite another capture');
 reply=null;assert.equal((await sync.flushQueue()).synced,100);assert.equal(lastPayload.length,100);assert.equal((await sync.flushQueue()).synced,1);
 assert.equal(queue.readQueue().length,1);
 storage.setItem('sz_attendance_queue','corrupt evidence');await assert.rejects(queue.captureOffline('clock_in'),/cannot be read/);
 assert.equal(storage.getItem('sz_attendance_queue'),'corrupt evidence','Corrupt evidence must not be overwritten');
 console.log('Offline capture → real server action → acknowledgement checks pass: ownership, account changes, quota, corruption, locks, retries, partial results and batching.');
})().catch(e=>{console.error(e);process.exitCode=1});

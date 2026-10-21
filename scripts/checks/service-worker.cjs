const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const handlers={},stored=new Map(),deleted=[];
let offline=false,redirectLogin=false,privateLogin=false;
const response=(body,extra={})=>({ok:true,status:200,type:'basic',redirected:false,headers:{get:()=>''},clone(){return this;},body,...extra});
const key=r=>typeof r==='string'?new URL(r,'http://localhost:3000').href:r.url;
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{
 URL,Request,console,
 self:{location:{origin:'http://localhost:3000'},addEventListener:(n,h)=>handlers[n]=h,skipWaiting(){},clients:{claim(){}}},
 caches:{open:async()=>({put:async(r,s)=>stored.set(key(r),s)}),match:async r=>stored.get(key(r)),keys:async()=>['schnitzery-v4','schnitzery-v5','other-app'],delete:async k=>deleted.push(k)},
 fetch:async r=>{if(offline)throw Error('Offline');return response(key(r),{redirected:redirectLogin&&key(r).endsWith('/login'),headers:{get:()=>privateLogin&&key(r).endsWith('/login')?'private, no-store':''}});}
});
async function lifecycle(name){let pending;handlers[name]({waitUntil:p=>pending=p});await pending;}
async function request(path,mode='navigate',method='GET') {let pending;handlers.fetch({request:{url:new URL(path,'http://localhost:3000').href,mode,method},respondWith:p=>pending=p});return pending?await pending:undefined;}
(async()=>{
 redirectLogin=true;await lifecycle('install');assert(!stored.has(key('/login')),'redirected dashboard must not be cached');assert(stored.has(key('/offline.html')));
 redirectLogin=false;privateLogin=true;await lifecycle('install');assert(!stored.has(key('/login')),'private login response must not be cached');
 privateLogin=false;await lifecycle('install');assert(stored.has(key('/login')));
 const before=stored.size;await request('/payroll');assert.equal(stored.size,before,'private navigation must not be stored');
 offline=true;assert.equal((await request('/payroll')).body,key('/offline.html'));assert.equal((await request('/login')).body,key('/login'));offline=false;
 for(const p of ['/_next/static/css/app/layout.css?v=12345678','/_next/static/chunks/webpack.js?v=12345678','/inventory?_rsc=123','https://other.test/a','/api/private'])assert.equal(await request(p,'cors'),undefined,p);
 assert.equal(await request('/api/agent/chat','cors','POST'),undefined);
 await request('/_next/static/chunks/4d96fe8637219abf.js','cors');assert(stored.has(key('/_next/static/chunks/4d96fe8637219abf.js')));
 await lifecycle('activate');assert.deepEqual(deleted,['schnitzery-v4']);
 console.log('Service worker: redirect/private precache blocked, private offline fallback is public, mutable/RSC/API/write requests bypass cache, unrelated caches retained.');
})().catch(e=>{console.error(e);process.exitCode=1;});

// The auth proxy must not redirect the public PWA assets: a redirected /sw.js
// fails registration and a redirected /offline.html is never precached.
{
 const ok=require('node:assert/strict');
 const src=require('node:fs').readFileSync('src/proxy.ts','utf8');
 const gate=new RegExp('^'+JSON.parse(src.match(/matcher:\s*\[[\s\S]*?("\/\(\(\?![^\n]*")/)[1])+'$');
 for(const p of ['/sw.js','/offline.html','/manifest.webmanifest','/icons/icon-192.png'])ok(!gate.test(p),`proxy must not gate ${p}`);
 for(const p of ['/','/attendance','/payroll','/login','/api/agent/chat','/sw.jsx','/offline.html/x'])ok(gate.test(p),`proxy must still gate ${p}`);
 console.log('Proxy: public PWA assets bypass auth; app routes stay gated.');
}

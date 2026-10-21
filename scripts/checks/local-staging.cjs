const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('scripts/ops/start-local-staging.mjs','utf8')
  .replace(/^import .*;\r?\n/gm,'')
  .replace('import.meta.url',JSON.stringify(require('node:url').pathToFileURL(process.cwd()+'/scripts/ops/start-local-staging.mjs').href));
function run(api){
  vm.runInNewContext(source,{
    existsSync:()=>true,readFileSync:()=>'',resolve:require('node:path').resolve,
    fileURLToPath:require('node:url').fileURLToPath,URL,
    parseEnv:()=>({NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test',SUPABASE_SERVICE_ROLE_KEY:'local-test'}),
    process:{argv:['node','script','--check']},console:{log(){}},
    spawn(){throw Error('Check mode spawned a server');},
  });
}
run('http://127.0.0.1:55321');
for(const url of ['https://vxwtmtlkwvwcdegtcjuz.supabase.co','http://127.0.0.1:54321','http://127.0.0.1:55321/other'])
  assert.throws(()=>run(url),/Refusing staging startup/);
console.log('Staging launcher rejects production, other local projects and altered paths.');
const ts=require('typescript');
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,'.');
assert(parsed.fileNames.some(file=>file.replaceAll('\\','/').startsWith('src/')));
assert(!parsed.fileNames.some(file=>file.replaceAll('\\','/').includes('.audit-db/')),'Root typecheck must not scan the isolated source snapshot');

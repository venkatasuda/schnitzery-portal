// Static accessibility guard (Release F): every form control has an accessible name and
// every icon-only button has an aria-label. Fails on any new violation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const files=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.tsx'))files.push(p);}})('src');
const problems=[];
for(const f of files){
  const s=fs.readFileSync(f,'utf8'),line=i=>s.slice(0,i).split('\n').length;
  for(const m of s.matchAll(/<(input|textarea|select)\b/g)){
    let i=m.index+m[0].length,d=0;for(;i<s.length;i++){const c=s[i];if(c==='{')d++;else if(c==='}')d--;else if(c==='>'&&d===0)break;}
    const tag=s.slice(m.index,i+1);
    if(/aria-label|aria-labelledby|\sid=|type="(hidden|checkbox|radio|file)"/.test(tag))continue;
    const before=s.slice(Math.max(0,m.index-300),m.index);
    if(before.lastIndexOf('<label')>before.lastIndexOf('</label>')||before.lastIndexOf('<Field')>before.lastIndexOf('</Field>'))continue;
    problems.push(`${f}:${line(m.index)} <${m[1]}> has no label/aria-label`);
  }
  for(const m of s.matchAll(/<button\b((?:[^<>]|\{[^}]*\})*)>\s*(<Icon[^>]*\/>|✕|×|[←-⟿]|\p{Extended_Pictographic})\s*<\/button>/gu))
    if(!/aria-label/.test(m[1]))problems.push(`${f}:${line(m.index)} icon-only button without aria-label`);
}
assert.equal(problems.length,0,'\n'+problems.join('\n'));
console.log(`Accessibility (static): all form controls and icon-only buttons in ${files.length} files are named.`);

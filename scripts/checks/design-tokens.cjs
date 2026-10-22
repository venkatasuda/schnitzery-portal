// Release F design-system ratchet (docs/DESIGN-SYSTEM.md). Counts hand-styling in
// pages/components and fails if any count GROWS past the committed baseline. When you
// migrate a page and a count drops, lower the baseline: node scripts/checks/design-tokens.cjs --update
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const files=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.tsx'))files.push(p);}})('src');
const metrics={
  inlineStyles:/style=\{\{/g,
  hardcodedColors:/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?=["'\s;,)])|rgba?\(/g,
  fontSizeLiterals:/fontSize: ?["']?\d/g,
  colorMix:/color-mix\(/g,                    // unsupported on iOS < 16.2 (kitchen devices: 15.4+)
  localComponents:/^function (Stat|Kpi|Metric|Field|Chip|Row|FilterBtn)\b/gm, // use src/components/ui.tsx
};
const now={};for(const k in metrics)now[k]=0;
for(const f of files){if(f.endsWith(path.join('components','ui.tsx')))continue;const s=fs.readFileSync(f,'utf8');for(const[k,re]of Object.entries(metrics))now[k]+=(s.match(re)||[]).length;}
const file='scripts/checks/design-baseline.json';
if(process.argv.includes('--update')){fs.writeFileSync(file,JSON.stringify(now,null,2)+'\n');console.log('Design baseline written',now);process.exit(0);}
const base=JSON.parse(fs.readFileSync(file,'utf8'));
for(const k in metrics)assert.ok(now[k]<=base[k],`${k} grew: ${now[k]} > baseline ${base[k]}. Use tokens/components from src/components/ui.tsx instead of hand styling.`);
const lower=Object.keys(metrics).filter(k=>now[k]<base[k]);
console.log('Design ratchet holds:',JSON.stringify(now)+(lower.length?` — lower the baseline for ${lower.join(', ')} (--update).`:''));

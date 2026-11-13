// Browser layout contract using the actual shared components/CSS, without auth or business-data writes.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '../..');
require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file);
const { PageHeader, Field } = require(path.join(root, 'src/components/ui.tsx'));
const ActionsMenu = require(path.join(root, 'src/components/ActionsMenu.tsx')).default;
const h = React.createElement, css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
function fixture(role, de) {
  const manager = ['manager', 'owner'].includes(role);
  const fields = [de?'Produkt suchen':'Search products', de?'Produktkategorie':'Category', de?'Bestandsstatus':'Stock status'];
  const content = h('div', {className: manager?'management-shell':'employee-shell'},
    manager && h('aside', {className:'management-sidebar'}, 'Schnitzery'),
    h('header', {className:'app-header'}, h('div',{className:'header-leading'},'Schnitzery'),h('div',{className:'header-right'},role)),
    h('main',{className:'screen-wrap'},
      h(PageHeader,{title:de?'Bestandsverwaltung und Wareneingänge':'Inventory and receiving',subtitle:'Stuttgart · 12.11.2026',actions:h('button',{className:'btn-gold'},de?'Lieferung annehmen':'Receive goods')}),
      h('div',{className:'ui-toolbar'}, fields.map((label,i)=>h(Field,{key:label,label},i===0?h('input',{className:'form-input',type:'search'}):h('select',{className:'form-select'},h('option',null,de?'Alle auswählen':'All'))))),
      h('div',{className:'ui-actions'},h('button',{className:'btn-secondary'},de?'Aktualisieren':'Refresh'),h(ActionsMenu,{label:de?'Weitere Aktionen':'More actions'},h('button',{className:'btn-secondary'},de?'Verlauf ansehen':'View history'))),
      h('div',{className:'table-scroll'},h('table',{className:'data-table'},h('thead',null,h('tr',null,h('th',null,'Product'),h('th',null,'Quantity'),h('th',null,'Status'))),h('tbody',null,h('tr',null,h('td',null,'Parmesan'),h('td',{className:'numeric'},'24 kg'),h('td',null,'Available'))))),
      h('div',{className:'form-actions'},h('button',{className:'btn-secondary'},de?'Abbrechen':'Cancel'),h('button',{className:'btn-gold'},de?'Änderungen speichern':'Save changes'))));
  return '<!doctype html><html><head><style>'+css+'</style></head><body>'+renderToStaticMarkup(content)+'</body></html>';
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 let checked=0;
 try {
  const page=await browser.newPage();
  for(const role of ['staff','shift_leader','manager','owner'])for(const width of [390,768,1280,1440])for(const light of [false,true])for(const de of [false,true]){
   await page.setViewportSize({width,height:960});await page.setContent(fixture(role,de));
   await page.evaluate(light=>document.documentElement.classList.toggle('light',light),light);
   const result=await page.evaluate(()=>{
    const controls=[...document.querySelectorAll('button,input,select')].filter(e=>e.getClientRects().length&&!e.closest('details:not([open])'));
    const outside=controls.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5;}).map(e=>e.textContent||e.getAttribute('aria-label'));
    const small=controls.filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.textContent||e.getAttribute('aria-label'));
    const inputs=[...document.querySelectorAll('.ui-toolbar input,.ui-toolbar select')].map(e=>e.getBoundingClientRect().bottom);
    const actions=[...document.querySelectorAll(".form-actions button")].map(e=>e.getBoundingClientRect().height);
    return {outside,small,inputs,actions,overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   const label=`${role}/${width}/${light?'light':'dark'}/${de?'de':'en'}`;
   assert.deepEqual(result.outside,[],`${label}: clipped control`);assert.deepEqual(result.small,[],`${label}: small touch target`);
   assert.equal(result.overflow,false,`${label}: page overflow`);
   assert(Math.max(...result.actions)-Math.min(...result.actions)<1,`${label}: uneven footer buttons`);
   // Wrapped mobile filters are intentionally stacked. Desktop filters share one baseline.
   if(width>=768)assert(Math.max(...result.inputs)-Math.min(...result.inputs)<1,`${label}: filter baseline`);
   if(role==='manager'&&((width===1440&&light&&!de)||(width===390&&light&&de))){
    const dir=path.join(root,'docs/ops/ui-review-2026-11-12');fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,`shared-layout-${width}.png`),fullPage:true,animations:"disabled"});
   }
   checked++;
  }
  const touchContext = await browser.newContext({hasTouch:true,viewport:{width:390,height:844}});
  try {
   const touch = await touchContext.newPage();await touch.setContent(fixture('manager',true));
   const targets = await touch.evaluate(()=>{
    const host=document.querySelector('main');
    return ['ui-icon-btn','ui-remove-btn','ui-choice'].map(className=>{
     const button=document.createElement('button');button.className=className;button.textContent='×';host.append(button);
     const r=button.getBoundingClientRect();return {className,width:r.width,height:r.height,coarse:matchMedia('(pointer: coarse)').matches};
    });
   });
   for(const target of targets){assert(target.coarse,'Touch test needs a coarse pointer');assert(target.height>=44&&target.width>=44,`${target.className}: small touch target`);}
  } finally {await touchContext.close();}
  console.log(`Portal shared layout: ${checked} role/viewport/theme/language combinations pass (presentation fixtures, not authenticated workflow tests).`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

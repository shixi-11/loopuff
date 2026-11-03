import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountDiagnostic} from '../src/diagnostic-ui.js';
import {newDiagnostic,diagnosticIds,diagnosticPuzzle,submitDiagnostic} from '../src/diagnostic.js';
import {course,locales} from '../src/course.js';
import {parseRoute,routeUrl,languageUrl} from '../src/routing.js';
const text=JSON.parse(await readFile(new URL('../public/locales/zh.json',import.meta.url),'utf8'));
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
function mount(initial,onChange=()=>true,model={}){
 const handlers={},nodes=new Map(),root={innerHTML:'',addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener(){},querySelectorAll:()=>[],querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:'',disabled:false,focus(){},scrollIntoView(){},setAttribute(){}});return nodes.get(selector);}};
 const page=mountDiagnostic(root,{initial,model,text:text.diagnostic,feedbackText:text.diagnosticFeedback,ui:text.ui,errors:text.ui,concepts:text.assessment.concepts,statuses:text.assessment,lessons:Object.fromEntries(course.map((l,i)=>[l.id,text.lessons[i]])),urls:{home:'/zh/',guide:'/zh/guide/',map:'/zh/guide/map/',saves:'/zh/saves/',lesson:id=>`/zh/learn/${id}/`},onChange});
 const action=dataset=>handlers.click({target:{closest:()=>({dataset})}});
 const edit=source=>{root.querySelector('#diagnostic-editor').value=source;handlers.input({target:{id:'diagnostic-editor',value:source}});};
 const submit=()=>handlers.submit({preventDefault(){},target:{matches:()=>true}});
 return {page,root,model,action,edit,submit};
}
test('editing and undo invalidate submitted output; navigating cancels deferred submissions',async()=>{
 const original=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});
 const s=newDiagnostic(42),source=diagnosticPuzzle(42,'names').example;submitDiagnostic(s,'names',source);const m=mount(s);
 try{
  await tick();assert.equal(m.model.reports.names.report.ok,true);assert.ok(m.root.querySelector('[data-diagnostic-inspector]').innerHTML.includes('✓'));
  m.edit('0.log()');m.edit(source);await tick();assert.equal(m.model.state.submitted.names,null);assert.equal(m.model.reports.names,undefined);assert.ok(!m.root.querySelector('[data-diagnostic-result]').innerHTML.includes(text.diagnostic.allPassed));
  m.submit();m.edit('1.log()');await tick();assert.equal(m.model.state.submitted.names,null);
  m.edit(source);m.submit();m.page.dispose();await tick();assert.equal(m.model.state.submitted.names,null);
 }finally{m.page.dispose();globalThis.matchMedia=original;}
});
test('restored submissions are executed again, including failure; cached reports never certify edited code',async()=>{
 const s=newDiagnostic(42);for(const id of diagnosticIds){s.drafts[id]=diagnosticPuzzle(42,id).example;s.submitted[id]=s.drafts[id];}s.drafts.branch='1.log()';s.submitted.branch='1.log()';
 const m=mount(s);try{for(let i=0;i<30&&!m.model.reports.coordination;i++)await tick();assert.equal(Object.keys(m.model.reports).length,9);assert.equal(m.model.reports.names.report.ok,true);assert.equal(m.model.reports.branch.report.ok,false);
  m.action({diagnosticArea:'branch'});assert.ok(m.root.querySelector('[data-diagnostic-result]').innerHTML.includes(text.diagnostic.partial));
 }finally{m.page.dispose();}
});
test('new inputs retain code but clear submissions and hints; hints do not insert answers',async()=>{
 const s=newDiagnostic(42),source=diagnosticPuzzle(42,'names').example;s.drafts.names=source;const m=mount(s);
 try{m.action({diagnosticAction:'hint'});m.action({diagnosticAction:'hint'});assert.equal(m.model.state.drafts.names,source);assert.equal(m.model.state.hints.names,2);
  m.action({diagnosticAction:'new-set'});assert.notEqual(m.model.state.seed,42);assert.equal(m.model.state.drafts.names,source);assert.equal(m.model.state.submitted.names,null);assert.equal(m.model.state.hints.names,0);
 }finally{m.page.dispose();}
});
test('future records remain untouched until the explicit two-step replacement',()=>{
 const original={version:99,privateDraft:'keep these bytes'},writes=[],m=mount(original,s=>writes.push(structuredClone(s)));
 try{assert.equal(writes.length,0);assert.equal(m.model.state,original);assert.ok(m.root.innerHTML.includes(text.diagnostic.badSave));m.action({diagnosticAction:'reset-bad'});assert.equal(writes.length,0);assert.equal(m.model.state,original);m.action({diagnosticAction:'reset-bad'});assert.equal(writes.length,1);assert.equal(writes[0].version,1);assert.deepEqual(original,{version:99,privateDraft:'keep these bytes'});
 }finally{m.page.dispose();}
});
test('save failures are visible and a late older failure cannot replace the newest save result',async()=>{
 let resolveFirst,count=0;const waiting=new Promise(resolve=>resolveFirst=resolve),m=mount(newDiagnostic(42),()=>++count===1?waiting:count===2?true:false);
 try{m.edit('7.log()');await tick();resolveFirst(false);await tick();assert.equal(m.root.querySelector('[data-diagnostic-save]').textContent,'');m.edit('8.log()');await tick();assert.equal(m.root.querySelector('[data-diagnostic-save]').textContent,text.diagnostic.saveFailed);}
 finally{m.page.dispose();}
});
test('diagnostic links preserve locale, host prefix and query parameters without adding navigation items',async()=>{
 for(const [locale]of locales)for(const prefix of ['', '/games/loopuff']){const input=`https://example.com${prefix}/zh/guide/check/?x=1`;const url=languageUrl(input,locale);assert.equal(url.pathname,`${prefix}/${locale}/guide/check/`);assert.equal(url.search,'?x=1');assert.deepEqual(parseRoute(url.pathname),{locale,view:'check'});assert.equal(routeUrl(input,locale,'check').pathname,url.pathname);}
 assert.equal(parseRoute('/zh/guide/check/extra/'),null);
 const shapes=value=>value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,shapes(value[key])])):typeof value;
 for(const [locale]of locales){const value=JSON.parse(await readFile(new URL(`../public/locales/${locale}.json`,import.meta.url),'utf8'));assert.deepEqual(shapes(value.diagnostic),shapes(text.diagnostic));for(const id of diagnosticIds)assert.ok(value.diagnostic.tasks[id].title);}
});
test('restored failures open a real failing case and a chosen input survives a practice detour',async()=>{
 const s=newDiagnostic(42);s.selected='branch';const source='if fuel >= threshold then {1.log()} else {2.log()}';submitDiagnostic(s,'branch',source);
 const m=mount(s);try{
  await tick();assert.ok(m.root.querySelector('[data-diagnostic-inspector]').innerHTML.includes(text.diagnostic.caseLabel.replace('{number}',3)));
  assert.ok(m.root.querySelector('[data-diagnostic-next]').innerHTML.includes(text.diagnosticFeedback.reasons.boundary));
  assert.ok(m.root.querySelector('[data-diagnostic-next]').innerHTML.includes('/zh/learn/comparison/?practice=rewrite&return=diagnostic'));
  m.action({diagnosticCase:'7'});assert.equal(m.model.caseSelection.branch,7);m.page.dispose();
  const back=mount(m.model.state,()=>true,m.model);try{assert.ok(back.root.querySelector('[data-diagnostic-inspector]').innerHTML.includes(text.diagnostic.caseLabel.replace('{number}',8)));assert.equal(back.model.state.drafts.branch,source);back.action({diagnosticAction:'feedback-case'});assert.equal(back.model.caseSelection.branch,2);}finally{back.page.dispose();}
 }finally{m.page.dispose();}
});
test('passed programs put viewed hints away without clearing their record or editing source',async()=>{
 const original=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});
 const s=newDiagnostic(42),source=diagnosticPuzzle(42,'names').example;submitDiagnostic(s,'names',source);s.hints.names=2;const writes=[],m=mount(s,value=>{writes.push(value);return true;});
 try{
  await tick();assert.equal(m.model.reports.names.report.ok,true);assert.ok(!m.root.querySelector('[data-diagnostic-hints]').innerHTML.includes('<aside'));
  assert.ok(m.root.querySelector('[data-diagnostic-hints]').innerHTML.includes(text.diagnosticFeedback.showHints));
  const count=writes.length;m.action({diagnosticAction:'toggle-hints'});assert.ok(m.root.querySelector('[data-diagnostic-hints]').innerHTML.includes('<aside'));assert.equal(writes.length,count);assert.equal(m.model.state.hints.names,2);assert.equal(m.model.state.drafts.names,source);
  m.edit('cargo.log()');assert.ok(m.root.querySelector('[data-diagnostic-hints]').innerHTML.includes('<aside'));assert.ok(m.root.querySelector('[data-diagnostic-next]').innerHTML.includes('/zh/learn/names/'));
  m.submit();await tick();assert.ok(m.root.querySelector('[data-diagnostic-next]').innerHTML.includes('/zh/learn/addition/?practice=rewrite&return=diagnostic'));
  m.edit(source);m.submit();await tick();assert.ok(!m.root.querySelector('[data-diagnostic-hints]').innerHTML.includes('<aside'));assert.equal(m.model.state.hints.names,2);
 }finally{m.page.dispose();globalThis.matchMedia=original;}
});

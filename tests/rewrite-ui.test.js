import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountRewrite} from '../src/rewrite-ui.js';
import {rewriteTask,inspectRewrite} from '../src/rewrite.js';
const text=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url)));
function node(){const children=new Map(),handlers={};return {handlers,innerHTML:'',textContent:'',value:'',dataset:{},hidden:false,disabled:false,setAttribute(){},closest(){return this;},focus(){this.focused=true;},querySelector(selector){if(!children.has(selector))children.set(selector,node());return children.get(selector);},querySelectorAll:()=>[],addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(){}};}
function setup(onChange,id='signal'){
 const original=globalThis.document;globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
 const root=node();let source=rewriteTask(id).starter,continued=0;
 const page=mountRewrite(root,{id,text:text.rewrite,ui:text.ui,sceneText:text.lessonScene,assessmentText:text.assessment,hintText:text.diagnosticFeedback,reduced:{matches:true},getSource:()=>source,onChange:value=>{source=value;return onChange?.(value);},onIndependent:()=>continued++});
 return {root,page,continued:()=>continued,source:()=>source,edit(value){root.querySelector('#rewrite-editor').value=value;root.handlers.input({target:{id:'rewrite-editor',value}});},submit(){root.handlers.submit({target:{id:'rewrite-form'},preventDefault(){}});},click(action){root.handlers.click({target:{closest:()=>({dataset:{rewrite:action}})}});},close(){page.dispose();globalThis.document=original;}};
}
test('whole program edits check actual signals, invalidate on change and do not let stale success continue',()=>{
 const m=setup();try{
  assert.ok(m.root.innerHTML.includes('data-rewrite="continue" disabled'));
  m.edit('3.log();8.log()');assert.equal(m.source(),'3.log();8.log()');m.submit();
  assert.equal(m.root.querySelector('[data-rewrite-status]').textContent,text.rewrite.success);assert.equal(m.root.querySelector('[data-rewrite="continue"]').disabled,false);
  m.edit('3.log()');m.click('continue');assert.equal(m.continued(),0);assert.equal(m.root.querySelector('[data-rewrite="continue"]').disabled,true);
  m.submit();assert.equal(m.root.querySelector('[data-rewrite-status]').textContent,text.rewrite.retry);
  m.click('hint');assert.equal(m.root.querySelector('[data-rewrite-hint]').focused,true);assert.equal(m.source(),'3.log()');
  m.edit('unknown.log()');m.submit();assert.equal(m.root.querySelector('[data-rewrite-status]').textContent,text.ui.nameError);
  m.edit('3.log();8.log()');m.submit();m.click('continue');assert.equal(m.continued(),1);
 }finally{m.close();}
});
test('newest save result wins, rejection is visible and disposal prevents delayed UI writes',async()=>{
 const jobs=[],m=setup(()=>new Promise((resolve,reject)=>jobs.push({resolve,reject})));
 try{
  m.edit('1.log()');m.edit('2.log()');jobs[1].resolve(false);await Promise.resolve();assert.equal(m.root.querySelector('[data-rewrite-save]').textContent,text.rewrite.savedError);
  jobs[0].resolve(true);await Promise.resolve();assert.equal(m.root.querySelector('[data-rewrite-save]').textContent,text.rewrite.savedError);
  m.edit('3.log()');jobs[2].reject(Error('disk'));await Promise.resolve();assert.equal(m.root.querySelector('[data-rewrite-save]').textContent,text.rewrite.savedError);
  m.edit('4.log()');m.page.dispose();jobs[3].resolve(true);await Promise.resolve();assert.equal(m.root.querySelector('[data-rewrite-save]').textContent,text.rewrite.savedError);
 }finally{m.close();}
});
test('correct signals with unfinished joined work cannot certify a rewrite',()=>{
 const source='3.log(); 8.log(); let pending; ?(x <- pending) { x.log() }';
 const result=inspectRewrite('signal',source);assert.equal(result.result.waiting,1);assert.equal(result.ok,false);assert.equal(result.code,'waiting');
});

test('rewrite feedback compares real final output and retracts it on edit or runtime failure',()=>{
 const m=setup();try{
  assert.equal(m.root.querySelector('[data-rewrite-outcome]').hidden,true);
  m.edit('3.log()');m.submit();assert.equal(m.root.querySelector('[data-rewrite-outcome]').hidden,false);assert.equal(m.root.querySelector('[data-rewrite-actual]').textContent,'3');assert.equal(m.root.querySelector('[data-rewrite-status]').textContent,text.rewrite.retry);
  m.edit('3.log(); 8.log()');assert.equal(m.root.querySelector('[data-rewrite-outcome]').hidden,true);assert.equal(m.root.querySelector('[data-rewrite-actual]').textContent,'');m.submit();assert.equal(m.root.querySelector('[data-rewrite-actual]').textContent,'3 → 8');assert.equal(m.root.querySelector('[data-rewrite="continue"]').disabled,false);
  m.edit('3.log(); 8.log(); let pending; ?(x <- pending) {x.log()}');m.submit();assert.equal(m.root.querySelector('[data-rewrite-actual]').textContent,'3 → 8');assert.equal(m.root.querySelector('[data-rewrite-status]').textContent,text.ui.waiting);assert.equal(m.root.querySelector('[data-rewrite="continue"]').disabled,true);
  m.edit('unknown.log()');m.submit();assert.equal(m.root.querySelector('[data-rewrite-status]').textContent,text.ui.nameError);assert.equal(m.root.querySelector('[data-rewrite-outcome]').hidden,true);assert.equal(m.root.querySelector('[data-rewrite-actual]').textContent,'');
 }finally{m.close();}
});

test('a missing contributing method is named from the actual assessment and removed after a new result',()=>{
 const m=setup(undefined,'addition');try{
  m.edit('10.log();13.log()');m.submit();const actual=inspectRewrite('addition',m.source());assert.equal(actual.code,'conceptMissing');assert.equal(m.root.querySelector('[data-rewrite-missing]').hidden,false);assert.ok(m.root.querySelector('[data-rewrite-missing-list]').innerHTML.includes(text.assessment.concepts.add));assert.equal(m.root.querySelector('[data-rewrite-actual]').textContent,'10 → 13');
  m.edit('(4 + 6).log();(8 + 5).log()');assert.equal(m.root.querySelector('[data-rewrite-missing]').hidden,true);assert.equal(m.root.querySelector('[data-rewrite-missing-list]').innerHTML,'');m.submit();assert.equal(m.root.querySelector('[data-rewrite-missing]').hidden,true);assert.equal(m.root.querySelector('[data-rewrite="continue"]').disabled,false);
 }finally{m.close();}
});

test('a checked success fades an optional hint without losing code or preventing manual help',()=>{
 const m=setup();try{
  m.click('hint');assert.equal(m.root.querySelector('[data-rewrite-hint]').hidden,false);assert.equal(m.root.querySelector('[data-rewrite="hint"]').textContent,text.diagnosticFeedback.hideHints);
  const source='3.log();8.log()';m.edit(source);m.submit();assert.equal(inspectRewrite('signal',source).ok,true);assert.equal(m.root.querySelector('[data-rewrite-hint]').hidden,true);assert.equal(m.root.querySelector('[data-rewrite="hint"]').textContent,text.diagnosticFeedback.showHints);assert.equal(m.source(),source);assert.equal(m.root.querySelector('#rewrite-editor').value,source);
  m.click('hint');assert.equal(m.root.querySelector('[data-rewrite-hint]').hidden,false);assert.equal(m.source(),source);m.click('hint');assert.equal(m.root.querySelector('[data-rewrite-hint]').hidden,true);
  m.edit('3.log()');m.submit();assert.equal(m.root.querySelector('[data-rewrite-hint]').hidden,true);assert.equal(m.root.querySelector('[data-rewrite="continue"]').disabled,true);assert.equal(m.source(),'3.log()');
 }finally{m.close();}
});

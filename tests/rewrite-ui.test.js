import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountRewrite} from '../src/rewrite-ui.js';
import {rewriteTask,inspectRewrite} from '../src/rewrite.js';
const text=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url)));
function node(){const children=new Map(),handlers={};return {handlers,innerHTML:'',textContent:'',value:'',dataset:{},hidden:false,disabled:false,setAttribute(){},closest(){return this;},focus(){this.focused=true;},querySelector(selector){if(!children.has(selector))children.set(selector,node());return children.get(selector);},querySelectorAll:()=>[],addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(){}};}
function setup(onChange){
 const original=globalThis.document;globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
 const root=node();let source=rewriteTask('signal').starter,continued=0;
 const page=mountRewrite(root,{id:'signal',text:text.rewrite,ui:text.ui,sceneText:text.lessonScene,reduced:{matches:true},getSource:()=>source,onChange:value=>{source=value;return onChange?.(value);},onIndependent:()=>continued++});
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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountGuide} from '../src/guide-ui.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url)));

test('an independent task href carries the same mode when copied or opened in a new tab',()=>{
 const m=setup();try{assert.ok(m.root.innerHTML.includes('href="/zh/learn/signal/?practice=independent"'));}finally{m.close();}
});
function node(){
 const children=new Map(),handlers={};
 return {handlers,innerHTML:'',textContent:'',value:'',dataset:{},disabled:false,scrollWidth:0,clientWidth:0,
  classList:{toggle(){}},setAttribute(){},removeAttribute(){},getBoundingClientRect:()=>({top:0,bottom:1}),focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;},
  querySelector(selector){if(!children.has(selector))children.set(selector,node());return children.get(selector);},querySelectorAll:()=>[],
  addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(){}};
}
function setup(model={},mobile=false){
 const saved={document:globalThis.document,innerHeight:globalThis.innerHeight,matchMedia:globalThis.matchMedia};
 globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};globalThis.innerHeight=900;globalThis.matchMedia=()=>({matches:mobile});
 const root=node();let writes=0;
 const page=mountGuide(root,{experimentText:catalog.causalExperiments,beginner:catalog.beginner,text:catalog.guideStudio,legacy:catalog.guide,errors:catalog.ui,ui:catalog.ui,model,reduced:{matches:true},onChange:()=>writes++,urls:{home:'/zh/',guide:'/zh/guide/',compare:'/zh/guide/compare/',check:'/zh/guide/check/',map:'/zh/guide/map/',dispatch:'/zh/play/dispatch/',lesson:id=>'/zh/learn/'+id+'/'}});
 return {root,model,writes:()=>writes,page,
  edit(id,value){root.querySelector('#'+id).value=value;root.handlers.input({target:{id,value}});},
  silent(checked){root.handlers.input({target:{id:'guide-silent',checked}});},
  submit(){root.handlers.submit({target:{id:'guide-form'},preventDefault(){}});},
  click(dataset){root.handlers.click({target:{closest:()=>({dataset})}});},
  kind:()=>root.querySelector('.guide-prediction-result').dataset.kind,
  close(){page.dispose();Object.assign(globalThis,saved);}};
}
test('a prediction is captured at run time; changing it cannot retroactively match the observed run',()=>{
 const m=setup();try{
  m.edit('guide-editor','(4 + 5).log()');const writes=m.writes();
  m.edit('guide-prediction','7');assert.equal(m.writes(),writes);m.submit();assert.equal(m.kind(),'different');
  assert.deepEqual(m.model.reports.signal.prediction,['7']);
  m.edit('guide-prediction','9');assert.equal(m.kind(),'changed');assert.deepEqual(m.model.reports.signal.prediction,['7']);
  m.submit();assert.equal(m.kind(),'matched');assert.deepEqual(m.model.reports.signal.prediction,['9']);
  m.edit('guide-editor','10.log()');assert.equal(m.kind(),'ready');assert.equal(m.model.reports.signal,undefined);
  m.submit();assert.equal(m.kind(),'different');
 }finally{m.close();}
});
test('blank skips prediction, deliberate silence compares empty output, and unfinished work never matches',()=>{
 const m=setup();try{
  m.edit('guide-editor','let n = 3;');m.submit();assert.equal(m.kind(),'ready');
  m.silent(true);assert.equal(m.kind(),'changed');assert.equal(m.root.querySelector('#guide-prediction').disabled,true);
  m.submit();assert.equal(m.kind(),'matched');assert.ok(m.root.querySelector('.guide-prediction-result').innerHTML.includes(catalog.guideStudio.prediction.silentMatched));
  m.edit('guide-editor','let pending; ?(n <- pending) { n.log() }');m.submit();assert.equal(m.kind(),'waiting');
  m.edit('guide-editor','unknown.log()');m.submit();assert.equal(m.kind(),'error');
  m.silent(false);assert.equal(m.root.querySelector('#guide-prediction').disabled,false);
 }finally{m.close();}
});
test('predictions stay with their station, survive a view remount, and reset only with its example',()=>{
 const model={},m=setup(model);try{
  m.edit('guide-prediction','<img src=x>');m.edit('guide-editor','7.log()');m.submit();
  assert.ok(m.root.querySelector('.guide-prediction-result').innerHTML.includes('&lt;img src=x&gt;'));
  m.click({concept:'repeat'});assert.equal(m.kind(),'ready');m.edit('guide-prediction','2\n4\n6');
  m.click({concept:'signal'});assert.equal(model.predictions.signal.raw,'<img src=x>');assert.equal(m.kind(),'different');
 }finally{m.close();}
 const remount=setup(model);try{
  assert.equal(remount.kind(),'different');remount.click({guide:'reset'});
  assert.equal(model.predictions.signal,undefined);assert.equal(model.reports.signal,undefined);assert.equal(model.predictions.repeat.raw,'2\n4\n6');
 }finally{remount.close();}
});
test('on mobile a comparison is revealed after running, while skipped predictions and errors reveal actual observations',()=>{
 const m=setup({},true);try{
  m.edit('guide-editor','7.log()');m.edit('guide-prediction','9');m.submit();
  assert.equal(m.root.querySelector('.guide-prediction-result').scrolled,true);assert.equal(m.root.querySelector('.guide-observation').scrolled,undefined);
  m.root.querySelector('.guide-prediction-result').scrolled=false;m.edit('guide-prediction','');m.submit();assert.equal(m.root.querySelector('.guide-observation').scrolled,true);
  m.root.querySelector('.guide-observation').scrolled=false;m.edit('guide-prediction','7');m.edit('guide-editor','unknown.log()');m.submit();assert.equal(m.root.querySelector('.guide-observation').scrolled,true);
 }finally{m.close();}
});

test('a first-time reader gets an action, literal result and optional next idea, without awards',()=>{
 const model={},m=setup(model);try{
  assert.equal(m.root.querySelector('[data-guide-first-step]').textContent,catalog.beginner.first);
  const untouched=JSON.stringify(model);m.click({guide:'begin'});assert.equal(m.root.querySelector('#guide-editor').focused,true);assert.equal(m.root.querySelector('#guide-editor').scrolled,true);assert.equal(JSON.stringify(model),untouched);
  assert.equal(m.root.querySelector('[data-guide-forward]').hidden,true);
  assert.ok(m.root.innerHTML.includes('guide-catalog"><summary>'));
  assert.ok(m.root.innerHTML.indexOf('class="guide-run-row"')<m.root.innerHTML.indexOf('class="guide-prediction"'));
  m.edit('guide-editor','7.log()');m.submit();assert.equal(m.root.querySelector('[data-guide-first-step]').textContent,catalog.beginner.change);
  assert.equal(m.root.querySelector('[data-guide-forward]').hidden,false);assert.equal(m.root.querySelector('[data-guide-forward]').dataset.concept,'addition');
  m.edit('guide-editor','9.log()');assert.equal(m.root.querySelector('[data-guide-forward]').hidden,true);m.submit();
  assert.equal(m.root.querySelector('[data-guide-first-step]').textContent,catalog.beginner.result.replace('{value}','9'));
  m.edit('guide-editor','unknown.log()');m.submit();assert.equal(m.root.querySelector('[data-guide-forward]').hidden,true);
  assert.equal(model.completed,undefined);assert.equal(model.grades,undefined);
  m.click({concept:'addition'});assert.equal(m.root.querySelector('#guide-editor').focused,true);
 }finally{m.close();}
});

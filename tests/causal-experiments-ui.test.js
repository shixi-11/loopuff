import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountCausalExperiment} from '../src/causal-experiments-ui.js';
import {locales} from '../src/course.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url),'utf8'));
function mount(kind,model={}){
 const handlers={},nodes=new Map(),root={innerHTML:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:''});return nodes.get(selector);},addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener:(name,fn)=>{if(handlers[name]===fn)delete handlers[name];}};
 const view=mountCausalExperiment(root,{kind,text:catalog.causalExperiments,ownLabel:catalog.guideStudio.editor,errors:catalog.ui,model});
 return {view,root,handlers,number:(key,value)=>handlers.input({target:{dataset:{causalNumber:key},value}}),send:(key,checked)=>handlers.input({target:{dataset:{causalSend:key},checked}}),run:()=>handlers.click({target:{closest:()=>true}})};
}
test('example edits invalidate only their own observation and remounts keep the settings',()=>{
 const model={drafts:{function:'9.log()',join:''},predictions:{function:{raw:'9',silent:false}}},work=JSON.stringify(model),m=mount('function',model);
 try{
  m.run();assert.equal(model.causal.function.report.result.logs[0],'7');assert.ok(m.root.querySelector('[data-causal-result]').innerHTML.includes('combine(3, 4)'));
  m.number('a','8');assert.equal(model.causal.function.report,null);assert.equal(m.root.querySelector('[data-causal-result]').innerHTML,'');assert.ok(m.root.querySelector('[data-causal-source]').textContent.includes('combine(8, 4)'));
  m.run();assert.equal(model.causal.function.report.result.logs[0],'12');
  const {causal,...existing}=model;assert.equal(JSON.stringify(existing),work);assert.equal(model.completed,undefined);assert.equal(model.grades,undefined);
 }finally{m.view.dispose();}
 assert.deepEqual(m.handlers,{});
 const again=mount('function',model);try{assert.equal(model.causal.function.settings.a,'8');assert.ok(again.root.querySelector('[data-causal-result]').innerHTML.includes('12'));}finally{again.view.dispose();}
});
test('one and two report trials run fresh displayed source and keep separate observations',()=>{
 const model={},m=mount('join',model);try{
  m.run();assert.equal(model.causal.join.report.result.waiting,1);assert.equal(m.root.querySelector('[data-causal-status]').textContent,catalog.causalExperiments.waiting);
  m.send('east',true);assert.equal(model.causal.join.report,null);assert.equal(m.root.querySelector('[data-causal-result]').innerHTML,'');m.run();
  assert.equal(model.causal.join.report.result.waiting,0);assert.deepEqual(model.causal.join.report.result.logs,['10']);assert.equal(m.root.querySelector('[data-causal-status]').textContent,catalog.causalExperiments.done);
  m.number('b','2');m.run();assert.deepEqual(model.causal.join.report.result.logs,['6']);
  m.number('b','1e2');m.run();assert.equal(model.causal.join.report,null);assert.equal(m.root.querySelector('[data-causal-status]').textContent,catalog.causalExperiments.invalid);assert.equal(m.root.querySelector('[data-causal-source]').textContent,'');
 }finally{m.view.dispose();}
});
test('all locales contain exactly the same experiment labels',()=>{
 const keys=Object.keys(catalog.causalExperiments).sort();for(const [locale]of locales){const copy=JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url),'utf8')).causalExperiments;assert.deepEqual(Object.keys(copy).sort(),keys,locale);assert.ok(Object.values(copy).every(value=>typeof value==='string'&&value.trim()),locale);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountTeaching,teachingIntroduction,teachingReading} from '../src/teaching-ui.js';
import {course,locales} from '../src/course.js';

function fixture(text){
 const handlers={},nodes=new Map(),examples=['bare','log'].map(teachExample=>({dataset:{teachExample},setAttribute(){}})),tokens=['value','dot','operation','call'].map(teachToken=>({dataset:{teachToken},setAttribute(){}}));
 const root={contains:()=>true,querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',value:'7',reportValidity:()=>true});return nodes.get(selector);},querySelectorAll:selector=>selector==='[data-teach-example]'?examples:tokens,addEventListener:(id,fn)=>handlers[id]=fn,removeEventListener:id=>delete handlers[id]};
 const view=mountTeaching(root,text);
 const click=(dataset={},run=false)=>handlers.click({target:{closest:()=>({dataset,hasAttribute:()=>run})}});
 return {root,nodes,handlers,view,click};
}

test('the first experiment really distinguishes a value from an output operation and invalidates changed results',()=>{
 const text=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url))).teaching,m=fixture(text),el=selector=>m.root.querySelector(selector);
 m.click({},true);assert.equal(el('[data-teach-output]').textContent,'7');assert.equal(el('[data-teach-status]').textContent,text.ran);
 m.click({teachExample:'bare'});assert.equal(el('[data-teach-output]').textContent,'');assert.equal(el('[data-teach-source]').textContent,'7');
 m.click({},true);assert.equal(el('[data-teach-output]').textContent,'');assert.equal(el('[data-teach-status]').textContent,text.noOutput);
 el('#teaching-value').value='12';m.handlers.input({target:{id:'teaching-value'}});assert.equal(el('[data-teach-status]').textContent,text.changed);
 m.click({teachExample:'log'});m.click({},true);assert.equal(el('[data-teach-output]').textContent,'12');
 m.click({teachToken:'call'});assert.equal(el('#teaching-token-help').textContent,text.callText);assert.equal(el('[data-teach-output]').textContent,'12','reading a symbol does not change the executed program');
 el('#teaching-value').value='1e1';m.handlers.input({target:{id:'teaching-value'}});m.click({},true);assert.equal(el('[data-teach-output]').textContent,'10','valid number-field notation becomes a Tolang integer literal');
 el('#teaching-value').reportValidity=()=>false;el('#teaching-value').value='';m.handlers.input({target:{id:'teaching-value'}});m.click({},true);assert.equal(el('[data-teach-output]').textContent,'');
 m.view.dispose();assert.deepEqual(Object.keys(m.handlers),[]);
});

test('every locale explains the six beginning steps and each executable course program',()=>{
 let shape;
 const keys=value=>Object.keys(value).sort();
 for(const [locale]of locales){
  const text=JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url))).teaching;
  assert.ok(text,locale);shape??=keys(text);assert.deepEqual(keys(text),shape,locale);
  assert.deepEqual(keys(text.steps),['calculate','change','decide','name','repair','run']);
  assert.deepEqual(keys(text.lessons),course.map(item=>item.id).sort());
  for(const value of [...Object.values(text.steps),...Object.values(text.lessons)])assert.ok(value.trim().length>0,locale);
  assert.ok(teachingIntroduction(text).includes('data-teach-run'));assert.ok(teachingReading(text,'function').includes(text.lessons.function));
 }
});

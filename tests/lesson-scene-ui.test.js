import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountLessonScene} from '../src/lesson-scene-ui.js';
import {course,locales} from '../src/course.js';
const catalog=JSON.parse(await readFile(new URL('../public/locales/zh.json',import.meta.url),'utf8'));
function mount(source,{locked=false}={}){
 let reads=0;const handlers={},nodes=new Map(),root={innerHTML:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:'',dataset:{},hidden:false,setAttribute(){},closest(){return this;}});return nodes.get(selector);},querySelectorAll:()=>[],addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(){}};
 const original=Object.getOwnPropertyDescriptor(globalThis,'document'),events={};Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,addEventListener:(name,fn)=>events[name]=fn,removeEventListener(){}}});
 const page=mountLessonScene(root,{text:catalog.lessonScene,errors:catalog.ui,expected:['18'],getSource:()=>{reads++;return source;},locked,reduced:{matches:false}});
 return {root,page,reads:()=>reads,setSource(value){source=value;},click(dataset){handlers.click({target:{closest:()=>({dataset})}});},hide(){document.hidden=true;events.visibilitychange();},restore(){page.dispose();if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;}};
}
test('scene replay changes the observed prefix without rerunning code; editing clears old output and source highlights',()=>{
 const m=mount(course.at(-1).source);try{
  m.page.run({end:true});const before=m.reads();assert.ok(m.root.querySelector('[data-scene-output]').innerHTML.includes('18'));assert.equal(m.root.querySelector('[data-scene-match]').textContent,catalog.lessonScene.matched);
  m.click({sceneAction:'start'});assert.ok(!m.root.querySelector('[data-scene-output]').innerHTML.includes('18'));m.click({sceneAction:'end'});assert.equal(m.reads(),before);
  m.setSource('9.log()');m.page.reset();assert.equal(m.root.querySelector('[data-scene-source]').innerHTML,'9.log()');assert.ok(!m.root.querySelector('[data-scene-output]').innerHTML.includes('18'));assert.ok(!m.root.querySelector('[data-scene-source]').innerHTML.includes('<mark>'));
 }finally{m.restore();}
});
test('scene shows actual pending messages and errors instead of completing an ideal program',()=>{
 const m=mount('let a; let b; { a ! 6 | ?(x <- a & y <- b) { (x+y).log() } }');try{
  m.page.run({end:true});assert.ok(m.root.querySelector('[data-scene-input]').innerHTML.includes('6'));assert.equal(m.root.querySelector('[data-scene-status]').textContent,catalog.lessonScene.waiting.replace('{number}',1));assert.equal(m.root.querySelector('[data-scene-match]').textContent,'');
  m.setSource('7.log(); (1/0).log()');m.page.run({end:true});assert.ok(m.root.querySelector('[data-scene-output]').innerHTML.includes('7'));assert.ok(m.root.querySelector('[data-scene-status]').textContent.includes(catalog.ui.zeroDivision));assert.equal(m.root.querySelector('[data-scene-status]').dataset.error,'true');
 }finally{m.restore();}
});
test('locked previews never execute; hidden pages stop replay; received lists retain their value',()=>{
 const locked=mount('7.log()',{locked:true});try{const before=locked.reads();assert.ok(!locked.root.innerHTML.includes('<code dir="ltr">18</code>'));locked.page.run();assert.equal(locked.reads(),before);assert.equal(locked.root.querySelector('[data-scene-status]').textContent,catalog.lessonScene.locked);}finally{locked.restore();}
 const m=mount('let box; { box ! [1,2] | ?(x <- box) { x.log() } }');try{
  m.page.run({end:true});m.click({sceneEvent:'4'});assert.equal(m.root.querySelector('[data-scene-operation]').textContent,'x = [1, 2]');
  m.click({sceneAction:'play'});m.hide();assert.equal(m.root.querySelector('[data-scene-action="play"]').textContent,catalog.lessonScene.play);
 }finally{m.restore();}
});
test('eleven locales include exactly the same scene event vocabulary and placeholders',async()=>{
 const shape=v=>v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,shape(v[k])])):typeof v;
 const tokens=v=>(JSON.stringify(v).match(/\{(?:number|total|name)\}/g)||[]).sort();
 for(const [id]of locales){const copy=JSON.parse(await readFile(new URL(`../public/locales/${id}.json`,import.meta.url),'utf8')).lessonScene;assert.deepEqual(shape(copy),shape(catalog.lessonScene),id);assert.deepEqual(tokens(copy),tokens(catalog.lessonScene),id);}
});

test('a truncated replay prefix stays separate from the full run error or final waiting state',()=>{
 const m=mount('for n in 0..200 { (n+1).log() }; (1/0).log()');try{
  m.page.run({end:true});assert.equal(m.root.querySelector('[data-scene-status]').textContent,catalog.lessonScene.truncated);assert.equal(m.root.querySelector('[data-scene-final-status]').textContent,catalog.ui.zeroDivision);assert.equal(m.root.querySelector('[data-scene-full-output]').textContent.split('\n').length,200);assert.ok(m.root.querySelector('[data-scene-final-source]').innerHTML.includes('<mark>'));
  assert.ok(!m.root.querySelector('[data-scene-source]').innerHTML.includes('<mark>1</mark>/0'));
  m.setSource('let box; { for n in 0..200 { (n+1).log() } | ?(x <- box) { x.log() } }');m.page.run({end:true});assert.equal(m.root.querySelector('[data-scene-status]').textContent,catalog.lessonScene.truncated);assert.equal(m.root.querySelector('[data-scene-final-status]').textContent,catalog.lessonScene.waiting.replace('{number}',1));
 }finally{m.restore();}
});

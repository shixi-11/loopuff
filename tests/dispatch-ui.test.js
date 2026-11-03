import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountDispatch} from '../src/dispatch-ui.js';
import {newDispatch,dispatchPuzzle} from '../src/dispatch.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url)));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function node(){
 const children=new Map(),handlers={};return {handlers,innerHTML:'',textContent:'',value:'',open:false,
  querySelector(selector){if(!children.has(selector))children.set(selector,node());return children.get(selector);},
  addEventListener:(type,fn)=>handlers[type]=fn,removeEventListener(){},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}};
}
test('dispatch repair feedback follows selection, opens the actual trace and preserves old awards and source',async()=>{
 const original=globalThis.localStorage,values=new Map(),key='loopuff-dispatch-v1';
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const saved=newDispatch(0);saved.selected='branch';saved.stamps=['manifest'];saved.cleared=['manifest'];saved.rounds=3;
 saved.drafts.manifest='for dock in docks { if dock == 4 then { 5.log() } else { (dock + offset).log() } }';saved.submitted.manifest=saved.drafts.manifest;
 values.set(key,JSON.stringify(saved));const root=node();
 const selections=[],options={text:catalog.dispatch,errors:catalog.ui,concepts:catalog.assessment.concepts,reduced:{matches:true},urls:{home:'/zh/',play:'/zh/play/',homeLabel:'首页',playLabel:'游乐场',lessons:['/branch','/repeat','/function','/coordination']}};
 const page=mountDispatch(root,{...options,initialMission:'manifest',onSelect:id=>selections.push(id)});
 const click=dataset=>root.handlers.click({target:{closest:()=>({dataset})}});
 const submit=source=>{root.querySelector('#dispatch-editor').value=source;root.handlers.input({target:{id:'dispatch-editor',value:source}});root.handlers.submit({target:{matches:()=>true},preventDefault(){}});};
 try{
  await tick();assert.deepEqual(JSON.parse(values.get(key)),{...saved,selected:'manifest'});assert.deepEqual(selections,['manifest']);
  assert.ok(root.innerHTML.includes(catalog.dispatch.repair.contribution.replace('{number}','1')));
  assert.ok(root.innerHTML.includes('data-dispatch-trace-output="0"'));assert.ok(root.innerHTML.includes('5.log() → 5'));
  const before=values.get(key);click({dispatchAction:'inspect'});
  assert.equal(root.querySelector('.dispatch-trace').open,true);assert.equal(root.querySelector('[data-dispatch-trace-output="0"]').focused,true);assert.equal(root.querySelector('[data-dispatch-trace-output="0"]').scrolled,true);
  await tick();assert.equal(values.get(key),before);
  root.handlers.change({target:{id:'dispatch-batch',value:'0'}});assert.ok(!root.querySelector('[data-dispatch-preview]').innerHTML.includes('dispatch-repair-title'));
  root.handlers.change({target:{id:'dispatch-batch',value:'3'}});assert.ok(root.querySelector('[data-dispatch-preview]').innerHTML.includes(catalog.dispatch.repair.contribution.replace('{number}','1')));
  submit(dispatchPuzzle(0,'manifest').example+';let pending;?(x <- pending){x.log()}');await tick();
  assert.ok(root.innerHTML.includes(catalog.dispatch.repair.waiting));assert.ok(!root.innerHTML.includes('data-dispatch-action="inspect"'));
  let stored=JSON.parse(values.get(key));assert.deepEqual(stored.stamps,['manifest']);assert.deepEqual(stored.cleared,['manifest']);assert.equal(stored.rounds,3);
  submit('for dock in docks { (offset + dock).log() }');await tick();
  assert.ok(root.innerHTML.includes('data-ok="true"'));assert.ok(!root.innerHTML.includes('dispatch-repair-title'));stored=JSON.parse(values.get(key));assert.equal(stored.rounds,3);assert.equal(stored.stamps.length,1);
  click({dispatchMission:'branch'});const p=dispatchPuzzle(0,'branch');submit('if cargo <= threshold then { 1.log() } else { 2.log() }');await tick();
  assert.ok(root.innerHTML.includes(catalog.dispatch.repair.boundary));
  root.handlers.input({target:{id:'dispatch-editor',value:''}});await tick();
  assert.ok(!root.querySelector('[data-dispatch-preview]').innerHTML.includes('dispatch-repair-title'));assert.equal(JSON.parse(values.get(key)).drafts.branch,'');
  assert.deepEqual(selections,['manifest','branch']);
  const beforeUnknown=values.get(key),invalid=mountDispatch(node(),{...options,initialMission:'unknown'});await tick();invalid.dispose();assert.equal(values.get(key),beforeUnknown);
 }finally{await tick();page.dispose();globalThis.localStorage=original;}
});

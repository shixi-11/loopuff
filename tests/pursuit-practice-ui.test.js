import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newPursuit,pausePursuit,savePursuit} from '../src/pursuit.js';
import {createPursuitSession,pursuitKey} from '../src/pursuit-session.js';
import {persistPursuitPractice} from '../src/pursuit-practice.js';
import {mountPursuitPractice} from '../src/pursuit-practice-ui.js';
import {locales} from '../src/course.js';
const copy=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url),'utf8')).pursuitPractice;
function setup(world=newPursuit(4),model={},onStage=()=>true){
 const handlers={},nodes=new Map(),root={innerHTML:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',disabled:false,hidden:false});return nodes.get(selector);},addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener:(key,fn)=>{if(handlers[key]===fn)delete handlers[key];}};
 let stages=0,allowed=true;const view=mountPursuitPractice(root,{text:copy,errors:{limit:'limit'},model,getWorld:()=>world,pause:()=>pausePursuit(world),canStage:()=>allowed,onStage:previous=>{stages++;return onStage(previous);}});
 return {view,model,root,world,handlers,stages:()=>stages,allow:value=>allowed=value,click:action=>handlers.click({target:{closest:()=>({dataset:{pursuitPractice:action}})}}),edit:value=>handlers.input({target:{id:'pursuit-practice-editor',value}})};
}
test('scratch UI checks, edits, confirmation and cancel preserve existing work until explicit staging',async()=>{
 const world=newPursuit(4);world.draft='(1 + 1).log()';const original=structuredClone(world),model={},m=setup(world,model);
 try{
  assert.equal(m.root.querySelector('[data-pursuit-practice="stage"]').disabled,true);m.click('check');assert.equal(model.practice.report.ready,true);assert.deepEqual(world,original);
  m.click('stage');assert.equal(model.practice.notice,'replace');assert.deepEqual(world,original);assert.equal(m.stages(),0);
  m.click('cancel');assert.equal(model.practice.confirmation,null);assert.deepEqual(world,original);
  await m.click('stage');await m.click('stage');assert.equal(m.stages(),1);assert.deepEqual(world,{...original,draft:model.practice.source});assert.equal(model.practice.report,null);
  m.click('check');m.edit('1.log()');assert.equal(model.practice.report,null);assert.equal(m.root.querySelector('[data-pursuit-practice-result]').innerHTML,'');assert.equal(m.root.querySelector('[data-pursuit-practice="stage"]').disabled,true);
 }finally{m.view.dispose();}assert.deepEqual(m.handlers,{});
 const remount=setup(world,model);try{assert.equal(model.practice.source,'1.log()');assert.ok(remount.root.innerHTML.includes('>1.log()</textarea>'));}finally{remount.view.dispose();}
});
test('invalid action numbers and empty output explain the action protocol rather than a runtime limit',()=>{
 const m=setup();try{for(const source of ['9.log()','']){m.edit(source);m.click('check');assert.ok(m.model.practice.report.cases.every(item=>item.report.code==='signals'));const shown=m.root.querySelector('[data-pursuit-practice-result]').innerHTML;assert.ok(shown.includes(copy.signalError));assert.ok(!shown.includes('limit'));assert.equal(m.root.querySelector('[data-pursuit-practice="stage"]').disabled,true);}}finally{m.view.dispose();}
});
test('adoption save failure restores the previous draft and withdraws the success message',async()=>{
 const original=newPursuit(4);original.draft='(1 + 1).log()';const raw=JSON.stringify(savePursuit(original)),store=new Map([[pursuitKey,raw]]),storage={getItem:key=>store.get(key)??null,setItem(){throw Error('quota');}};
 const session=createPursuitSession({storage,access:{write:async operation=>operation()}}),model={};let m;
 m=setup(session.world,model,previous=>persistPursuitPractice(session,session.world,model.practice.source,previous));
 try{assert.notEqual(session.world.draft,'1.log()');assert.equal(storage.getItem(pursuitKey),raw);await m.click('check');await m.click('stage');await m.click('stage');assert.equal(session.saveFailed,true);assert.equal(model.practice.pending,false);assert.equal(model.practice.notice,'saveError');assert.deepEqual(session.world,original);assert.equal(storage.getItem(pursuitKey),raw);assert.equal(m.root.querySelector('[data-pursuit-practice-status]').textContent,copy.saveError);}finally{m.view.dispose();}
});
test('a pending adoption blocks a second operation and a failed write cannot roll back a later edit',async()=>{
 const jobs=[],session=createPursuitSession({storage:{getItem:()=>null,setItem(){}},access:{write:()=>new Promise((resolve,reject)=>jobs.push({resolve,reject}))},createWorld:()=>newPursuit(6)}),model={};let m;
 m=setup(session.world,model,previous=>persistPursuitPractice(session,session.world,model.practice.source,previous));
 try{
  m.click('check');const operation=m.click('stage');assert.equal(model.practice.pending,true);assert.equal(jobs.length,1);const candidate=model.practice.source;m.edit('9.log()');m.click('check');await m.click('stage');assert.equal(model.practice.source,candidate);assert.equal(m.stages(),1);assert.equal(m.root.querySelector('#pursuit-practice-editor').disabled,true);
  session.world.draft='3.log()';jobs.shift().reject(Error('quota'));await operation;assert.equal(session.world.draft,'3.log()');assert.equal(model.practice.notice,'saveError');assert.equal(model.practice.pending,false);
 }finally{m.view.dispose();}
});
test('a successfully saved adoption retains the run and deployed policy in the real save roundtrip',async()=>{
 const store=new Map(),session=createPursuitSession({storage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)},access:{write:async operation=>operation()},createWorld:()=>newPursuit(9)}),model={};session.world.draft='2.log()';const before=structuredClone(session.world);let m;
 m=setup(session.world,model,previous=>persistPursuitPractice(session,session.world,model.practice.source,previous));
 try{await m.click('check');await m.click('stage');await m.click('stage');assert.equal(model.practice.notice,'staged');assert.equal(model.practice.pending,false);assert.equal(session.saveFailed,false);assert.deepEqual(session.world,{...before,draft:model.practice.source});const stored=JSON.parse(store.get(pursuitKey));assert.deepEqual(stored,savePursuit(session.world));assert.equal(stored.current.strategy,before.strategy);assert.equal(stored.current.activeMs,before.activeMs);assert.equal(stored.current.id,before.id);}finally{m.view.dispose();}
});
test('a remounted view unlocks its scratch editor and shows a save failure after the old view closes',async()=>{
 const jobs=[],session=createPursuitSession({storage:{getItem:()=>null,setItem(){}},access:{write:()=>new Promise((resolve,reject)=>jobs.push({resolve,reject}))},createWorld:()=>newPursuit(8)}),model={};let first;
 first=setup(session.world,model,previous=>persistPursuitPractice(session,session.world,model.practice.source,previous));first.click('check');const operation=first.click('stage');assert.equal(model.practice.pending,true);first.view.dispose();
 const second=setup(session.world,model);try{
  assert.equal(second.root.querySelector('#pursuit-practice-editor').disabled,true);jobs.shift().reject(Error('quota'));await operation;assert.equal(session.saveFailed,true);assert.equal(model.practice.pending,false);assert.equal(model.practice.notice,'saveError');second.allow(false);second.view.refresh();assert.equal(second.root.querySelector('[data-pursuit-practice-status]').textContent,copy.saveError);assert.equal(second.root.querySelector('#pursuit-practice-editor').disabled,false);assert.equal(second.root.querySelector('[data-pursuit-practice="check"]').disabled,false);assert.equal(second.root.querySelector('[data-pursuit-practice="stage"]').disabled,true);assert.equal(session.world.draft,'1.log()');
 }finally{second.view.dispose();}
});
test('world and save changes revoke adoption without repainting unchanged observations on every HUD update',()=>{
 const m=setup();try{
  m.click('check');const result=m.root.querySelector('[data-pursuit-practice-result]');result.innerHTML='focus marker';m.view.refresh();assert.equal(result.innerHTML,'focus marker');
  m.world.actors.police.energy=20;const before=structuredClone(m.world);m.view.refresh();assert.equal(m.model.practice.report,null);assert.equal(result.innerHTML,'');m.click('stage');assert.deepEqual(m.world,before);assert.equal(m.stages(),0);
  m.click('check');assert.equal(m.model.practice.report.ready,true);m.allow(false);m.view.refresh();assert.equal(m.root.querySelector('[data-pursuit-practice="stage"]').disabled,true);m.click('stage');assert.equal(m.model.practice.notice,'unavailable');assert.deepEqual(m.world,before);
  m.allow(true);m.world.draft='2.log()';m.click('check');m.click('stage');assert.ok(m.model.practice.confirmation);m.world.draft='3.log()';m.click('stage');assert.equal(m.model.practice.notice,'stale');assert.equal(m.world.draft,'3.log()');assert.equal(m.stages(),0);
 }finally{m.view.dispose();}
});
test('all locales expose the same novice input and adoption labels',()=>{
 for(const [locale]of locales){const labels=JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url),'utf8')).pursuitPractice;assert.deepEqual(Object.keys(labels).sort(),Object.keys(copy).sort(),locale);assert.ok(Object.values(labels).every(value=>typeof value==='string'&&value.trim()),locale);assert.ok(labels.gapNote.includes('gap'),locale);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newPursuit,pausePursuit} from '../src/pursuit.js';
import {mountPursuitPractice} from '../src/pursuit-practice-ui.js';
import {locales} from '../src/course.js';
const copy=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url),'utf8')).pursuitPractice;
function setup(world=newPursuit(4),model={}){
 const handlers={},nodes=new Map(),root={innerHTML:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',disabled:false,hidden:false});return nodes.get(selector);},addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener:(key,fn)=>{if(handlers[key]===fn)delete handlers[key];}};
 let stages=0,allowed=true;const view=mountPursuitPractice(root,{text:copy,errors:{limit:'limit'},model,getWorld:()=>world,pause:()=>pausePursuit(world),canStage:()=>allowed,onStage:()=>stages++});
 return {view,model,root,world,handlers,stages:()=>stages,allow:value=>allowed=value,click:action=>handlers.click({target:{closest:()=>({dataset:{pursuitPractice:action}})}}),edit:value=>handlers.input({target:{id:'pursuit-practice-editor',value}})};
}
test('scratch UI checks, edits, confirmation and cancel preserve existing work until explicit staging',()=>{
 const world=newPursuit(4);world.draft='(1 + 1).log()';const original=structuredClone(world),model={},m=setup(world,model);
 try{
  assert.equal(m.root.querySelector('[data-pursuit-practice="stage"]').disabled,true);m.click('check');assert.equal(model.practice.report.ready,true);assert.deepEqual(world,original);
  m.click('stage');assert.equal(model.practice.notice,'replace');assert.deepEqual(world,original);assert.equal(m.stages(),0);
  m.click('cancel');assert.equal(model.practice.confirmation,null);assert.deepEqual(world,original);
  m.click('stage');m.click('stage');assert.equal(m.stages(),1);assert.deepEqual(world,{...original,draft:model.practice.source});assert.equal(model.practice.report,null);
  m.click('check');m.edit('1.log()');assert.equal(model.practice.report,null);assert.equal(m.root.querySelector('[data-pursuit-practice-result]').innerHTML,'');assert.equal(m.root.querySelector('[data-pursuit-practice="stage"]').disabled,true);
 }finally{m.view.dispose();}assert.deepEqual(m.handlers,{});
 const remount=setup(world,model);try{assert.equal(model.practice.source,'1.log()');assert.ok(remount.root.innerHTML.includes('>1.log()</textarea>'));}finally{remount.view.dispose();}
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

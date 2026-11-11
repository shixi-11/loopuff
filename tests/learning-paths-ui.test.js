import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountStartPath,mountAdvancePath,pathEntrances} from '../src/learning-paths-ui.js';
import {startSteps,editStart,checkStart} from '../src/learning-paths.js';
import {startStepIds,startWorkKey} from '../src/guide-work.js';
import {locales} from '../src/course.js';
import {newDiagnostic,diagnosticIds,diagnosticPuzzle,submitDiagnostic} from '../src/diagnostic.js';
import {newDispatch,dispatchPuzzle,submitDispatch} from '../src/dispatch.js';
const copy=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url)));
const urls={guide:'/zh/guide/',start:'/zh/guide/start/',advance:'/zh/guide/advance/',saves:'/zh/saves/',lesson:id=>'/zh/learn/'+id+'/',diagnostic:id=>'/zh/guide/check/?area='+id,project:id=>'/zh/play/dispatch/?mission='+id,compare:'/zh/guide/compare/',compareLabel:'compare'};
function node(){const children=new Map(),handlers={};return {innerHTML:'',textContent:'',hidden:false,disabled:false,value:'',handlers,setAttribute(){},focus(){this.focused=true;},scrollIntoView(){},querySelector(selector){if(!children.has(selector))children.set(selector,node());return children.get(selector);},addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(name){delete handlers[name];}};}
function setup(model={drafts:{}},initialStep='run',save=()=>true){const root=node();let writes=0,selected=null;
 const view=mountStartPath(root,{text:copy.learningPaths,beginner:copy.beginner,guideText:copy.guideStudio,errors:copy.ui,concepts:copy.assessment.concepts,model,initialStep,completed:[],lessons:copy.lessons,urls,onSelect:id=>selected=id,onChange:()=>{writes++;return save();}});
 return {root,model,view,writes:()=>writes,selected:()=>selected,edit(value){root.handlers.input({target:{id:'start-editor',value}});},run(){root.handlers.submit({target:{id:'start-form'},preventDefault(){}});},click(action){root.handlers.click({target:{closest:()=>({dataset:{start:action}})}});},select(value){root.handlers.change({target:{id:'start-step',value}});}};
}
test('the novice can run, edit, repair and continue while old guide drafts and course records stay separate',async()=>{
 const model={drafts:{signal:'123.log()',function:''}},m=setup(model);try{
  assert.ok(m.root.innerHTML.includes(copy.learningPaths.steps.run.goal));assert.equal(m.root.querySelector('[data-start="next"]').hidden,true);
  m.run();await model.startSavePromise;assert.ok(m.root.querySelector('[data-start-result]').innerHTML.includes('<mark>7.log()</mark>'));assert.equal(m.root.querySelector('[data-start="next"]').disabled,false);
  m.click('next');assert.equal(m.selected(),'change');m.edit('9.log()');m.run();await model.startSavePromise;m.click('next');assert.equal(m.selected(),'repair');m.run();await model.startSavePromise;assert.equal(m.root.querySelector('[data-start="next"]').hidden,true);
  m.edit('7.log()');m.run();await model.startSavePromise;assert.equal(model.drafts.signal,'123.log()');assert.equal(model.drafts.function,'');assert.equal(model.completed,undefined);assert.equal(model.grades,undefined);
  m.edit('8.log()');assert.equal(m.root.querySelector('[data-start="next"]').hidden,true);assert.equal(model.drafts['start-repair-checked'],undefined);
 }finally{m.view.dispose();}
});
test('reset requires confirmation and a last-step pass alone cannot claim the whole starter route is finished',async()=>{
 const model={drafts:{}},m=setup(model,'decide');try{
  m.edit(startSteps.at(-1).example);m.run();await model.startSavePromise;assert.equal(m.root.querySelector('[data-start-finished]').hidden,true);
  m.click('reset');assert.equal(model.drafts['start-decide'],startSteps.at(-1).example);m.click('cancel');assert.equal(model.drafts['start-decide'],startSteps.at(-1).example);
  m.click('reset');m.click('reset');assert.equal(model.drafts['start-decide'],startSteps.at(-1).starter);assert.equal(model.drafts['start-decide-checked'],undefined);
 }finally{m.view.dispose();}
});
test('a pending save completing after language remount unlocks the new view, and failure stays visible',async()=>{
 const model={drafts:{}},jobs=[],first=setup(model,'run',()=>new Promise(resolve=>jobs.push(resolve)));first.run();assert.equal(first.root.querySelector('[data-start="next"]').disabled,true);first.view.dispose();
 const second=setup(model);try{
  second.root.querySelector('[data-start-result]').innerHTML='keep the focused situation control';
  jobs.shift()(true);await model.startSavePromise;assert.equal(second.root.querySelector('[data-start="next"]').disabled,false);
  assert.equal(second.root.querySelector('[data-start-result]').innerHTML,'keep the focused situation control');
  second.view.dispose();const third=setup(model,'run',()=>false);try{third.run();await model.startSavePromise;assert.equal(third.root.querySelector('[data-start-save]').textContent,copy.ui.nosave);assert.equal(third.root.querySelector('[data-start="next"]').disabled,true);}finally{third.view.dispose();}
 }finally{second.view.dispose();}
});
test('concept feedback names only the contribution that is actually missing',async()=>{
 const m=setup({drafts:{}},'name');try{m.edit('let energy = 5; (7 + 7).log()');m.run();await m.model.startSavePromise;const status=m.root.querySelector('[data-start-status]').textContent;assert.ok(status.includes(copy.assessment.concepts.name));assert.ok(!status.includes(copy.assessment.concepts.add));}finally{m.view.dispose();}
});
test('both entrances and advanced links describe real existing checks and projects; every catalog matches',()=>{
 assert.ok(pathEntrances(copy.learningPaths,urls).includes('data-action="open-start"'));assert.ok(pathEntrances(copy.learningPaths,urls).includes('data-action="open-advance"'));
 const root=node();mountAdvancePath(root,{text:copy.learningPaths,diagnosticText:copy.diagnostic,dispatchText:copy.dispatch,urls});assert.ok(root.innerHTML.includes('/zh/guide/check/?area=coordination'));assert.ok(root.innerHTML.includes('/zh/play/dispatch/?mission=relay'));
 const shape=value=>Array.isArray(value)?value.map(shape):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,shape(value[key])])):typeof value;
 for(const [locale]of locales){const text=JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url))).learningPaths;assert.deepEqual(shape(text),shape(copy.learningPaths),locale);for(const id of startStepIds)assert.ok(text.steps[id].goal);}
});
test('after real diagnostics pass, the recommendation points to the first project still to do',()=>{
 const diagnostic=newDiagnostic(4),dispatch=newDispatch(4);for(const id of diagnosticIds)submitDiagnostic(diagnostic,id,diagnosticPuzzle(4,id).example);submitDispatch(dispatch,'branch',dispatchPuzzle(4,'branch').example);
 const root=node();mountAdvancePath(root,{text:copy.learningPaths,diagnosticText:copy.diagnostic,dispatchText:copy.dispatch,diagnostic,dispatch,urls});
 assert.ok(root.innerHTML.includes(`<h2>${copy.dispatch.missions[1].title}</h2>`));
 assert.ok(root.innerHTML.includes('href="/zh/play/dispatch/?mission=manifest"'));
});

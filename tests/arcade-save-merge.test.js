import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptySave} from '../server/save-format.mjs';
import {createMergePlan,resolveMerge} from '../src/save-merge.js';
import {arcadeNewStepIds,arcadeWorkKey} from '../src/guide-work.js';
import {mountSaves} from '../src/saves-ui.js';
const snapshot=guideWork=>{const value=emptySave();value.data.course={state:{guideWork}};return value;};

test('merging two course records retains each of the six new arcade draft/check pairs from either side',()=>{
 for(const id of arcadeNewStepIds){
  const pair={[arcadeWorkKey(id)]:'right()',[arcadeWorkKey(id,true)]:'right()'};
  const old={'start-run':'7.log()','start-run-checked':'7.log()',signal:'9.log()'};
  for(const [a,b] of [[snapshot(pair),snapshot(old)],[snapshot(old),snapshot(pair)]]){
   const plan=createMergePlan(a,b);assert.equal(plan.conflicts.length,0);
   assert.deepEqual(resolveMerge(plan).data.course.state.guideWork,{...old,...pair});
   assert.deepEqual(a.data.course.state.guideWork,Object.keys(a.data.course.state.guideWork).includes('signal')?old:pair);
  }
 }
});

test('arcade conflicts require choosing an entire draft/check pair, including a deliberate blank or cleared check',()=>{
 for(const right of [{draft:'left()',checked:'left()'},{draft:'right()'},{draft:''}]){
  const left={draft:'right()',checked:'right()'},pack=value=>Object.fromEntries(Object.entries(value).map(([kind,source])=>[arcadeWorkKey('strategy',kind==='checked'),source]));
  const plan=createMergePlan(snapshot(pack(left)),snapshot(pack(right)));
  assert.equal(plan.conflicts.length,1);const conflict=plan.conflicts[0];
  assert.equal(conflict.kind,'arcade');assert.equal(conflict.item,'strategy');
  assert.throws(()=>resolveMerge(plan),error=>error.code==='SAVE_CHOICES_REQUIRED');
  for(const [side,value] of [['local',left],['incoming',right]])assert.deepEqual(resolveMerge(plan,{[conflict.id]:side}).data.course.state.guideWork,pack(value));
 }
 const same=snapshot({'arcade-score':'0.log()','arcade-score-checked':'0.log()'});
 assert.equal(createMergePlan(same,same).conflicts.length,0);
});

test('save comparison renders the actual new arcade title and retains an explicit unresolved choice',async()=>{
 const catalog=JSON.parse(readFileSync(new URL('../public/locales/zh.json',import.meta.url))),original={};
 const globals={localStorage:{getItem:()=>null},location:{href:'http://127.0.0.1/zh/saves/'},window:{addEventListener(){},removeEventListener(){}}};
 for(const [key,value]of Object.entries(globals)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});}
 const local=snapshot({'arcade-score':'0.log()','arcade-score-checked':'0.log()','start-run':'7.log()','start-run-checked':'7.log()'});
 local.data.course.state.completed=['signal'];
 const plan=createMergePlan(local,snapshot({'arcade-score':'1.log()'}));
 const root={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
 let view;
 try{
  view=mountSaves(root,{text:catalog.saves,arcadeText:catalog.arcadeLearning,pathText:catalog.learningPaths,topics:{course:catalog.ui.navCourse,vault:catalog.vault.title,chase:catalog.chase.title,dispatch:catalog.dispatch.title,pursuit:catalog.pursuit.title,heist:catalog.heist.title},lessons:[],phases:{},account:{user:null},urls:{account:'/account'},locale:'zh',name:'环灵',model:{accountId:null,preview:{mode:'file',plan},choices:{}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(root.innerHTML.includes(catalog.arcadeLearning.steps.score.title));
  assert.ok(root.innerHTML.includes('0.log()'));assert.ok(root.innerHTML.includes('1.log()'));
  assert.ok(root.innerHTML.includes('1 / 11'),'new summary counts genuinely passed work, not failed checked submissions');
  assert.ok(root.innerHTML.includes('1 / 13'),'existing course completion record remains visible');
  assert.ok(!root.innerHTML.includes('undefined'));
  assert.match(root.innerHTML,/data-save-action="confirm" disabled/);
 }finally{view?.dispose();for(const key of Object.keys(globals)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key];}}
});

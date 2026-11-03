import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {beginnerConcept,guideFirstStep,vaultFirstStep} from '../src/beginner.js';
import {guideStations,executeGuide} from '../src/guide.js';
import {newVault,vaultPuzzle,submitVault} from '../src/vault.js';
import {course,locales} from '../src/course.js';
const text=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url),'utf8')).beginner;

test('all existing concepts have distinct plain meanings without making new progress',()=>{
 for(const id of ['signal','addition','names','leap','comparison','branch','repeat','counter','function','reply','message','join','coordination']){
  const c=beginnerConcept(text,id);assert.ok(c.term&&c.meaning&&c.read,id);
 }
 assert.throws(()=>beginnerConcept(text,'unknown'));
});

test('all locales explain the exact curriculum and preserve the dynamic clue placeholders',()=>{
 const placeholders=s=>[...s.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();
 for(const [locale]of locales){
  const t=JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url),'utf8')).beginner;
  assert.deepEqual(Object.keys(t.concepts),course.map(c=>c.id),locale);
  for(const id of course.map(c=>c.id))for(const key of ['term','meaning','read'])assert.ok(t.concepts[id][key].trim(),locale+'/'+id+'/'+key);
  for(const key of ['result','vaultFirst','vaultNames','vaultOrder'])assert.deepEqual(placeholders(t[key]),placeholders(text[key]),locale+'/'+key);
 }
});
test('the first-step prompt follows actual execution and is withdrawn on edit or failure',()=>{
 const s=guideStations[0],example=executeGuide(s.source),changed=executeGuide('9.log()');
 assert.equal(guideFirstStep(text,s,null),text.first);
 assert.equal(guideFirstStep(text,s,{...example,source:s.source}),text.change);
 assert.equal(guideFirstStep(text,s,{...changed,source:'9.log()'}),text.result.replace('{value}','9'));
 assert.equal(guideFirstStep(text,s,{ok:false}),text.first);
 assert.equal(guideFirstStep(text,s,{...executeGuide('let x = 2;'),source:'let x = 2;'}),text.change);
});
test('vault guidance uses actual per-run clues and the existing answer order, preserving the save',()=>{
 const world=newVault(123),before=structuredClone(world);
 for(let stage=0;stage<3;stage++){
  const p=vaultPuzzle(world.seed,stage),note=vaultFirstStep(text,p);
  assert.ok(!/\{\w+\}/.test(note));if(stage<2)assert.ok(note.includes(String(p.b)));
  if(stage===2)for(const value of p.goal.logs)assert.ok(note.includes(value));
  if(stage<2)assert.equal(vaultFirstStep(text,p,'9.log()'),text.vaultSteps[2]);
 }
 assert.deepEqual(world,before);
 const p=vaultPuzzle(world.seed,0);assert.equal(submitVault(world,p.starter).ok,false);assert.equal(submitVault(world,p.example).ok,true);
});

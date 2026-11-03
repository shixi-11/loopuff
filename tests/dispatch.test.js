import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {locales} from '../src/course.js';
import {parseRoute,routeUrl,languageUrl} from '../src/routing.js';
import {dispatchIds,dispatchPuzzle,inspectDispatch,newDispatch,restoreDispatch,editDispatch,submitDispatch,nextDispatchRound} from '../src/dispatch.js';

test('each manifest signal must carry its own calculation, rather than borrow evidence from a neighbouring output',()=>{
 const source='for dock in docks { if dock == 4 then { 5.log() } else { (dock + offset).log() } }';
 const report=inspectDispatch(0,'manifest',source);
 assert.equal(report.ok,false);
 const mixed=report.cases[3];assert.deepEqual(mixed.result.logs,mixed.expected);
 assert.equal(mixed.code,'conceptMissing');assert.equal(mixed.checks.find(c=>c.id==='concepts').requirements.find(c=>c.concept==='add').passed,false);
 assert.equal(inspectDispatch(0,'manifest','for dock in docks { let n = offset + dock; n.log() }').ok,true);
});

test('unfinished programs cannot complete any dispatch mission or award a round despite matching visible logs',()=>{
 for(const id of dispatchIds){
  const state=newDispatch(42),puzzle=dispatchPuzzle(42,id);
  const source=id==='fuel'?'fn fuel(a,b) { return ! (a+b); let pending; ?(n <- pending) { n.log() } }':puzzle.example+'; let pending; ?(n <- pending) { n.log() }';
  const report=submitDispatch(state,id,source);
  assert.equal(report.ok,false,id);assert.equal(report.passed,0,id);assert.equal(report.code,'waiting',id);
  for(const item of report.cases){assert.deepEqual(item.result.logs,item.expected,id);assert.ok(item.result.waiting>0,id);}
  assert.deepEqual(state.cleared,[]);assert.deepEqual(state.stamps,[]);assert.equal(state.rounds,0);assert.equal(state.drafts[id],source);assert.equal(state.submitted[id],source);
 }
});

test('dispatch missions require one program to work across changing inputs',()=>{
 const alternatives={branch:'if cargo >= threshold then { 2.log() } else { 1.log() }',
  manifest:'for place in docks { let target = offset + place; target.log() }',
  fuel:'fn fuel(a,b) { return b+a }',
  relay:'sync fn sum(x,y) { return x+y }; ?(x <- east & y <- west) { let n=sum(x,y); if n <= threshold then { n.log() } else { (reserve+n).log() } }'};
 for(const seed of [0,1,2,42,2147483647,4294967295])for(const id of dispatchIds){
  const puzzle=dispatchPuzzle(seed,id);
  assert.equal(inspectDispatch(seed,id,puzzle.example).ok,true,`${seed}/${id} example`);
  assert.ok(inspectDispatch(seed,id,puzzle.example).cases.every(report=>report.score===100),`${seed}/${id} full report scores`);
  assert.equal(inspectDispatch(seed,id,alternatives[id]).ok,true,`${seed}/${id} different solution`);
  assert.equal(inspectDispatch(seed,id,'1.log()').ok,false,`${seed}/${id} constant answer`);
  assert.deepEqual(dispatchPuzzle(seed,id),puzzle,'same round has stable cases');
 }
});
test('dispatch feedback points to actual outputs and contributing methods',()=>{
 const branch=inspectDispatch(42,'branch','if cargo < threshold then { 1.log() } else { 1.log() }');
 assert.ok(branch.passed>0&&branch.passed<branch.total);
 const failed=branch.cases.find(report=>!report.ok);
 assert.equal(failed.result.logs[0],'1');assert.deepEqual(failed.expected,['2']);
 assert.equal(failed.code,'goalMismatch');
 const source=dispatchPuzzle(42,'fuel').example;
 const fuel=inspectDispatch(42,'fuel',source);
 assert.equal(fuel.cases[0].outputs.length,1);
 const span=fuel.cases[0].outputs[0];assert.equal(span.start,null);assert.match(span.source,/^fuel\(0, \d\).log\(\)$/);
 const player=inspectDispatch(42,'branch',dispatchPuzzle(42,'branch').example).cases[0].outputs[0];
 assert.equal(dispatchPuzzle(42,'branch').example.slice(player.start,player.end),player.source);
 const fake='sync fn sum(a,b) { return a+b }; let one; let two; { one ! 0 | two ! 0 | ?(a <- one & b <- two) { let n=sum(westLoad,eastLoad)+a+b; if n > threshold then { (n+reserve).log() } else { n.log() } } }';
 const relay=inspectDispatch(42,'relay',fake);
 assert.equal(relay.ok,false);assert.ok(relay.cases.every(report=>report.code==='name'));
 const constantReports='sync fn sum(a,b) { return a+b }; let one; let two; { one ! 0 | two ! 0 | ?(a <- one & b <- two) { let n=sum(a,b); if n > threshold then { (n+reserve).log() } else { n.log() } } }';
 assert.equal(inspectDispatch(42,'relay',constantReports).ok,false);
 assert.equal(inspectDispatch(42,'fuel','sync fn fuel(cargo,reserve) { return cargo+3 }').ok,false);
});
test('dispatch rounds retain drafts and milestones without duplicating round completions',()=>{
 let state=newDispatch(7);
 for(const id of dispatchIds){const report=submitDispatch(state,id,dispatchPuzzle(state.seed,id).example);assert.equal(report.ok,true);}
 assert.equal(state.rounds,1);assert.equal(state.stamps.length,4);assert.equal(state.cleared.length,4);
 submitDispatch(state,'relay',state.drafts.relay);assert.equal(state.rounds,1);
 const old=JSON.parse(JSON.stringify(state));
 assert.deepEqual(restoreDispatch(old,99),old);
 const damaged={...old};delete damaged.awarded;
 const recovered=restoreDispatch(damaged,99);submitDispatch(recovered,'relay',recovered.drafts.relay);assert.equal(recovered.rounds,1);
 editDispatch(state,'relay','');assert.equal(state.submitted.relay,null);
 assert.equal(restoreDispatch(state,99).drafts.relay,'');assert.equal(state.stamps.length,4);
 state=nextDispatchRound(state,7);assert.notEqual(state.seed,7);assert.equal(state.rounds,1);
 assert.deepEqual(state.drafts.relay,'');assert.deepEqual(state.cleared,[]);assert.equal(state.stamps.length,4);
 for(const id of dispatchIds)submitDispatch(state,id,dispatchPuzzle(state.seed,id).example);
 assert.equal(state.rounds,2);assert.equal(state.stamps.length,4);
});
test('dispatch restores only known bounded work and rejects stale submissions',()=>{
 assert.deepEqual(restoreDispatch(null,17),newDispatch(17));
 const state=restoreDispatch({version:1,seed:18,selected:'unknown',drafts:{branch:'2.log()',fuel:''},submitted:{branch:'1.log()'},cleared:['branch','branch','other'],stamps:null,rounds:-8,awarded:true},17);
 assert.equal(state.selected,'branch');assert.equal(state.drafts.fuel,'');assert.equal(state.submitted.branch,null);
 assert.deepEqual(state.cleared,['branch']);assert.deepEqual(state.stamps,[]);assert.equal(state.rounds,0);assert.equal(state.awarded,false);
 const result=inspectDispatch(17,'fuel','x'.repeat(3001));assert.equal(result.code,'limit');assert.equal(result.cases.length,0);
 const error=inspectDispatch(17,'fuel','unknown.log()');assert.equal(error.passed,0);assert.ok(error.cases.every(report=>report.code==='name'&&report.position===0));
});

test('dispatch has complete localized controls and direct routes on both hosts',async()=>{
 const source=await readFile(new URL('../src/dispatch-ui.js',import.meta.url),'utf8');
 const keys=[...source.matchAll(/\bt\.([A-Za-z]+)\b/g)].map(match=>match[1]);
 for(const [locale] of locales){
  const catalog=JSON.parse(await readFile(new URL(`../public/locales/${locale}.json`,import.meta.url),'utf8'));
  for(const key of keys)assert.ok(catalog.dispatch[key],`${locale}: ${key}`);
  assert.equal(catalog.dispatch.missions.length,4);
  for(const mission of catalog.dispatch.missions)for(const key of ['title','brief','hint','learned'])assert.ok(mission[key],`${locale}: ${key}`);
  assert.deepEqual(catalog.dispatch.summary.match(/\{\w+\}/g).sort(),['{passed}','{total}']);
  for(const prefix of ['', '/games/loopuff']){
   const path=`${prefix}/${locale}/play/dispatch/`;
   assert.deepEqual(parseRoute(path),{locale,view:'dispatch'});
   assert.equal(routeUrl('https://example.com'+prefix+'/',locale,'dispatch').pathname,path);
   assert.equal(languageUrl('https://example.com'+path,locale).pathname,path);
  }
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave} from '../server/save-format.mjs';
import {createMergePlan,resolveMerge,supportedSave} from '../src/save-merge.js';
import {rememberLesson,lessonWork} from '../src/progress.js';
import {newVault,restoreVault} from '../src/vault.js';
import {newChase,restoreChase} from '../src/chase.js';
import {newDispatch,restoreDispatch,submitDispatch,dispatchPuzzle} from '../src/dispatch.js';
const work=draft=>({phase:'independent',draft,assessedSource:draft,fragment:0,typed:'',score:0,errors:0,keys:0});
const courseSave=(draft,score=100)=>{const saved=emptySave();saved.data.course={lang:'zh',state:{lesson:0,...work(draft),completed:['signal'],lessonWork:{signal:work(draft)},grades:{signal:{score,best:100,attempts:1}}}};return saved;};
const chooseAll=(plan,choice)=>Object.fromEntries(plan.conflicts.map(item=>[item.id,choice]));

test('identical saves and absent games do not invent conflicts or random runs',()=>{
 const saved=courseSave('7.log()'),plan=createMergePlan(saved,saved);
 assert.equal(plan.conflicts.length,0);const merged=resolveMerge(plan);
 assert.equal(merged.data.course.state.draft,'7.log()');assert.equal(merged.data.dispatch,null);assert.equal(merged.data.vault,null);
 const empty=emptySave();assert.deepEqual(resolveMerge(createMergePlan(empty,empty)),empty);
});
test('lesson choices rebuild the current mirror and preserve history without adding counters',()=>{
 const a=courseSave('7.log()',70),b=courseSave('9.log()',90);
 a.data.course.state.phase='pause';a.data.course.state.previousPhase='independent';
 b.data.course.state.completed.push('addition');b.data.course.state.grades.signal.attempts=4;
 const plan=createMergePlan(a,b);assert.equal(plan.conflicts.length,1);assert.throws(()=>resolveMerge(plan),e=>e.code==='SAVE_CHOICES_REQUIRED');
 const merged=resolveMerge(plan,chooseAll(plan,'incoming')).data.course.state;
 assert.equal(merged.draft,'9.log()');assert.equal(merged.previousPhase,'independent');assert.equal(merged.resumePhase,'independent');
 rememberLesson(merged,'signal');assert.equal(lessonWork(merged,'signal').draft,'9.log()');
 assert.deepEqual(merged.grades.signal,{score:90,best:100,attempts:4});assert.deepEqual(merged.completed,['signal','addition']);
 assert.equal(a.data.course.state.draft,'7.log()');assert.equal(b.data.course.state.draft,'9.log()');
});
test('menu mirrors migrate only missing work; unchanged empty drafts remain intentional',()=>{
 const a=courseSave(''),b=courseSave('7.log()');a.data.course.state.phase='welcome';a.data.course.state.draft='stale';
 const plan=createMergePlan(a,b),merged=resolveMerge(plan,chooseAll(plan,'local'));
 assert.equal(merged.data.course.state.draft,'');assert.equal(merged.data.course.state.lessonWork.signal.draft,'');
 const old=courseSave('12.log()');delete old.data.course.state.lessonWork;old.data.course.state.phase='welcome';old.data.course.state.resumePhase='independent';
 const migrated=resolveMerge(createMergePlan(old,courseSave('12.log()')));assert.equal(migrated.data.course.state.lessonWork.signal.draft,'12.log()');
});
test('different lessons merge automatically and unsupported future lesson ids reject before applying',()=>{
 const a=courseSave('7.log()'),b=emptySave();b.data.course={state:{lesson:1,phase:'independent',...work('8.log()'),lessonWork:{addition:work('8.log()')}}};
 const plan=createMergePlan(a,b);assert.equal(plan.conflicts.length,0);
 assert.deepEqual(Object.keys(resolveMerge(plan).data.course.state.lessonWork),['signal','addition']);
 for(const mutate of [s=>s.lesson=13,s=>s.completed=['future'],s=>s.lessonWork.future=work('')]){
  const bad=structuredClone(a);mutate(bad.data.course.state);assert.throws(()=>supportedSave(bad),e=>e.code==='SAVE_NEW_LESSONS');
 }
});
test('vault empty-editor flag follows its draft; different seeds choose an entire current run',()=>{
 const a=emptySave(),b=emptySave();a.data.vault=newVault(5);b.data.vault=newVault(5);b.data.vault.edited=[0];
 let plan=createMergePlan(a,b),merged=resolveMerge(plan,chooseAll(plan,'incoming'));
 assert.deepEqual(restoreVault(merged.data.vault,99).edited,[0]);assert.equal(merged.data.vault.drafts[0],'');
 a.data.vault.stamps=[0];a.data.vault.cleared=[0];a.data.vault.stage=1;b.data.vault=newVault(6);b.data.vault.stamps=[1];
 plan=createMergePlan(a,b);assert.equal(plan.conflicts.length,1);merged=resolveMerge(plan,chooseAll(plan,'incoming'));
 assert.equal(merged.data.vault.seed,6);assert.equal(merged.data.vault.stage,0);assert.deepEqual(merged.data.vault.cleared,[]);assert.deepEqual(merged.data.vault.stamps,[0,1]);
});
test('chase draft choices keep role/stage results coherent and preserve both histories',()=>{
 const a=emptySave(),b=emptySave();a.data.chase=newChase();b.data.chase=newChase();
 a.data.chase.work.police.cleared=[0];a.data.chase.work.police.submitted=a.data.chase.work.police.drafts[0];
 b.data.chase.work.police.drafts[0]='';b.data.chase.work.thief.cleared=[0];
 const plan=createMergePlan(a,b),value=resolveMerge(plan,chooseAll(plan,'incoming')).data.chase;
 assert.equal(value.work.police.submitted,null);assert.equal(value.work.police.drafts[0],'');
 assert.deepEqual(restoreChase(value),value);assert.deepEqual(value.work.police.cleared,[0]);assert.deepEqual(value.work.thief.cleared,[0]);
});
test('dispatch never splices different runs but lets the player keep individual drafts',()=>{
 const a=emptySave(),b=emptySave();a.data.dispatch=newDispatch(3);b.data.dispatch=newDispatch(6);
 a.data.dispatch.cleared=['branch'];a.data.dispatch.stamps=['branch'];a.data.dispatch.rounds=2;
 b.data.dispatch.cleared=['fuel'];b.data.dispatch.stamps=['fuel'];b.data.dispatch.rounds=3;
 b.data.dispatch.drafts.fuel='sync fn fuel(a,b) { return a+b }';b.data.dispatch.submitted.fuel=b.data.dispatch.drafts.fuel;
 const plan=createMergePlan(a,b),choices=chooseAll(plan,'incoming');choices['dispatch:run']='local';
 const value=resolveMerge(plan,choices).data.dispatch;
 assert.equal(value.seed,3);assert.deepEqual(value.cleared,['branch']);assert.equal(value.submitted.fuel,null);
 assert.equal(value.drafts.fuel,b.data.dispatch.drafts.fuel);assert.deepEqual(value.stamps,['branch','fuel']);assert.equal(value.rounds,3);
 assert.deepEqual(restoreDispatch(value,99),value);
});
test('combining partial dispatch work in one seed awards one completed round, never twice',()=>{
 const a=emptySave(),b=emptySave();a.data.dispatch=newDispatch(10);b.data.dispatch=newDispatch(10);
 a.data.dispatch.cleared=['branch','manifest'];b.data.dispatch.cleared=['fuel','relay'];
 const merged=resolveMerge(createMergePlan(a,b));assert.equal(merged.data.dispatch.rounds,1);assert.equal(merged.data.dispatch.awarded,true);
 const repeated=resolveMerge(createMergePlan(merged,b));assert.equal(repeated.data.dispatch.rounds,1);
 const game=restoreDispatch(repeated.data.dispatch,99);submitDispatch(game,game.selected,dispatchPuzzle(game.seed,game.selected).example);assert.equal(game.rounds,1);
});
test('out-of-range typing fragments reject before they can reach the rendered coach',()=>{
 const bad=courseSave('');bad.data.course.state.phase='typing';bad.data.course.state.fragment=3;
 assert.throws(()=>supportedSave(bad),e=>e.code==='SAVE_INVALID');
 bad.data.course.state.phase='welcome';bad.data.course.state.lessonWork.signal.phase='typing';bad.data.course.state.lessonWork.signal.fragment=3;
 assert.throws(()=>supportedSave(bad),e=>e.code==='SAVE_INVALID');
 bad.data.course.state.lessonWork.signal.phase='predict';assert.doesNotThrow(()=>supportedSave(bad));
 const lab=emptySave();lab.data.course={state:{lesson:12,phase:'independent',fragment:0,draft:'',lessonWork:{coordination:work('')}}};assert.doesNotThrow(()=>supportedSave(lab));
 lab.data.course.state.phase='typing';assert.throws(()=>supportedSave(lab),e=>e.code==='SAVE_INVALID');
 const old=emptySave();old.data.course={state:{lesson:0,phase:'welcome',resumePhase:'typing',fragment:3,draft:''}};
 assert.throws(()=>createMergePlan(emptySave(),old),e=>e.code==='SAVE_INVALID');
});
test('guide drafts merge per concept, preserve deliberate blanks and never overwrite lesson drafts',()=>{
 const a=courseSave('7.log()'),b=courseSave('7.log()');
 a.data.course.state.guideWork={signal:'',names:'let n = 4; n.log()'};a.data.course.state.guideSelected='names';
 b.data.course.state.guideWork={signal:'9.log()',repeat:'for n in [3,5] { n.log() }'};
 const plan=createMergePlan(a,b);assert.equal(plan.conflicts.length,1);assert.equal(plan.conflicts[0].id,'course:signal:guide');
 const merged=resolveMerge(plan,chooseAll(plan,'local'));
 assert.deepEqual(merged.data.course.state.guideWork,{signal:'',names:a.data.course.state.guideWork.names,repeat:b.data.course.state.guideWork.repeat});
 assert.equal(merged.data.course.state.guideSelected,'names');assert.equal(merged.data.course.state.lessonWork.signal.draft,'7.log()');
 const future=courseSave('7.log()');future.data.course.state.guideWork={future:'1.log()'};assert.throws(()=>supportedSave(future),e=>e.code==='SAVE_NEW_LESSONS');
});

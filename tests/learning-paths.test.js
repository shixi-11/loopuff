import test from 'node:test';
import assert from 'node:assert/strict';
import {startSteps,inspectStartStep,startSource,startProgress,editStart,checkStart,requestedStartStep,advanceProgress} from '../src/learning-paths.js';
import {startStepIds} from '../src/guide-work.js';
import {readGuideWork} from '../src/guide.js';
import {newDiagnostic,diagnosticPuzzle,submitDiagnostic,editDiagnostic} from '../src/diagnostic.js';
import {newDispatch,dispatchPuzzle,submitDispatch} from '../src/dispatch.js';
import {emptySave} from '../server/save-format.mjs';
import {supportedSave,createMergePlan,resolveMerge} from '../src/save-merge.js';
import {routeUrl,parseRoute,languageUrl,learningRouteUrl} from '../src/routing.js';
import {locales} from '../src/course.js';

test('starter route runs real finite tasks, permits different solutions and rejects hard-coded decisions',()=>{
 assert.deepEqual(startSteps.map(item=>item.id),startStepIds);
 for(const item of startSteps){assert.equal(inspectStartStep(item.id,item.example).ok,true,item.id);assert.equal(inspectStartStep(item.id,item.starter).ok,item.id==='run',item.id);}
 assert.equal(inspectStartStep('calculate','(5 + 6).log()').ok,true);
 assert.equal(inspectStartStep('decide','3.log()').ok,false);
 assert.equal(inspectStartStep('decide','if obstacle <= 4 then {3.log()} else {1.log()}').ok,false);
 assert.equal(inspectStartStep('calculate','11.log()').ok,false);
 assert.equal(inspectStartStep('calculate','if (1 + 1) > 0 then {11.log()} else {0.log()}').ok,false,'addition must produce the output value, not merely choose a branch');
 assert.equal(inspectStartStep('name','let energy = 10; if energy > 0 then {(7 + 7).log()} else {14.log()}').ok,false,'the named value must contribute data to the addition');
 for(const item of startSteps)assert.equal(inspectStartStep(item.id,`${item.example}; let inbox; ?(x <- inbox) {x.log()}`).ok,false);
});
test('both learning routes keep their step and language; lesson links retain only a known return path',()=>{
 for(const [locale]of locales)for(const prefix of ['', '/games/loopuff'])for(const view of ['start','advance']){
  const url=routeUrl(`https://test${prefix}/zh/guide/`,locale,view);url.searchParams.set('step','repair');
  assert.deepEqual(parseRoute(url.pathname),{locale,view});assert.equal(languageUrl(url.href,'ar').pathname,`${prefix}/ar/guide/${view}/`);assert.equal(languageUrl(url.href,'ar').searchParams.get('step'),'repair');
 }
 assert.equal(learningRouteUrl('https://test/zh/guide/check/?path=advance&area=branch&return=diagnostic','en','lesson','branch'),'https://test/en/learn/branch/?path=advance');
 assert.equal(learningRouteUrl('https://test/zh/guide/?path=foreign','en','lesson','signal'),'https://test/en/learn/signal/');
});
test('old save envelopes carry starter work and merge each draft with its own check as one choice',()=>{
 const left=emptySave(),right=emptySave();left.data.course={state:{guideWork:{signal:'123.log()','start-change':'9.log()','start-change-checked':'9.log()'},guideSelected:'signal'}};
 right.data.course={state:{guideWork:{function:'','start-change':'(4 + 5).log()','start-change-checked':'(4 + 5).log()'}}};
 assert.equal(supportedSave(left).data.course.state.guideWork['start-change'],'9.log()');
 const plan=createMergePlan(left,right);assert.equal(plan.conflicts.length,1);assert.equal(plan.conflicts[0].kind,'start');
 const merged=resolveMerge(plan,{[plan.conflicts[0].id]:'incoming'});assert.equal(merged.data.course.state.guideWork.signal,'123.log()');assert.equal(merged.data.course.state.guideWork.function,'');assert.equal(merged.data.course.state.guideWork['start-change'],'(4 + 5).log()');assert.deepEqual(startProgress(merged.data.course.state.guideWork),['change']);
 const foreign=structuredClone(left);foreign.data.course.state.guideWork['start-foreign']='1.log()';assert.throws(()=>supportedSave(foreign),e=>e.code==='SAVE_NEW_LESSONS');
 const reset=structuredClone(left);editStart(reset.data.course.state.guideWork,'change','7.log()');const resetPlan=createMergePlan(reset,left);assert.equal(resetPlan.conflicts.length,1);assert.throws(()=>resolveMerge(resetPlan),error=>error.code==='SAVE_CHOICES_REQUIRED');const kept=resolveMerge(resetPlan,{[resetPlan.conflicts[0].id]:'local'});assert.deepEqual(startProgress(kept.data.course.state.guideWork),[]);
});
test('starter drafts and real checks roundtrip without modifying existing guide or lesson work',()=>{
 const work={signal:'123.log()',function:'',unknown:'ignored'},old=structuredClone(work);
 assert.equal(startSource(work,'change'),'7.log()');assert.deepEqual(startProgress(work),[]);
 editStart(work,'change','9.log()');checkStart(work,'change');assert.deepEqual(startProgress(work),['change']);
 const restored=readGuideWork(JSON.parse(JSON.stringify(work)));assert.deepEqual(startProgress(restored),['change']);assert.equal(restored.signal,old.signal);assert.equal(restored.function,'');
 editStart(restored,'change','');assert.deepEqual(startProgress(restored),[]);assert.equal(startSource(restored,'change'),'');
 editStart(restored,'change','9.log()');assert.deepEqual(startProgress(restored),[],'editing back does not revive an old result');
 assert.equal(requestedStartStep('https://test/zh/guide/start/?step=repair',restored),'repair');assert.equal(requestedStartStep('https://test/zh/guide/start/?step=foreign',restored),'run');
});
test('advanced progression rechecks exact submitted diagnostic/project programs and gives no credit to stale or fake marks',()=>{
 const diagnostic=newDiagnostic(4),dispatch=newDispatch(4);
 assert.deepEqual(advanceProgress(diagnostic,dispatch).passed,[]);
 submitDiagnostic(diagnostic,'names',diagnosticPuzzle(4,'names').example);submitDispatch(dispatch,'branch',dispatchPuzzle(4,'branch').example);
 assert.deepEqual(advanceProgress(diagnostic,dispatch).passed,['names']);assert.deepEqual(advanceProgress(diagnostic,dispatch).projects,['branch']);
 editDiagnostic(diagnostic,'names','1.log()');dispatch.drafts.branch='1.log()';assert.deepEqual(advanceProgress(diagnostic,dispatch).passed,[]);assert.deepEqual(advanceProgress(diagnostic,dispatch).projects,[]);
 assert.equal(advanceProgress({bad:true},dispatch).bad,true);
});

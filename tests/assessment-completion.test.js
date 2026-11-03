import test from 'node:test';
import assert from 'node:assert/strict';
import {course} from '../src/course.js';
import {assessTask as assess,gradeTask as grade,grade as observeGrade} from '../src/assessment.js';
import {run} from '../src/runner.js';
import {executeGuide} from '../src/guide.js';
import {inspectRewrite,rewriteTask} from '../src/rewrite.js';
import {dispatchIds,dispatchPuzzle,inspectDispatch} from '../src/dispatch.js';
import {diagnosticIds,diagnosticPuzzle,inspectDiagnostic} from '../src/diagnostic.js';
import {readSession} from '../src/progress.js';
import {newVault,vaultPuzzle,submitVault} from '../src/vault.js';
const pending='; let never; ?(x <- never) { x.log() }';
test('every finite independent task with correct output but a waiting receive remains unfinished',()=>{
 for(const lesson of course){
  const source=lesson.independent.example+pending,result=run(source);assert.deepEqual(result.logs,lesson.independent.logs,lesson.id);assert.equal(result.waiting,1,lesson.id);
  const report=grade(source,lesson.independent);assert.equal(report.ok,false,lesson.id);assert.equal(report.code,'waiting',lesson.id);assert.equal(report.score,80,lesson.id);assert.deepEqual(report.result,result,lesson.id);
  const execution=report.checks.find(check=>check.id==='execution'),output=report.checks.find(check=>check.id==='output');assert.deepEqual(execution,{id:'execution',points:0,max:20,status:'fail'});assert.equal(output.status,'pass');assert.equal(output.points,output.max);assert.ok((report.checks.find(check=>check.id==='concepts')?.requirements||[]).every(item=>item.passed));
  assert.equal(assess(source,lesson.independent).ok,false,lesson.id);
 }
});
test('waiting remains observable in the language and guide; completing the receive permits assessment',()=>{
 const missing='let west; let east; { west ! 4 | ?(a <- west & b <- east) { (a + b).log() } }',observed=executeGuide(missing);assert.equal(observed.ok,true);assert.equal(observed.result.waiting,1);assert.deepEqual(observed.result.logs,[]);
 const task={logs:['10'],require:['send','receive','join','add']},finished='let west; let east; { west ! 4 | east ! 6 | ?(a <- west & b <- east) { (a + b).log() } }';assert.equal(run(finished).waiting,0);assert.equal(grade(finished,task).ok,true);assert.equal(grade(finished,task).score,100);
 const stillWaiting=grade(finished+pending,task);assert.equal(stillWaiting.ok,false);assert.equal(stillWaiting.code,'waiting');assert.deepEqual(stillWaiting.result.logs,['10']);
 const noOutput=grade(missing,task);assert.equal(noOutput.code,'waiting');assert.equal(noOutput.score,0);assert.deepEqual(noOutput.result.logs,[]);
 const observer=observeGrade('12.log()'+pending,{logs:['12'],require:[]});assert.equal(observer.ok,true);assert.equal(observer.result.waiting,1);assert.equal(observer.score,100);
});
test('all three vault mechanisms retain correct signals without awarding a lock or stamp while waiting',()=>{
 for(let stage=0;stage<3;stage++){const state=newVault(42);state.stage=stage;const puzzle=vaultPuzzle(state.seed,stage),source=puzzle.example+pending,report=submitVault(state,source);assert.deepEqual(report.actual,puzzle.goal.logs);assert.equal(report.result.waiting,1);assert.equal(report.ok,false);assert.equal(report.code,'waiting');assert.equal(report.score,80);assert.deepEqual(state.stamps,[]);assert.deepEqual(state.cleared,[]);assert.equal(state.drafts[stage],source);}
});
test('rewrite, dispatch and diagnostic waiting reports consume the same non-perfect shared assessment',()=>{
 for(const lesson of course){const source=rewriteTask(lesson.id).goal.example+pending,report=inspectRewrite(lesson.id,source);assert.equal(report.ok,false,lesson.id);assert.equal(report.code,'waiting',lesson.id);assert.equal(report.score,80,lesson.id);}
 for(const id of dispatchIds){const source=dispatchPuzzle(42,id).example+pending,report=inspectDispatch(42,id,source);assert.equal(report.ok,false,id);assert.equal(report.code,'waiting',id);assert.ok(report.cases.every(item=>item.result.waiting>0&&item.score<100),id);}
 for(const id of diagnosticIds){const source=diagnosticPuzzle(42,id).example+pending,report=inspectDiagnostic(42,id,source);assert.equal(report.ok,false,id);assert.equal(report.code,'waiting',id);assert.ok(report.cases.every(item=>item.result.waiting>0&&item.score<100),id);}
});
test('reading a corrected report preserves historical grades, attempts, completion and all saved work',()=>{
 const source='12.log()'+pending,restored=readSession(JSON.stringify({lang:'zh',state:{phase:'result',lesson:0,draft:source,assessedSource:source,completed:['signal'],grades:{signal:{score:100,best:100,attempts:3}},lessonWork:{signal:{phase:'result',draft:source,assessedSource:source,score:200,keys:7,errors:0}}}}));
 assert.equal(restored.state.draft,source);assert.equal(restored.state.grades.signal.best,100);assert.deepEqual(restored.state.completed,['signal']);const before=structuredClone(restored),report=grade(restored.state.draft,course[0].independent);assert.equal(report.code,'waiting');assert.equal(report.ok,false);assert.deepEqual(restored,before);
});

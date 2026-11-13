import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeLearningSteps} from '../src/arcade-learning.js';
import {arcadeLearningSource,arcadeLearningProgress,requestedArcadeLearningStep} from '../src/arcade-learning-work.js';
import {arcadeWorkKey} from '../src/guide-work.js';
import {readGuideWork} from '../src/guide.js';
import {normalizeSave,emptySave} from '../server/save-format.mjs';
test('new arcade work preserves the original starter and concept drafts without reusing the old pursuit task',()=>{
 const legacy={'start-run':'7.log()','start-run-checked':'7.log()','start-decide':'if obstacle < 4 then {3.log()} else {1.log()}','start-decide-checked':'if obstacle < 4 then {3.log()} else {1.log()}',signal:'13.log()',function:''};
 const work=readGuideWork({...legacy,'arcade-score':'0.log()'});
 for(const [key,value]of Object.entries(legacy))assert.equal(work[key],value);
 assert.equal(arcadeLearningSource(work,'run'),'7.log()');assert.deepEqual(arcadeLearningProgress(work),['run']);assert.equal(arcadeWorkKey('score'),'arcade-score');
 assert.equal(requestedArcadeLearningStep('https://example.invalid/zh/guide/start/?step=score',work),'score');
 const save=emptySave();save.data.course={lang:'zh',state:{lesson:0,phase:'guide',guideWork:work}};assert.deepEqual(normalizeSave(save).data.course.state.guideWork,work);
});
test('completed learning is based on the checked source and current execution, including the actual strategy',()=>{
 const work={};for(const step of arcadeLearningSteps){work[arcadeWorkKey(step.id)]=step.example;work[arcadeWorkKey(step.id,true)]=step.example;}
 assert.deepEqual(arcadeLearningProgress(work),arcadeLearningSteps.map(step=>step.id));
 work[arcadeWorkKey('repeat')]='start();right();right();right()';work[arcadeWorkKey('repeat',true)]=work[arcadeWorkKey('repeat')];assert.ok(!arcadeLearningProgress(work).includes('repeat'));
 work[arcadeWorkKey('strategy')]='drop()';assert.ok(!arcadeLearningProgress(work).includes('strategy'));
});

test('a leaderboard visit remains a valid backup phase without losing checked learning work',()=>{const save=emptySave();save.data.course={lang:'zh',state:{lesson:0,phase:'leaderboard',guideWork:{'arcade-score':'0.log()'}}};assert.equal(normalizeSave(save).data.course.state.phase,'leaderboard');});

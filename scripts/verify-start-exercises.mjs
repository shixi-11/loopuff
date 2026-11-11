import assert from 'node:assert/strict';
import {startSteps,inspectStartStep} from '../src/learning-paths.js';
export function verifyStartExercises(){
 for(const task of startSteps){
  assert.equal(inspectStartStep(task.id,task.example).ok,true,`${task.id}: reference`);
  assert.equal(inspectStartStep(task.id,task.starter).ok,task.id==='run',`${task.id}: starter`);
  assert.equal(inspectStartStep(task.id,`${task.example}; let inbox; ?(x <- inbox) {x.log()}`).ok,false,`${task.id}: unfinished`);
 }
 for(const [id,source]of [['calculate','11.log()'],['calculate','if (1 + 1) > 0 then {11.log()} else {0.log()}'],['name','let energy = 10; if energy > 0 then {(7 + 7).log()} else {14.log()}'],['decide','3.log()'],['decide','if obstacle <= 4 then {3.log()} else {1.log()}']])assert.equal(inspectStartStep(id,source).ok,false,`${id}: wrong strategy`);
}

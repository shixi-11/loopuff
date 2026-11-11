import assert from 'node:assert/strict';
import {newPursuit} from '../src/pursuit.js';
import {pursuitPracticeStarter,pursuitPracticeSource,checkPursuitPractice} from '../src/pursuit-practice.js';

// Author-side exercise validation. No generated answers, agent or new runtime.
export function verifyPursuitExercise(check=checkPursuitPractice){
 const wrong=[pursuitPracticeStarter,'2.log()','3.log()',
  pursuitPracticeSource.replace('obstacle < 4','obstacle > 4'),
  pursuitPracticeSource.replace('obstacle < 4','obstacle <= 4'),
  pursuitPracticeSource.replace('energy > 35','energy >= 35'),
  pursuitPracticeSource.replace('obstacle < 4','obstacle == 3'),
  'if obstacle < 4 then { if energy > 35 then { 3.log() } else { 1.log() } } else { if energy > 35 then { 2.log() } else { 1.log() } }',
  'if energy > 35 then { 2.log() } else { if obstacle < 4 then { 3.log() } else { 1.log() } }',
  '1.log(); 2.log(); 3.log()',
  `${pursuitPracticeSource}; let inbox; ?(value <- inbox) { value.log() }`];
 let checked=0;
 for(const role of ['police','thief'])for(const seed of [4,81]){
  const world=newPursuit(seed,role),before=structuredClone(world);
  assert.equal(check(world,pursuitPracticeSource).ready,true,'reference must pass');
  for(const source of wrong){assert.equal(check(world,source).ready,false,`incorrect program accepted: ${source}`);checked++;}
  assert.deepEqual(world,before,'exercise validation cannot alter a run');
 }
 return checked;
}

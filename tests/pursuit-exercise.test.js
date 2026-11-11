import test from 'node:test';
import assert from 'node:assert/strict';
import {newPursuit,inspectPursuitInputs,pursuitInputs} from '../src/pursuit.js';
import {verifyPursuitExercise} from '../scripts/verify-pursuit-exercise.mjs';
import {checkPursuitPractice,pursuitPracticeSource,replayPursuitPractice} from '../src/pursuit-practice.js';

test('exercise gate accepts the reference and rejects eleven realistic wrong strategies including the starter',()=>{
 assert.equal(verifyPursuitExercise(),44);
 // Removing the threshold cases must break the exercise gate, even though the
 // correct program still passes the remaining examples.
 assert.throws(()=>verifyPursuitExercise((world,source)=>{
  const report=checkPursuitPractice(world,source);return {...report,ready:report.cases.filter(row=>!['atBoundary','aboveEnergy'].includes(row.id)).every(row=>row.matches)};
 }),/incorrect program accepted/);
 assert.throws(()=>verifyPursuitExercise((world,source)=>{const report=checkPursuitPractice(world,source);return {...report,ready:report.cases.filter(row=>row.id!=='tiredNear').every(row=>row.matches)};}),/incorrect program accepted/);
});
test('distinct correct programs pass without matching the reference text',()=>{
 const world=newPursuit(4),source='if obstacle >= 4 then { if energy <= 35 then { 1.log() } else { 2.log() } } else { 3.log() }';
 assert.equal(checkPursuitPractice(world,source).ready,true);
 for(const energy of [0,8,34,35,36,60,100])for(const obstacle of [0,1,3,4,5,12,999]){
  const report=inspectPursuitInputs({...pursuitInputs(world),energy,obstacle},source);
  assert.deepEqual(report.logs,[obstacle<4?'3':energy>35?'2':'1']);
 }
});
test('one-action replays use real movement and collisions without changing either run or observation',()=>{
 for(const role of ['police','thief']){
  const world=newPursuit(4,role),before=structuredClone(world);
  const good=checkPursuitPractice(world,pursuitPracticeSource).cases.find(row=>row.id==='near'),bad=checkPursuitPractice(world,'1.log()').cases.find(row=>row.id==='near'),saved=structuredClone(good);
  const jump=replayPursuitPractice(world,good),walk=replayPursuitPractice(world,bad);
  assert.equal(jump.frames[0].actors[role].energy,60);assert.equal(jump.frames[0].activeMs,0);
  assert.equal(pursuitInputs(jump.frames[0]).obstacle,3);
  assert.ok(jump.frames.some(frame=>frame.actors[role].jumpMs>0));
  assert.equal(jump.frames.at(-1).actors[role].clears,1);
  assert.equal(walk.frames.at(-1).actors[role].collisions,1);
  assert.ok(jump.frames.at(-1).activeMs<=1200);assert.equal(jump.frames.at(-1).status,'running');
  assert.deepEqual(world,before);assert.deepEqual(good,saved);
  assert.equal(replayPursuitPractice(world,checkPursuitPractice(world,'9.log()').cases[0]),null);
 }
});

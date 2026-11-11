import test from 'node:test';
import assert from 'node:assert/strict';
import {newPursuit,startPursuit,pausePursuit,advancePursuit,deployPursuit,inspectPursuit,inspectPursuitInputs,pursuitInputs} from '../src/pursuit.js';
import {pursuitPracticeSource,checkPursuitPractice,currentPursuitPractice,stagePursuitPractice} from '../src/pursuit-practice.js';

test('practice and live play execute the same inputs; sample runs do not alter the current pursuit',()=>{
 const world=newPursuit(81);deployPursuit(world,'2.log()');startPursuit(world);advancePursuit(world,250);pausePursuit(world);world.draft='1.log();1.log()';
 assert.ok(world.activeMs>0);assert.notEqual(world.draft,world.strategy);const before=structuredClone(world),report=checkPursuitPractice(world,pursuitPracticeSource);
 assert.equal(report.ready,true);assert.deepEqual(report.cases[0].report,inspectPursuit(world,pursuitPracticeSource));assert.deepEqual(report.cases.slice(0,4).map(item=>item.report.logs),[['2'],['3'],['2'],['1']]);assert.deepEqual(world,before);
 const changed=checkPursuitPractice(world,pursuitPracticeSource.replace('3.log()','2.log()'));
 assert.equal(changed.ready,false);assert.deepEqual(changed.cases.find(item=>item.id==='near').report.logs,['2']);assert.deepEqual(world,before);
 const liveWrong=checkPursuitPractice(world,`if energy > 60 then { 1.log() } else { ${pursuitPracticeSource} }`);
 assert.equal(liveWrong.ready,false,'valid signals are insufficient when the actual snapshot violates the stated rule');
 assert.equal(liveWrong.cases[0].matches,false);assert.deepEqual(world,before);
 for(const source of ['9.log()','missing.log()','let a; ?(x <- a) {1.log()}','while true {1.log()}']){const bad=checkPursuitPractice(world,source);assert.equal(bad.ready,false);assert.deepEqual(world,before);}
});
test('scratch checks become stale when their source, game snapshot or target draft changes',()=>{
 const world=newPursuit(3),report=checkPursuitPractice(world,pursuitPracticeSource);assert.equal(currentPursuitPractice(world,pursuitPracticeSource,report),true);
 assert.equal(currentPursuitPractice(world,'1.log()',report),false);
 for(const change of [w=>w.activeMs+=10,w=>w.id='another-run',w=>w.role='thief',w=>w.status='paused',w=>w.draft='2.log()',w=>w.strategy='2.log()',w=>w.actors.police.energy=30]){
  const changed=structuredClone(world);change(changed);const before=structuredClone(changed);assert.equal(stagePursuitPractice(changed,pursuitPracticeSource,report,true),'stale');assert.deepEqual(changed,before);
 }
});
test('explicit staging only changes a paused or ready draft and confirms replacement of existing work',()=>{
 const world=newPursuit(5),source=pursuitPracticeSource,before=structuredClone(world),report=checkPursuitPractice(world,source);
 assert.equal(stagePursuitPractice(world,source,report),'staged');assert.deepEqual(world,{...before,draft:source});assert.equal(world.strategy,'1.log()');assert.equal(world.activeMs,0);
 world.draft='(1 + 1).log()';const existing=structuredClone(world),checked=checkPursuitPractice(world,source);
 assert.equal(stagePursuitPractice(world,source,checked),'confirm');assert.deepEqual(world,existing);
 assert.equal(stagePursuitPractice(world,source,checked,true),'staged');assert.deepEqual(world,{...existing,draft:source});
 for(const status of ['running','finished']){world.status=status;const snap=structuredClone(world);assert.equal(stagePursuitPractice(world,source,checkPursuitPractice(world,source),true),'unavailable');assert.deepEqual(world,snap);}
 world.status='paused';const mismatch=checkPursuitPractice(world,'1.log()'),snap=structuredClone(world);assert.equal(stagePursuitPractice(world,'1.log()',mismatch,true),'mismatch');assert.deepEqual(world,snap);
});
test('input protocol cannot inject source and reports retain real source positions and numeric boundary choices',()=>{
 const world=newPursuit(9),inputs=pursuitInputs(world),source=pursuitPracticeSource;
 for(const value of ['100; 9.log()',NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])assert.equal(inspectPursuitInputs({...inputs,energy:value},source).code,'inputs');
 for(const [energy,obstacle,signal]of [[35,4,'1'],[36,4,'2'],[20,3,'3'],[60,3,'3']]){const report=inspectPursuitInputs({...inputs,energy,obstacle},source);assert.equal(report.ok,true);assert.deepEqual(report.logs,[signal]);assert.ok(source.slice(report.outputs[0].start,report.outputs[0].end).includes(signal+'.log()'));}
 const foreign={...inputs,extra:'9.log()'};assert.deepEqual(inspectPursuitInputs(foreign,'1.log()'),inspectPursuitInputs(inputs,'1.log()'));
});

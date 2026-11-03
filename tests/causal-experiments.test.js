import test from 'node:test';
import assert from 'node:assert/strict';
import {experimentSettings,experimentSource,runExperiment,experimentObservation} from '../src/causal-experiments.js';
import {observeProgram} from '../src/program-scene.js';

test('function displays use the real call, scoped calculation, return and output',()=>{
 for(const [a,b]of [['3','4'],['8','2'],['0','99']]){
  const settings={...experimentSettings('function'),a,b},before=structuredClone(settings),report=runExperiment('function',settings),seen=experimentObservation(report);
  assert.equal(report.ok,true);assert.deepEqual(seen.call.args,[a,b]);assert.equal(seen.calculation.context,seen.call.invocation);assert.equal(seen.returned.invocation,seen.call.invocation);assert.deepEqual(seen.outputs,[String(Number(a)+Number(b))]);assert.deepEqual(settings,before);
 }
 const changed=observeProgram(experimentSource('function',experimentSettings('function')).replace('a + b','a * b')),seen=experimentObservation(changed);
 assert.equal(seen.calculation.operator,'*');assert.equal(seen.returned.value,'12');assert.deepEqual(seen.outputs,['12']);
});
test('zero, one or two reports really wait or receive atomically, with no fabricated half-consumption',()=>{
 for(const west of [false,true])for(const east of [false,true]){
  const settings={...experimentSettings('join'),west,east},report=runExperiment('join',settings),seen=experimentObservation(report);
  assert.equal(report.ok,true);assert.equal(seen.waiting,west&&east?0:1);
  assert.deepEqual(seen.outputs,west&&east?['10']:[]);assert.deepEqual(seen.received,west&&east?[['4','6']]:[]);
  assert.deepEqual(seen.ports.map(port=>port.queued),west&&east?[[],[]]:[west?['4']:[],east?['6']:[]]);
 }
});
test('invalid host settings never become source or stale observations',()=>{
 for(const a of ['', '-1','100','1.5','1e2','1;9.log()'])assert.equal(runExperiment('function',{...experimentSettings('function'),a}),null);
 assert.throws(()=>experimentSettings('unknown'));assert.throws(()=>experimentSource('unknown',{}));
 assert.equal(experimentObservation(null),null);assert.equal(experimentObservation({ok:false}),null);assert.equal(experimentObservation({ok:true,truncated:true}),null);
});

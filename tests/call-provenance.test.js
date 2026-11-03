import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from '../src/runner.js';
import {course} from '../src/course.js';
const withoutOrigins=r=>({...r,outputs:r.outputs.map(({invocations,...output})=>output),calls:r.calls.map(({invocation,definition,args,...call})=>call)});
test('optional call provenance does not change execution, default observations, clocks or scheduling',()=>{
 for(const lesson of course)for(const source of [lesson.source,lesson.remix.source,lesson.independent.example])assert.deepEqual(withoutOrigins(run(source,{provenance:true})),run(source));
});
test('lineage follows actual returned values through lists, arithmetic, messages and curried reuse, excluding control-only calls',()=>{
 const sources=[
  'sync fn sum(a,b){return a+b};let add=sum(4);add(5).log();add(9).log()',
  'fn sum(a,b){return ! (a+b)};let box;{box ! sum(4,5)|?(x<-box){(x+4).log()}}',
  'sync fn values(a){return [a,a+1]};for n in values(4){n.log()}',
  'sync fn check(a){return a+1};if check(1)>0 then{9.log()} else{9.log()}'
 ];
 for(const source of sources){const r=run(source,{provenance:true});assert.deepEqual(withoutOrigins(r),run(source));assert.ok(r.calls.every(call=>Number.isInteger(call.invocation)&&Number.isInteger(call.definition)));}
 const r=run(sources[0],{provenance:true});assert.notDeepEqual(r.outputs[0].invocations,r.outputs[1].invocations);assert.equal(r.calls[0].definition,r.calls[1].definition);
 const list=run(sources[2],{provenance:true});assert.deepEqual(list.outputs.map(o=>o.invocations),[[1],[1]]);
 assert.deepEqual(run(sources[3],{provenance:true}).outputs[0].invocations,[]);
});
test('shared nested lists retain their DAG instead of expanding for identity or provenance',()=>{
 const source='sync fn twice(xs){return [xs,xs]};let x=[0];'+'x=twice(x);'.repeat(100)+'0.log()';
 const result=run(source,{provenance:true});assert.equal(result.calls.length,100);assert.equal(result.steps,807);assert.deepEqual(withoutOrigins(result),run(source));
 const nested=run('sync fn wrap(a){return [[a]]};for row in wrap(4){for item in row{item.log()}}',{provenance:true});assert.deepEqual(nested.outputs[0].invocations,[1]);
});

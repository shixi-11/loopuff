import test from 'node:test';
import assert from 'node:assert/strict';
import {course} from '../src/course.js';
import {rewriteTask,inspectRewrite,beginRewrite,lessonDiagnostic} from '../src/rewrite.js';
import {courseLessonIds} from '../server/save-format.mjs';
test('all courses have a whole-program bridge with actual execution, not source matching',()=>{
 assert.deepEqual(course.map(item=>item.id),courseLessonIds);
 for(const {id} of course){
  const {starter,goal}=rewriteTask(id);
  assert.equal(inspectRewrite(id,goal.example).ok,true,id);
  assert.equal(inspectRewrite(id,'\n'+goal.example+'\n').ok,true,id+' alternative layout');
  assert.equal(inspectRewrite(id,starter).ok,false,id+' needs an actual change');
  assert.equal(inspectRewrite(id,'0.log()').ok,false,id+' wrong output');
  if(goal.require.length)assert.equal(inspectRewrite(id,goal.logs.map(n=>n+'.log()').join(';')).ok,false,id+' hardcoding');
  assert.ok(lessonDiagnostic[id]);
 }
 assert.equal(inspectRewrite('function','sync fn total(x,y) { return x + y }; total(7,2).log(); total(10,3).log()').ok,true);
 assert.equal(inspectRewrite('names','let stock = 10; (stock + 3).log(); (stock + 7).log()').ok,true);
});
test('each rewritten output needs real data contribution and synchronous calls stay synchronous',()=>{
 for(const [id,source] of [
  ['addition','(4+6).log();13.log()'],['names','let n=9;(n+4).log();17.log()'],['comparison','(3>8).log();true.log()'],
  ['addition','if (1+1)>0 then {10.log();13.log()} else {10.log();13.log()}'],
  ['names','let n=1;if (n+0)==1 then {13.log();17.log()} else {13.log();17.log()}'],
  ['leap','if (1+1)==2 then {9.log()} else {9.log()}'],
  ['comparison','if 1>0 then {false.log();true.log()} else {false.log();true.log()}'],
  ['counter','let n=1;while (n+0)<2 {3.log();4.log();5.log();n=n+1}'],
  ['function','fn combine(a,b){return ! (a+b)};combine(4,5).log();combine(6,7).log()']
 ])assert.equal(inspectRewrite(id,source).ok,false,id+' rejects '+source);
});
test('a pair of signals must reuse distinct contributing calls of the same function',()=>{
 const wrong=[
  ['function','sync fn sum(a,b){return a+b};sum(0,0);let x=sum(4,5);x.log();(x+4).log()'],
  ['function','sync fn one(a,b){return a+b};sync fn two(a,b){return a+b};one(4,5).log();two(6,7).log()'],
  ['function','sync fn sum(a,b){return a+b};let cached=sum(1,2)+sum(3,3);cached.log();(cached+4).log()'],
  ['reply','fn boost(load){return ! (load+3)};let x=boost(8);x.log();(x+4).log()']
 ];for(const [id,source] of wrong)assert.equal(inspectRewrite(id,source).ok,false,source);
 assert.equal(inspectRewrite('function','fn unused(){return ! 0};unused();sync fn sum(a,b){return a+b};sum(4,5).log();sum(6,7).log()').ok,true);
 assert.equal(inspectRewrite('function','sync fn sum(a,b){return a+b};let x=sum(4,5);x.log();sum(x,4).log()').ok,true);
 const zeros=Array(16).fill(0).join(',');
 assert.equal(inspectRewrite('function',`sync fn total(xs){let n=0;for x in xs {n=n+x};return n};total([${zeros},9]).log();total([${zeros},13]).log()`).ok,true);
});
test('entering rewrite never replaces independent source, submission, grades, or intentional blank rewrite',()=>{
 const state={draft:'12.log()',assessedSource:'12.log()',grades:{signal:{score:100,best:100,attempts:1}}};
 const original=structuredClone(state);beginRewrite(state,'signal','5.log()');
 assert.equal(state.rewriteDraft,'5.log()');assert.equal(state.phase,'rewrite');
 for(const key of Object.keys(original))assert.deepEqual(state[key],original[key]);
 state.rewriteDraft='';beginRewrite(state,'signal','7.log()');assert.equal(state.rewriteDraft,'');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {homeDestination,inspectHomeSignal} from '../src/home.js';
import {checkStart} from '../src/learning-paths.js';
test('first visits enter the novice route while real saved course work remains resumable',()=>{
 assert.deepEqual(homeDestination({lesson:0,completed:[],resumePhase:'guide'},{}),{view:'start',resumed:false});
 const work={};checkStart(work,'run');assert.deepEqual(homeDestination({lesson:0,completed:[]},work),{view:'start',resumed:true});
 const state={lesson:2,completed:['signal'],lessonWork:{names:{phase:'independent',draft:'(4 + 10).log()'}}};
 assert.deepEqual(homeDestination(state,work),{view:'lesson',lessonId:'names',resumed:true});
 assert.equal(state.lessonWork.names.draft,'(4 + 10).log()');
});
test('the home demonstration executes a bounded number and rejects source injection',()=>{
 assert.deepEqual(inspectHomeSignal('9').logs,['9']);assert.equal(inspectHomeSignal('0').source,'0.log()');
 for(const value of ['','100','-1','2.log()','NaN','3.5'])assert.equal(inspectHomeSignal(value).ok,false);
});

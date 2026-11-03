import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchPuzzle,inspectDispatch} from '../src/dispatch.js';
import {dispatchFeedback} from '../src/dispatch-feedback.js';
const feedback=(seed,id,source,index)=>dispatchFeedback(dispatchPuzzle(seed,id),inspectDispatch(seed,id,source).cases[index]);
test('repair feedback follows the selected batch including the equality boundary and actual errors',()=>{
 const p=dispatchPuzzle(42,'branch'),wrong='if cargo <= threshold then { 1.log() } else { 2.log() }';
 assert.equal(dispatchFeedback(p,null),null);
 assert.deepEqual(feedback(42,'branch',wrong,0),{kind:'passed'});
 assert.deepEqual(feedback(42,'branch',wrong,p.parameters.threshold),{kind:'boundary',outputIndex:0});
 assert.deepEqual(feedback(42,'branch','unknown.log()',0),{kind:'error',code:'nameError'});
 assert.deepEqual(feedback(42,'branch',p.example+';let pending;?(x <- pending){x.log()}',0),{kind:'waiting'});
});
test('the first wrong, missing or uncomputed signal is identified from the actual execution',()=>{
 assert.deepEqual(feedback(0,'manifest','for dock in docks { dock.log() }',3),{kind:'output',outputIndex:0});
 assert.deepEqual(feedback(0,'manifest','1.log()',0),{kind:'empty',outputIndex:0});
 const source='for dock in docks { if dock == 4 then { 5.log() } else { (dock + offset).log() } }';
 assert.deepEqual(feedback(0,'manifest',source,3),{kind:'contribution',outputIndex:0});
 assert.deepEqual(feedback(0,'manifest','for dock in docks {}',3),{kind:'output',outputIndex:0});
});

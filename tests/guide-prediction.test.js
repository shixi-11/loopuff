import test from 'node:test';
import assert from 'node:assert/strict';
import {executeGuide} from '../src/guide.js';
import {readPrediction,comparePrediction} from '../src/guide-prediction.js';

test('a blank optional prediction is distinct from deliberately predicting no output',()=>{
 assert.equal(readPrediction(' \n '),null);
 assert.deepEqual(readPrediction('',true),[]);
 assert.deepEqual(readPrediction(' 2 \r\n 4\r\n6 '),['2','4','6']);
 assert.deepEqual(readPrediction('2\n\n6'),['2','','6']);
 assert.equal(comparePrediction(null,executeGuide('7.log()')),null);
 assert.deepEqual(comparePrediction([],executeGuide('let n = 3;')),{kind:'matched',count:0});
 assert.deepEqual(comparePrediction([],executeGuide('7.log()')),{kind:'different',index:0,expected:null,actual:'7'});
});
test('comparison uses the edited program, order, multiplicity and complete output',()=>{
 assert.deepEqual(comparePrediction(['7'],executeGuide('(4 + 5).log()')),{kind:'different',index:0,expected:'7',actual:'9'});
 const loop=executeGuide('for n in [2,4,4] { n.log() }');
 assert.deepEqual(comparePrediction(['2','4','4'],loop),{kind:'matched',count:3});
 assert.deepEqual(comparePrediction(['2','4'],loop),{kind:'different',index:2,expected:null,actual:'4'});
 assert.deepEqual(comparePrediction(['2','4','4','6'],loop),{kind:'different',index:3,expected:'6',actual:null});
 assert.deepEqual(comparePrediction(['2','4','6'],loop),{kind:'different',index:2,expected:'6',actual:'4'});
 assert.deepEqual(comparePrediction(['false'],executeGuide('(3 > 5).log()')),{kind:'matched',count:1});
});
test('an error or unfinished receive cannot confirm a prediction, even with matching partial logs',()=>{
 assert.equal(comparePrediction(['7'],null),null);
 assert.deepEqual(comparePrediction(['7'],executeGuide('unknown.log()')),{kind:'error'});
 assert.deepEqual(comparePrediction(['7'],executeGuide('7.log(); let pending; ?(n <- pending) { n.log() }')),{kind:'waiting'});
 assert.deepEqual(comparePrediction([],executeGuide('let pending; ?(n <- pending) { n.log() }')),{kind:'waiting'});
});

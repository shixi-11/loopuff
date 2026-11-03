import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDiagnostic,diagnosticPuzzle,diagnosticIds} from '../src/diagnostic.js';
import {diagnosticFeedback} from '../src/diagnostic-feedback.js';
const feedback=(id,source)=>diagnosticFeedback(id,inspectDiagnostic(42,id,source),source);
test('next practice follows actual missing methods, without restarting all learners at output',()=>{
 assert.throws(()=>diagnosticFeedback('__proto__',null,''),RangeError);
 assert.equal(feedback('names','cargo.log()').lesson,'addition');
 assert.equal(feedback('names','let sum=cargo+reserve;').lesson,'signal');
 assert.equal(feedback('names','let sum=cargo+reserve;').reason,'empty');
 assert.equal(feedback('names','7.log()').lesson,'names');
 assert.equal(feedback('branch','if true then{1.log()} else{2.log()}').lesson,'comparison');
 assert.equal(feedback('message','?(value <- mailbox){value.log()}').lesson,'addition');
 assert.equal(feedback('join','?(a <- west & b <- east){a.log()}').lesson,'join');
 assert.equal(feedback('function','fn combine(a,b){return ! (a+b)}').lesson,'function');
 assert.equal(feedback('reply','sync fn boost(a,b){return a+b}').lesson,'reply');
});
test('boundary feedback identifies a real failing case and keeps execution failures distinct',()=>{
 const equal=feedback('branch','if fuel >= threshold then{1.log()} else{2.log()}');assert.equal(equal.reason,'boundary');assert.equal(equal.lesson,'comparison');assert.equal(equal.caseIndex,2);
 const zero=feedback('counter','let count=0;while count <= limit{count.log();count=count+1}');assert.equal(zero.reason,'zero');assert.equal(zero.lesson,'counter');
 assert.equal(feedback('repeat','0.log();for dock in docks{(dock+offset).log()}').reason,'emptyList');
 assert.equal(feedback('names','unknown.log()').reason,'name');
 assert.equal(feedback('names','(cargo + reserve).log(').reason,'execution');
 assert.equal(feedback('message','let lost;?(n <- lost){(n+1).log()}').reason,'waiting');
 for(const id of diagnosticIds){assert.equal(diagnosticFeedback(id,null,'').reason,'untried');assert.equal(feedback(id,diagnosticPuzzle(42,id).example).reason,'passed');}
});
test('one correctly computed loop value cannot certify constant outputs elsewhere in the same case',()=>{
 const source='for dock in docks { if dock == 3 then { (dock + offset).log() } else { (1 + offset).log() } }';
 const report=inspectDiagnostic(42,'repeat',source),sample=report.cases[2];assert.deepEqual(sample.result.logs,sample.expected);assert.equal(sample.ok,false);assert.equal(sample.code,'conceptMissing');
 assert.equal(sample.checks.find(c=>c.id==='concepts').requirements.find(c=>c.concept==='for').passed,false);
});

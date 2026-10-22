import test from 'node:test';
import assert from 'node:assert/strict';
import { grade } from '../src/assessment.js';
import { course } from '../src/course.js';

test('full credit accepts distinct solutions, spacing and names',()=>{
  for(const source of ['(4 + 7).log()','(2+9).log();','let fuel = 3; (fuel + 8).log()',
    'let unused = 99; (1 + 10).log()']){
    const report=grade(source,course[1].independent);
    assert.equal(report.ok,true);assert.equal(report.score,100);
    assert.deepEqual(report.result.logs,['11']);
  }
});
test('partial scores separate execution, output and contributing concepts',()=>{
  const goal=course[1].independent;
  const wrongOutput=grade('(1+2).log()',goal);
  assert.equal(wrongOutput.score,50);assert.equal(wrongOutput.ok,false);
  const missingConcept=grade('11.log()',goal);
  assert.equal(missingConcept.score,70);assert.equal(missingConcept.code,'conceptMissing');
  const decoy=grade('let unused = 1+2; 11.log()',goal);
  assert.equal(decoy.score,70);assert.equal(decoy.ok,false);
  assert.equal(grade('let fuel = 6; (fuel+8).log()',course[2].independent).score,100);
  assert.equal(grade('let unused = 14; 14.log()',course[2].independent).score,70);
  const nameOnly=grade('let fuel = 14; fuel.log()',course[2].independent);
  const additionOnly=grade('(6+8).log()',course[2].independent);
  assert.equal(nameOnly.score,85);assert.equal(nameOnly.ok,false);
  assert.equal(additionOnly.score,85);assert.equal(additionOnly.ok,false);
});
test('invalid or unavailable programs receive zero with unexecuted checks',()=>{
  for(const source of ['', '12.log(', 'unknown.log()', 'fetch().log()', '1000001.log()']){
    const report=grade(source,course[0].independent);
    assert.equal(report.ok,false);assert.equal(report.score,0);assert.equal(report.result,null);
    assert.equal(report.checks[0].status,'fail');assert.equal(report.checks[1].status,'blocked');
  }
});
test('extra output cannot get full credit, and simple tasks still total 100',()=>{
  const goal={logs:['1','2'],require:[]};
  assert.equal(grade('1.log(); 2.log()',goal).score,100);
  const extra=grade('1.log(); 2.log(); 3.log()',goal);
  assert.ok(extra.score<100);assert.equal(extra.ok,false);
  const partial=grade('1.log(); 9.log()',goal);
  assert.equal(partial.score,60);assert.equal(partial.ok,false);
  assert.equal(grade('12.log()',course[0].independent).score,100);
});

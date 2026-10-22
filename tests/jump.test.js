import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/runner.js';
import { jumpOutcome, jumpPosition } from '../src/jump.js';
test('actual code output controls landing; distinct programs can reach the island',()=>{
  for(const source of ['(2 + 4).log()','(1 + 5).log()','let n = 3; (n + n).log()']){
    assert.deepEqual(jumpOutcome(run(source).logs,6),{valid:true,distance:6,target:6,landed:true,direction:'landed'});
  }
  assert.equal(jumpOutcome(run('(2 + 2).log()').logs,6).direction,'short');
  assert.equal(jumpOutcome(run('(4 + 5).log()').logs,6).direction,'long');
});
test('ambiguous or unsupported outputs never become a successful movement',()=>{
  for(const logs of [[],['6','6'],['-1'],['1.5'],['13'],['six'],['Infinity']])assert.equal(jumpOutcome(logs,6).valid,false);
  assert.equal(jumpOutcome(['0'],6).direction,'short');
});
test('a jump has exact endpoints and a raised midpoint, including clamped sampling',()=>{
  assert.deepEqual(jumpPosition(-1,6),{forward:0,height:0});
  assert.equal(jumpPosition(.5,6).forward,3);
  assert.equal(jumpPosition(.5,6).height,1);
  assert.equal(jumpPosition(2,6).forward,6);
  assert.ok(Math.abs(jumpPosition(1,6).height)<1e-12);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, run, LessonError } from '../src/runner.js';
test('six lesson programs produce expected output', () => {
  for (const [code, expected] of [
    ['7.log()', '7'], ['9.log()', '9'],
    ['(2 + 3).log()', '5'], ['(2 + 6).log()', '8'],
    ['let n = 5;\n(n + 2).log()', '7'], ['let n = 8;\n(n + 2).log()', '10'],
  ]) assert.deepEqual(run(code).logs, [expected]);
});
test('different correct programs may meet the same target', () => {
  for (const code of ['10.log()', '(4 + 6).log()', 'let energy = 8; (energy + 2).log()'])
    assert.deepEqual(run(code).logs, ['10']);
});
test('structure and undeclared names fail before execution', () => {
  for (const code of ['7.log(', 'n.log()', 'let n = n; n.log()', '7.log(); n.log()', '7;'])
    assert.throws(() => compile(code), LessonError);
});
test('unsupported syntax and ambient capabilities are rejected', () => {
  for (const code of ['fetch(7)', 'window.log()', 'while 1 {}', '1 / 0', 'eval(7)', '7.log(1)'])
    assert.throws(() => run(code), LessonError);
});
test('source, integer and nesting limits are enforced', () => {
  for (const code of [' '.repeat(4097), '1000001.log()', '('.repeat(70)+'7'+')'.repeat(70)+'.log()'])
    assert.throws(() => run(code), LessonError);
});
test('teaching step counts describe this model only', () => {
  assert.ok(run('(2 + 3).log()').steps > run('5.log()').steps);
});

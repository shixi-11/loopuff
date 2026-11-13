import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeLearningSteps, arcadeLearningIds, arcadeScoreInputs, arcadeStrategySeeds, createArcadeLearningSession, inspectArcadeLearning} from '../src/arcade-learning.js';
import {startSteps, inspectStartStep} from '../src/learning-paths.js';
import {handheldInput, compileHandheld} from '../src/handheld.js';

test('eleven steps retain the existing first five starters and examples', () => {
  assert.deepEqual(arcadeLearningIds, ['run', 'change', 'repair', 'calculate', 'name', 'score', 'select', 'control', 'repeat', 'finish', 'strategy']);
  for (const step of arcadeLearningSteps.slice(0, 5)) {
    const old = startSteps.find(item => item.id === step.id);
    assert.equal(step.starter, old.starter); assert.equal(step.example, old.example);
    for (const source of [step.starter, step.example, '1.log()', '7.log(']) {
      const actual = inspectArcadeLearning(step.id, source), expected = inspectStartStep(step.id, source);
      assert.equal(actual.ok, expected.ok); assert.equal(actual.code, expected.code);
      assert.deepEqual(actual.cases.map(item => item.result?.logs), expected.cases.map(item => item.result?.logs));
    }
  }
});

test('every published example passes against real interpreter and game engines', () => {
  for (const step of arcadeLearningSteps) {
    const report = inspectArcadeLearning(step.id, step.example);
    assert.equal(report.ok, true, `${step.id}: ${report.code} ${JSON.stringify(report.cases.map(item => item.checks))}`);
    assert.deepEqual(JSON.parse(JSON.stringify(report)), report, step.id + ' JSON state');
    assert.ok(report.world); assert.ok(report.observe); assert.ok(report.actualResults.length);
  }
});

test('new starters expose complete syntax without already satisfying their learning goals', () => {
  const score = arcadeLearningSteps.find(step => step.id === 'score');
  const strategy = arcadeLearningSteps.find(step => step.id === 'strategy');
  assert.equal(score.starter, 'if score > 9 then { 0.log() } else { 0.log() }');
  assert.match(strategy.starter, /if x < targetX then \{ left\(\) \}/);
  assert.match(strategy.starter, /if x > targetX then \{ right\(\) \} else \{ drop\(\) \}/);
  for (const step of arcadeLearningSteps.slice(5)) assert.equal(inspectArcadeLearning(step.id, step.starter).ok, false, step.id);
});

test('score exercises both sides and the boundary with genuine condition contributions', () => {
  const valid = ['if score >= 10 then { 1.log() } else { 0.log() }', 'if 10 > score then { 0.log() } else { 1.log() }'];
  for (const source of valid) {
    const report = inspectArcadeLearning('score', source); assert.equal(report.ok, true);
    assert.deepEqual(report.cases.map(item => item.scoreInput), [0, 9, 10, 12, 20]);
    assert.deepEqual(report.cases.map(item => item.result.logs), [['0'], ['0'], ['1'], ['1'], ['1']]);
  }
  for (const source of ['1.log()', '0.log()', 'if score > 10 then {1.log()} else {0.log()}', 'if true then { 1.log() } else { 0.log() }', 'if score > 9 then {}; 1.log()']) assert.equal(inspectArcadeLearning('score', source).ok, false, source);
});

test('selection applies real cartridge commands and must finish ready on flight', () => {
  for (const source of ['choose(3)', 'let cartridge = 1 + 2; choose(cartridge)', 'choose(2); choose(3)']) {
    const report = inspectArcadeLearning('select', source); assert.equal(report.ok, true, source);
    assert.equal(report.game, 'flight'); assert.equal(report.session.selected, 2); assert.equal(report.session.status, 'ready');
  }
  for (const source of ['choose(1)', 'choose(2)', 'choose(3); start()', 'choose(3); choose(1)']) assert.equal(inspectArcadeLearning('select', source).ok, false, source);
});

test('control must really move the tank right and fire within 120 fixed ticks', () => {
  const report = inspectArcadeLearning('control', 'start(); right(); fire()');
  assert.equal(report.ok, true); assert.equal(report.session.activeMs, 2400);
  assert.ok(report.world.player.x > report.cases[0].initial.world.player.x); assert.ok(report.actualResults[0].shots > 0);
  for (const source of ['start()', 'right(); fire()', 'start(); right()', 'start(); fire()', 'start(); left(); fire()', 'start(); fire(); finish()']) assert.equal(inspectArcadeLearning('control', source).ok, false, source);
  assert.equal(inspectArcadeLearning('control', 'start();right();fire();choose(2);start();right()').ok, false, 'a shot from the discarded world cannot satisfy the new world');
});

test('control requires effective right movement before the first effective shot', () => {
  for (const source of ['start();fire();right()', 'start();fire();right();fire()', 'right();start();fire();right()', 'fire();start();right()']) {
    assert.equal(inspectArcadeLearning('control', source).ok, false, source);
  }
  for (const source of ['start();right();fire()', 'start();right();wait();fire()', 'fire();start();right();fire()']) {
    const report = inspectArcadeLearning('control', source);
    assert.equal(report.ok, true, source);
    const right = report.cases[0].effectEvents.find(event => event.type === 'moveRight');
    const shot = report.cases[0].effectEvents.find(event => event.type === 'fired');
    assert.ok(right.xAfter > right.xBefore);
    assert.ok(right.tick < shot.tick);
    assert.ok(shot.xBefore > report.cases[0].initial.world.player.x);
  }
});

test('repetition accepts different real loops and rejects dead loops or unrelated output', () => {
  for (const source of ['start(); for n in [1,2,3] { right() }', 'start(); for n in 0..3 { right() }', 'start(); let n = 0; while n < 3 { right(); n = n + 1 }']) {
    const report = inspectArcadeLearning('repeat', source); assert.equal(report.ok, true, source);
    assert.equal(report.world.piece.x, report.cases[0].initial.world.piece.x + 3);
    assert.deepEqual(report.cases[0].events.filter(item => item.command === 2).map(item => item.tick), [6, 12, 18]);
  }
  for (const source of ['start();right();right();right()', 'start(); for n in [] {right()};right();right();right()', 'start();for n in [1] {wait()};right();right();right()', 'start();for n in [1] {right()};right();right()', 'start();for n in [1,2] {right()}', 'start();for n in [1,2,3,4] {right()}']) assert.equal(inspectArcadeLearning('repeat', source).ok, false, source);
  assert.equal(inspectArcadeLearning('repeat', 'start();for n in [1,2,3]{right()};choose(1);start();right();right();right()').ok, false, 'a loop in a discarded world cannot contribute to the final result');
});

test('finish acts on a running flight world, and pause is a different state', () => {
  const report = inspectArcadeLearning('finish', 'finish()'); assert.equal(report.ok, true);
  assert.equal(report.cases[0].initial.status, 'running'); assert.equal(report.session.status, 'ended'); assert.equal(report.game, 'flight');
  for (const source of ['pause()', 'start()', 'finish();start()', 'choose(1);finish()']) assert.equal(inspectArcadeLearning('finish', source).ok, false, source);
});

test('strategy decisions track real targets in both directions and place scored pieces for multiple seeds', () => {
  const alternate = 'if targetX > x then {right()} else {if targetX < x then {left()} else {drop()}}';
  const report = inspectArcadeLearning('strategy', alternate); assert.equal(report.ok, true);
  assert.deepEqual(report.cases.map(item => item.seed), [1, 147, 2026]);
  assert.deepEqual(report.cases.map(item => item.decisions[0].command), [2, 1, 1]);
  for (const item of report.cases) { assert.ok(item.world.pieces > 0); assert.ok(item.world.score > 0); assert.ok(item.decisions.every(event => event.command === event.expected)); }
  for (const source of ['drop()', 'if score >= 0 then {drop()}', 'if x < targetX then {}; drop()', 'if true then {right()} else {left()}', 'right()', 'if x < targetX then {left()} else {drop()}', 'start();drop()']) assert.equal(inspectArcadeLearning('strategy', source).ok, false, source);
});

test('animation snapshots preserve real initial/final worlds and bounded original tick timing', () => {
  assert.deepEqual(arcadeScoreInputs, [0, 9, 10, 12, 20]);
  assert.deepEqual(arcadeStrategySeeds, [1, 147, 2026]);
  for (const step of arcadeLearningSteps.filter(item => item.kind !== 'output')) {
    const report = inspectArcadeLearning(step.id, step.example);
    assert.equal(report.frames, report.cases[0].frames);
    assert.ok(report.cases.reduce((sum, item) => sum + item.frames.length, 0) <= 123);
    for (const item of report.cases) {
      assert.ok(item.frames.length >= 2 && item.frames.length <= 41);
      assert.equal(item.frames[0].tick, 0); assert.deepEqual(item.frames[0].session, item.initial);
      assert.deepEqual(item.frames.at(-1).session, item.session);
      assert.ok(item.frames.every((frame, index) => index === 0 || frame.tick > item.frames[index - 1].tick));
      assert.deepEqual(item.actualInput, handheldInput(item.initial));
    }
    assert.equal(report.frames.at(-1).tick, step.kind === 'strategy' ? 240 : 120);
  }
  const control = inspectArcadeLearning('control', 'start(); right(); fire()');
  assert.equal(control.frames[0].session.world.player.x, 72);
  assert.equal(createArcadeLearningSession('tanks').world.player.x,120,'the actual cartridge spawn is unchanged');
  assert.ok(control.frames[2].session.world.player.x > control.frames[0].session.world.player.x);
  const before = JSON.stringify(control.frames[1]); control.world.player.x = -99;
  assert.equal(JSON.stringify(control.frames[1]), before, 'frames are snapshots, not live aliases');
});

test('inspection is deterministic, bounded, isolated and never mutates legacy definitions', () => {
  const original = JSON.stringify(startSteps), source = arcadeLearningSteps.at(-1).example;
  const a = inspectArcadeLearning('strategy', source), b = inspectArcadeLearning('strategy', source);
  assert.deepEqual(a, b); a.world.board[19].fill(7); assert.notDeepEqual(a, inspectArcadeLearning('strategy', source));
  assert.equal(JSON.stringify(startSteps), original);
  const requirement = arcadeLearningSteps.find(step => step.id === 'calculate').require;
  requirement.push('test-only'); assert.equal(JSON.stringify(startSteps), original); requirement.pop();
  const s1 = createArcadeLearningSession(), s2 = createArcadeLearningSession(); s1.world.board[0][0] = 7; assert.equal(s2.world.board[0][0], 0);
  for (const id of arcadeLearningIds) {
    assert.equal(inspectArcadeLearning(id, 'x'.repeat(4097)).code, 'limit');
    assert.equal(inspectArcadeLearning(id, null).code, 'limit');
  }
  for (const id of ['select', 'control', 'repeat', 'finish', 'strategy']) {
    assert.equal(inspectArcadeLearning(id, 'while true { wait() }').ok, false);
    assert.equal(inspectArcadeLearning(id, 'bad(').ok, false);
  }
  assert.throws(() => inspectArcadeLearning('missing', ''), RangeError);
});

test('game errors retain the source position returned by the handheld compiler', () => {
  const source = 'start();\nright(';
  let compilerError;
  try { compileHandheld(source, createArcadeLearningSession('tanks')); } catch (error) { compilerError = error; }
  assert.ok(compilerError && Number.isInteger(compilerError.position));
  const report = inspectArcadeLearning('control', source);
  assert.equal(report.ok, false); assert.equal(report.cases[0].position, compilerError.position);
});

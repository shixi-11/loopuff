import test from 'node:test';
import assert from 'node:assert/strict';
import {createSokoban, stepSokoban, observeSokoban, drawSokoban} from '../src/handheld-sokoban.js';

// Solutions were found against the authored boards, then replayed through the
// public movement API. Directions: 1 up, 2 right, 3 down, 4 left.
const SOLUTIONS = ['2', '441', '12321', '441141233223211', '122113344441232113222321'];
const actions = path => [...path].map(Number);
const clone = value => JSON.parse(JSON.stringify(value));

function freeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return value;
}

function reachLevel(level) {
  let state = createSokoban(73);
  for (let i = 0; i < level - 1; i++) state = stepSokoban(state, 0, actions(SOLUTIONS[i]));
  return state;
}

for (let index = 0; index < SOLUTIONS.length; index++) {
  test(`original level ${index + 1} is genuinely solved by legal single-cell actions`, () => {
    let state = reachLevel(index + 1);
    assert.equal(state.level, index + 1);
    assert.equal(state.boxes.length, state.board.join('').split('.').length - 1);
    assert.equal(state.moves, 0);
    let pushes = 0;
    const path = actions(SOLUTIONS[index]);
    for (let i = 0; i < path.length; i++) {
      const before = clone(state), action = path[i];
      const [dx, dy] = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]][action];
      const x = before.player.x + dx, y = before.player.y + dy;
      assert.notEqual(before.board[y][x], '#');
      const box = before.boxes.find(box => box.x === x && box.y === y);
      const expectedBoxes = before.boxes.map(box => ({...box}));
      if (box) {
        pushes++;
        assert.notEqual(before.board[y + dy][x + dx], '#');
        assert.ok(!before.boxes.some(box => box.x === x + dx && box.y === y + dy));
        Object.assign(expectedBoxes.find(box => box.x === x && box.y === y), {x: x + dx, y: y + dy});
      }
      const solved = expectedBoxes.every(box => before.board[box.y][box.x] === '.');
      assert.equal(solved, i === path.length - 1, 'the final action places every box on a goal');
      state = stepSokoban(state, i % 2 ? 0 : 1e6, [action]);
      if (!solved || index === SOLUTIONS.length - 1) {
        assert.deepEqual(state.player, {x, y});
        assert.deepEqual(state.boxes, expectedBoxes);
        assert.equal(state.moves, i + 1);
        assert.equal(state.pushes, pushes);
      }
    }
    assert.equal(state.score, (index + 1) * (index + 2) * 50);
    assert.deepEqual(state.completed, Array.from({length: index + 1}, (_, i) => i + 1));
    assert.equal(state.won, index === SOLUTIONS.length - 1);
    assert.equal(state.over, state.won);
    assert.equal(state.history.length, 0);
    if (!state.won) assert.equal(state.level, index + 2);
  });
}

test('waiting and dt never move; repeated commands each move exactly one cell', () => {
  const initial = createSokoban();
  assert.deepEqual(stepSokoban(initial, 99999, [0, 0, 0]), initial);
  assert.deepEqual(stepSokoban(initial, 99999), initial);
  const state = stepSokoban(initial, 0, [4, 4, 4]);
  assert.deepEqual(state.player, {x: 1, y: 2});
  assert.equal(state.moves, 1);
  assert.equal(state.history.length, 1);
  assert.equal(state.pushes, 0);
});

test('walls, double boxes and boxes against walls block movement without history', () => {
  const initial = createSokoban();
  const wall = stepSokoban(initial, 0, [1]);
  assert.deepEqual(stepSokoban(wall, 0, [1]), wall);
  const double = stepSokoban(reachLevel(4), 0, [1]);
  assert.deepEqual(double.player, {x: 4, y: 3});
  assert.deepEqual(stepSokoban(double, 0, [4]), double);
  const jam = clone(initial);
  jam.player = {x: 4, y: 1};
  jam.boxes = [{x: 5, y: 1}];
  assert.deepEqual(stepSokoban(jam, 0, [2]), jam);
});

test('walking away cannot pull a box', () => {
  const state = createSokoban();
  const next = stepSokoban(state, 0, [4]);
  assert.deepEqual(next.boxes, state.boxes);
  assert.deepEqual(next.player, {x: 1, y: 2});
});

test('undo restores player, boxes, direction and counters; blocked input adds no undo', () => {
  const state = reachLevel(3);
  const next = stepSokoban(state, 0, [2, 2, 1]);
  assert.equal(next.pushes, 1);
  assert.equal(next.moves, 3);
  const beforePush = stepSokoban(state, 0, [2, 2]);
  assert.deepEqual(stepSokoban(next, 0, [5]), beforePush);
  assert.deepEqual(stepSokoban(next, 0, [5, 5, 5, 5]), state);
  const edge = stepSokoban(createSokoban(), 0, [4, 4, 5]);
  assert.deepEqual(edge, createSokoban());
});

test('restart restores only the current puzzle and undo/restart cannot farm score', () => {
  let state = reachLevel(3);
  const initial = clone(state);
  for (let i = 0; i < 20; i++) {
    state = stepSokoban(state, 0, [1, 5, 1, 6, 5]);
    assert.deepEqual(state, initial);
    assert.equal(state.score, 300);
  }
  state = stepSokoban(state, 0, actions(SOLUTIONS[2]));
  assert.equal(state.score, 600);
  assert.equal(state.level, 4);
  assert.deepEqual(stepSokoban(state, 0, [5, 6, 5, 6]), state);
  // Even a deliberately restored completed board cannot mint that reward twice.
  const replay = {...clone(initial), score: state.score, completed: [...state.completed]};
  assert.equal(stepSokoban(replay, 0, actions(SOLUTIONS[2])).score, 600);
});

test('batches preserve command order, advance levels, and stop on final victory', () => {
  const all = SOLUTIONS.flatMap(actions);
  const batched = stepSokoban(createSokoban(91), 0, [...all, 6, 5, 4]);
  let single = createSokoban(91);
  for (const action of all) single = stepSokoban(single, .01, [action]);
  assert.deepEqual(batched, single);
  assert.equal(single.score, 1500);
  assert.equal(single.over, true);
  assert.equal(single.won, true);
  assert.deepEqual(stepSokoban(single, 100, [6, 5, 1, 2]), single);
});

test('state and history are immutable, JSON-roundtrippable and deterministic', () => {
  const initial = freeze(stepSokoban(createSokoban(42), 0, [1, 4]));
  const saved = JSON.stringify(initial);
  const next = stepSokoban(initial, 12, [5, 2, 3, 6]);
  assert.equal(JSON.stringify(initial), saved);
  assert.notEqual(next, initial);
  assert.notEqual(next.boxes, initial.boxes);
  assert.notEqual(next.board, initial.board);
  assert.deepEqual(next, JSON.parse(JSON.stringify(next)));
  let a = createSokoban(42), b = createSokoban(42);
  for (const commands of [[1, 4], [5, 2, 3, 6], [2], [4, 4, 1], [6]]) {
    a = stepSokoban(a, 0, commands);
    b = stepSokoban(clone(b), 10000, commands);
    assert.deepEqual(a, b);
  }
});

test('local observation uses documented integer tile categories and counters', () => {
  const state = createSokoban();
  assert.deepEqual(observeSokoban(state), {
    playerX: 2, playerY: 2, level: 1, moves: 0, pushes: 0, boxesOnGoals: 0,
    up: 0, right: 3, down: 0, left: 0, score: 0, over: 0, won: 0
  });
  const fixture = clone(state);
  fixture.player = {x: 4, y: 1};
  fixture.boxes = [{x: 4, y: 2}];
  assert.equal(observeSokoban(fixture).up, 1);
  assert.equal(observeSokoban(fixture).down, 4);
  assert.equal(observeSokoban(fixture).boxesOnGoals, 1);
  fixture.boxes = [];
  assert.equal(observeSokoban(fixture).down, 2);
  fixture.player = {x: 0, y: 0};
  assert.equal(observeSokoban(fixture).left, 1);
});

test('invalid time and action containers are rejected without changing input', () => {
  const state = freeze(createSokoban());
  for (const dt of [-1, NaN, Infinity, -Infinity]) assert.throws(() => stepSokoban(state, dt), RangeError);
  assert.throws(() => stepSokoban(state, 0, null), TypeError);
  assert.deepEqual(stepSokoban(state, 0, [-1, 7, '2', 1.5, null]), state);
});

test('renderer supports host dimensions, draws pixels only, and preserves state', () => {
  const state = freeze(createSokoban());
  const saved = JSON.stringify(state), rectangles = [];
  const ctx = {save() {}, restore() {}, scale() {}, translate() {}, fillRect(...args) { rectangles.push(args); }};
  drawSokoban(ctx, state);
  drawSokoban(ctx, state, 640, 480);
  assert.ok(rectangles.length > 100);
  assert.ok(rectangles.every(rect => rect.every(Number.isFinite)));
  assert.equal(JSON.stringify(state), saved);
  const count = rectangles.length;
  drawSokoban(ctx, state, 0, 240);
  assert.equal(rectangles.length, count);
});

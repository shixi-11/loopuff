import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnake, stepSnake, observeSnake, drawSnake} from '../src/handheld-snake.js';

const copy = state => JSON.parse(JSON.stringify(state));
const active = () => ({...createSnake(5), readyTicks: 0});
const move = (state, actions = []) => stepSnake(state, (28 - Math.min(18, state.eaten)) / 120, actions);

test('state serializes, input remains deeply unchanged, and equal seeds replay identically', () => {
  const original = createSnake(42), before = copy(original);
  Object.freeze(original.snake[0]);
  Object.freeze(original.snake);
  Object.freeze(original.food);
  Object.freeze(original);
  const next = stepSnake(original, 1.2, [3]);
  assert.deepEqual(original, before);
  assert.notEqual(next, original);
  assert.notEqual(next.snake, original.snake);
  assert.notEqual(next.food, original.food);
  let a = createSnake(42), b = copy(a);
  for (const [dt, actions] of [[1, [3]], [.4, [1]], [.2, [4]], [.5, [2]], [.1, [0]], [.4, [3]]]) {
    a = stepSnake(a, dt, actions);
    b = stepSnake(copy(b), dt, actions);
    assert.deepEqual(a, b);
    assert.deepEqual(a, copy(a));
  }
  assert.notDeepEqual(createSnake(42).food, createSnake(142).food);
});

test('initial pause gives time to choose direction, followed by continuous movement', () => {
  const state = createSnake();
  const waiting = stepSnake(state, .75, [3]);
  assert.deepEqual(waiting.snake, state.snake);
  assert.equal(waiting.readyTicks, 0);
  const moving = move(waiting);
  assert.deepEqual(moving.snake[0], {x: 6, y: 6});
  assert.equal(moving.direction, 3);
  assert.deepEqual(move(moving).snake[0], {x: 6, y: 5});
});

test('fractional time is retained and split elapsed time agrees with a whole interval', () => {
  const state = active();
  let split = state;
  for (let i = 0; i < 60; i++) split = stepSnake(split, 1 / 60);
  assert.deepEqual(split, stepSnake(state, 1));
  assert.deepEqual(stepSnake(state, 1 / 240).snake, state.snake);
  assert.equal(stepSnake(stepSnake(state, 1 / 240), 1 / 240).ticks, 1);
});

test('food grows the snake, scores, accelerates, and respawns only on unoccupied cells', () => {
  let state = active();
  state.food = {x: 7, y: 7};
  const before = copy(state), eatingState = state;
  state = move(state);
  assert.deepEqual(eatingState, before);
  assert.equal(state.snake.length, 4);
  assert.equal(state.eaten, 1);
  assert.equal(state.score, 10);
  assert.ok(!state.snake.some(cell => cell.x === state.food.x && cell.y === state.food.y));
  const almost = stepSnake(state, 26 / 120);
  assert.deepEqual(almost.snake, state.snake);
  assert.deepEqual(stepSnake(almost, 1 / 120).snake[0], {x: 8, y: 7});
});

test('reversal is rejected and rapid queued turns cannot reverse before movement', () => {
  const state = active();
  assert.equal(move(state, [1]).direction, 2);
  const queued = stepSnake(state, 0, [3, 1, 4]);
  assert.equal(queued.pendingDirection, 3);
  assert.equal(stepSnake(queued, 0, [4]).pendingDirection, 3);
  const turned = move(queued);
  assert.deepEqual(turned.snake[0], {x: 6, y: 6});
  assert.equal(move(turned, [4]).direction, 3);
  assert.equal(move(turned, [1]).direction, 1);
});

test('wall and self collision stop without moving the head into invalid cells', () => {
  const wall = {...active(), snake: [{x: 19, y: 4}, {x: 18, y: 4}, {x: 17, y: 4}]};
  const hit = move(wall);
  assert.equal(hit.over, true);
  assert.equal(hit.won, false);
  assert.deepEqual(hit.snake, wall.snake);
  const self = {...active(), direction: 3,
    snake: [{x: 4, y: 4}, {x: 4, y: 5}, {x: 5, y: 5}, {x: 5, y: 4}, {x: 5, y: 3}, {x: 4, y: 3}, {x: 3, y: 3}]};
  assert.equal(move(self, [2]).over, true);
  const danger = observeSnake(self);
  assert.deepEqual([danger.dangerLeft, danger.dangerRight, danger.dangerUp, danger.dangerDown], [0, 1, 1, 1]);
});

test('entering a vacating tail is legal, while danger observations include reversal', () => {
  const state = {...active(), snake: [{x: 4, y: 4}, {x: 3, y: 4}, {x: 3, y: 5}, {x: 4, y: 5}]};
  const observation = observeSnake(state);
  assert.equal(observation.dangerDown, 0);
  assert.equal(observation.dangerLeft, 1);
  const next = move(state, [4]);
  assert.equal(next.over, false);
  assert.deepEqual(next.snake[0], {x: 4, y: 5});
  assert.equal(next.snake.length, 4);
  assert.ok(Object.values(observation).every(Number.isInteger));
});

test('eating the final empty cell wins with no food, no duplicate cells, and frozen play', () => {
  const snake = [];
  // A contiguous Hamiltonian path covers the board except (0, 0).
  for (let y = 0; y < 14; y++) {
    const columns = Array.from({length: 20}, (_, x) => y % 2 ? 19 - x : x);
    for (const x of columns) if (x || y) snake.push({x, y});
  }
  const state = {...active(), snake, direction: 1, food: {x: 0, y: 0}};
  assert.equal(snake.length, 279);
  const won = move(state);
  assert.equal(won.won, true);
  assert.equal(won.over, true);
  assert.equal(won.snake.length, 280);
  assert.equal(new Set(won.snake.map(cell => `${cell.x},${cell.y}`)).size, 280);
  assert.equal(won.food, null);
  assert.equal(observeSnake(won).foodX, -1);
  const stopped = stepSnake(won, 100, [4]);
  assert.deepEqual(stopped, won);
  assert.notEqual(stopped, won);
});

test('a complete game can follow a safe grid cycle from the real opening to a full-board victory', () => {
  let state = createSnake(1742), moves = 0;
  while (!state.over && moves++ < 80000) {
    const {headX: x, headY: y} = observeSnake(state);
    // Reserve the rightmost column as the return lane; sweep all other rows.
    const action = x === 19 ? (y === 0 ? 1 : 3)
      : y === 0 ? (x > 0 ? 1 : 4)
      : y % 2 ? (x < 18 || y === 13 ? 2 : 4)
      : x > 0 ? 1 : 4;
    state = move(state, [action]);
  }
  assert.ok(moves < 80000, 'the cycle must actually reach the victory branch');
  assert.equal(state.won, true);
  assert.equal(state.snake.length, 280);
  assert.equal(state.eaten, 277);
  assert.equal(state.score, 2770);
});

test('bad time is rejected and invalid actions are ignored without state mutation', () => {
  const state = active();
  for (const dt of [-1, Infinity, NaN, Number.MAX_VALUE]) assert.throws(() => stepSnake(state, dt), RangeError);
  assert.deepEqual(stepSnake(state, 0, [null, '3', 1.2, -1, 5, 0]), state);
  assert.deepEqual(stepSnake(state, 0, null), state);
});

test('rendering normal, collision, and victory states has no state or simulation side effects', () => {
  const calls = [];
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'scale', 'fillRect'].map(key => [key, (...args) => calls.push([key, ...args])]));
  for (const state of [createSnake(9), {...createSnake(9), over: true}, {...createSnake(9), over: true, won: true, food: null}]) {
    const before = copy(state);
    drawSnake(ctx, state);
    drawSnake(ctx, state, 480, 320);
    assert.deepEqual(state, before);
  }
  assert.equal(calls.filter(call => call[0] === 'save').length, 6);
  assert.equal(calls.filter(call => call[0] === 'restore').length, 6);
  assert.ok(calls.some(call => call[0] === 'fillRect'));
});

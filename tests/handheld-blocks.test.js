import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlocks, stepBlocks, observeBlocks, drawBlocks} from '../src/handheld-blocks.js';

const occupied = state => state.board.flat().filter(Boolean).length;
const piece = (state, type, rotation, x, y) => {
  state.piece = {type, rotation, x, y};
  state.gravityTicks = state.lockTicks = state.lockResets = 0;
};

test('state is JSON serializable and equal seeds replay the same seven bags', () => {
  const a = createBlocks(147), b = createBlocks(147);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
  const sequence = [];
  for (let i = 0; i < 28; i++) {
    sequence.push(a.piece.type);
    a.board.forEach(row => row.fill(0));
    b.board.forEach(row => row.fill(0));
    stepBlocks(a, 0, [5]);
    stepBlocks(b, 0, [5]);
  }
  assert.deepEqual(a, b);
  for (let i = 0; i < 28; i += 7) assert.deepEqual(sequence.slice(i, i + 7).sort(), [1, 2, 3, 4, 5, 6, 7]);
  assert.notDeepEqual(createBlocks(147).bag, createBlocks(148).bag);
});

test('all seven pieces have exactly four cells after a real hard drop', () => {
  for (let type = 1; type <= 7; type++) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const state = createBlocks();
      piece(state, type, rotation, 3, 0);
      const returned = stepBlocks(state, 0, [5]);
      assert.equal(returned, state);
      assert.equal(occupied(state), 4, `type ${type}, rotation ${rotation}`);
      assert.equal(state.pieces, 1);
    }
  }
});

test('horizontal inputs cannot cross either wall for any piece rotation', () => {
  for (let type = 1; type <= 7; type++) for (let rotation = 0; rotation < 4; rotation++) {
    for (const action of [1, 2]) {
      const state = createBlocks();
      piece(state, type, rotation, 3, 0);
      stepBlocks(state, 0, Array(40).fill(action));
      const x = state.piece.x;
      stepBlocks(state, 0, [action]);
      assert.equal(state.piece.x, x);
      stepBlocks(state, 0, [5]);
      assert.equal(occupied(state), 4);
      const columns = state.board.flatMap(row => row.flatMap((value, x) => value ? [x] : []));
      assert.ok(columns.every(column => column >= 0 && column < 10));
      assert.ok(columns.includes(action === 1 ? 0 : 9));
    }
  }
});

test('clockwise rotation works in open space and I piece kicks away from left wall', () => {
  const state = createBlocks();
  piece(state, 1, 1, -2, 3); // vertical I occupies column 0
  stepBlocks(state, 0, [3]);
  assert.equal(state.piece.rotation, 2);
  assert.equal(state.piece.x, 0);
  stepBlocks(state, 0, [5]);
  assert.deepEqual(state.board[19].slice(0, 4), [1, 1, 1, 1]);
});

test('floor kick rotates a resting T without putting cells below the board', () => {
  const state = createBlocks();
  piece(state, 6, 0, 3, 17);
  stepBlocks(state, 0, [3]);
  assert.equal(state.piece.rotation, 1);
  assert.equal(state.piece.y, 17);
  stepBlocks(state, 0, [3]);
  assert.equal(state.piece.rotation, 2);
  stepBlocks(state, 0, [5]);
  assert.equal(occupied(state), 4);
  const i = createBlocks();
  piece(i, 1, 0, 3, 18); // horizontal I on bottom row
  stepBlocks(i, 0, [3]);
  assert.equal(i.piece.rotation, 1);
  assert.equal(i.piece.y, 16);
  stepBlocks(i, 0, [5]);
  assert.equal(occupied(i), 4);
});

test('rotation is rejected when every kick collides with the stack', () => {
  const state = createBlocks();
  state.board.forEach(row => row.fill(2));
  // Only the four cells of the current T are open.
  for (const [x, y] of [[3, 9], [4, 9], [5, 9], [4, 10]]) state.board[y][x] = 0;
  piece(state, 6, 0, 3, 8);
  const before = structuredClone(state.piece);
  stepBlocks(state, 0, [3]);
  assert.deepEqual(state.piece, before);
});

test('O rotation does not move or change a square piece', () => {
  const state = createBlocks();
  piece(state, 4, 0, 0, 18);
  const before = structuredClone(state.piece);
  stepBlocks(state, 0, [3, 3, 3]);
  assert.deepEqual(state.piece, before);
});

test('hard drop stacks above existing cells instead of tunnelling through them', () => {
  const state = createBlocks();
  state.board[18][4] = 2;
  state.board[19][4] = 2;
  piece(state, 4, 0, 4, 0);
  stepBlocks(state, 0, [5]);
  assert.equal(state.board[16][4], 4);
  assert.equal(state.board[17][4], 4);
  assert.equal(state.board[18][4], 2);
  assert.equal(occupied(state), 6);
});

test('completed bottom line is actually removed and rows above descend once', () => {
  const state = createBlocks();
  state.board[19].fill(2);
  for (let x = 3; x <= 6; x++) state.board[19][x] = 0;
  state.board[18][0] = 3;
  piece(state, 1, 0, 3, 0);
  stepBlocks(state, 0, [5]);
  assert.equal(state.lines, 1);
  assert.equal(state.lastClear, 1);
  assert.equal(state.score, 136); // 18-row hard drop × 2 plus single-line 100
  assert.equal(occupied(state), 1);
  assert.equal(state.board[19][0], 3);
  assert.ok(state.board[0].every(value => value === 0));
});

test('one vertical I clears four lines at once and earns four-line score', () => {
  const state = createBlocks();
  for (let y = 16; y < 20; y++) {
    state.board[y].fill(2);
    state.board[y][4] = 0;
  }
  piece(state, 1, 1, 2, 0);
  stepBlocks(state, 0, [5]);
  assert.equal(state.lines, 4);
  assert.equal(state.lastClear, 4);
  assert.equal(state.score, 832);
  assert.equal(occupied(state), 0);
});

test('cleared lines raise the level at ten lines', () => {
  const state = createBlocks();
  state.lines = 9;
  state.board[19].fill(2);
  for (let x = 3; x <= 6; x++) state.board[19][x] = 0;
  piece(state, 1, 0, 3, 0);
  stepBlocks(state, 0, [5]);
  assert.equal(state.lines, 10);
  assert.equal(state.level, 2);
});

test('resting piece has a lock delay and locks after the delay elapses', () => {
  const state = createBlocks();
  piece(state, 4, 0, 4, 18);
  stepBlocks(state, 0.4);
  assert.equal(occupied(state), 0);
  assert.equal(state.pieces, 0);
  stepBlocks(state, 0.06);
  assert.equal(occupied(state), 4);
  assert.equal(state.pieces, 1);
});

test('ground movement briefly resets lock delay but cannot stall forever', () => {
  const state = createBlocks();
  piece(state, 4, 0, 4, 18);
  for (let i = 0; i < 15; i++) {
    stepBlocks(state, 0.1, [i % 2 ? 1 : 2]);
    assert.equal(state.pieces, 0);
  }
  assert.equal(state.lockResets, 15);
  for (let i = 0; i < 5 && state.pieces === 0; i++) stepBlocks(state, 0.1, [i % 2 ? 1 : 2]);
  assert.equal(state.pieces, 1);
});

test('blocked spawn ends play and does not overwrite the obstructing stack', () => {
  const state = createBlocks();
  piece(state, 4, 0, 0, 18);
  state.next = 4;
  state.board[0][3] = 6;
  stepBlocks(state, 0, [5]);
  assert.equal(state.over, true);
  assert.equal(state.won, false);
  assert.equal(state.board[0][3], 6);
  const frozen = structuredClone(state);
  stepBlocks(state, 5, [1, 2, 3, 4, 5]);
  assert.deepEqual(state, frozen);
});

test('locking with cells above the ceiling ends play without a partial merge', () => {
  const state = createBlocks();
  piece(state, 6, 0, 3, -2);
  for (let x = 3; x <= 5; x++) state.board[1][x] = 2;
  const before = structuredClone(state.board);
  stepBlocks(state, 0, [5]);
  assert.equal(state.over, true);
  assert.deepEqual(state.board, before);
  assert.equal(state.pieces, 0);
});

test('elapsed time is invariant to splitting into frames, including multiple locks', () => {
  const whole = createBlocks(76), frames = createBlocks(76);
  stepBlocks(whole, 40);
  for (let i = 0; i < 2400; i++) stepBlocks(frames, 1 / 60);
  assert.ok(whole.pieces >= 2);
  assert.deepEqual(frames, whole);
});

test('JSON resume retains sub-tick time and gives the same next result', () => {
  const state = createBlocks(999);
  stepBlocks(state, 0.007, [1, 3]);
  const resumed = JSON.parse(JSON.stringify(state));
  stepBlocks(state, 2.013);
  stepBlocks(resumed, 2.013);
  assert.deepEqual(resumed, state);
});

test('observation is integer-only, non-mutating, and suggests a real line-clear gap', () => {
  const state = createBlocks();
  piece(state, 1, 0, 3, 0);
  state.board[19].fill(2);
  for (let x = 0; x < 4; x++) state.board[19][x] = 0;
  const before = structuredClone(state);
  const observed = observeBlocks(state);
  assert.deepEqual(Object.keys(observed), ['x', 'y', 'targetX', 'score', 'lines', 'danger']);
  assert.ok(Object.values(observed).every(Number.isInteger));
  assert.equal(observed.targetX, 0);
  assert.equal(observed.danger, 1);
  assert.deepEqual(state, before);
  stepBlocks(state, 0, [1, 1, 1, 5]);
  assert.equal(state.lines, 1);
});

test('drawing fits different canvas sizes and never changes simulation state', () => {
  const state = createBlocks(), before = structuredClone(state);
  let count = 0;
  const ctx = {save() {}, restore() {}, translate() {}, scale() {}, fillRect(x, y, w, h) {
    assert.ok([x, y, w, h].every(Number.isFinite));
    assert.ok(w >= 0 && h >= 0);
    count++;
  }};
  for (const [w, h] of [[320, 240], [640, 480], [240, 320]]) drawBlocks(ctx, state, w, h);
  state.over = true;
  drawBlocks(ctx, state, 320, 240);
  state.over = false;
  assert.ok(count > 600);
  assert.deepEqual(state, before);
});

test('invalid elapsed time is rejected without mutating a running game', () => {
  const state = createBlocks(), before = structuredClone(state);
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => stepBlocks(state, dt, [5]), RangeError);
  assert.deepEqual(state, before);
});

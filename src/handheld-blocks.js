// Seven rotation-mask tables adapted from Jake Gordon's Javascript Tetris,
// https://github.com/jakesgordon/javascript-tetris/blob/master/index.html
// Copyright (c) 2011–2016 Jake Gordon and contributors, MIT.
// Full third-party license: public/licenses/javascript-tetris.txt.
// Only the shape masks are reused; simulation, seven-bag RNG, kicks, scoring,
// placement advice and pixel rendering below are original to Loopuff.
const SHAPES = [
  null,
  [0x0f00, 0x2222, 0x00f0, 0x4444], // I
  [0x44c0, 0x8e00, 0x6440, 0x0e20], // J
  [0x4460, 0x0e80, 0xc440, 0x2e00], // L
  [0xcc00, 0xcc00, 0xcc00, 0xcc00], // O
  [0x06c0, 0x8c40, 0x6c00, 0x4620], // S
  [0x0e40, 0x4c40, 0x4e00, 0x4640], // T
  [0x0c60, 0x4c80, 0xc600, 0x2640]  // Z
];
const WIDTH = 10, HEIGHT = 20, HZ = 120, LOCK_TICKS = 54;
const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]];
const COLORS = ['#142f37', '#6ad8d2', '#729ddb', '#ecab67', '#ead475', '#88c997', '#b19bd8', '#de9bba'];

function cells(piece) {
  const mask = SHAPES[piece.type][piece.rotation];
  const result = [];
  for (let i = 0; i < 16; i++) {
    if (mask & (0x8000 >> i)) result.push([piece.x + i % 4, piece.y + Math.floor(i / 4)]);
  }
  return result;
}

function fits(state, piece) {
  return cells(piece).every(([x, y]) =>
    x >= 0 && x < WIDTH && y < HEIGHT && (y < 0 || !state.board[y][x]));
}

function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 0x100000000;
}

function takePiece(state) {
  if (!state.bag.length) {
    state.bag = [1, 2, 3, 4, 5, 6, 7];
    for (let i = 6; i > 0; i--) {
      const j = Math.floor(random(state) * (i + 1));
      [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
    }
  }
  return state.bag.pop();
}

function spawn(state) {
  state.piece = {type: state.next, rotation: 0, x: 3, y: -1};
  state.next = takePiece(state);
  state.gravityTicks = 0;
  state.lockTicks = 0;
  state.lockResets = 0;
  if (!fits(state, state.piece)) state.over = true;
}

/** Plain JSON state; equal seeds and equal timed inputs replay identically. */
export function createBlocks(seed = 1) {
  const state = {
    board: Array.from({length: HEIGHT}, () => Array(WIDTH).fill(0)),
    piece: null, next: 0, bag: [], rng: Number(seed) >>> 0,
    score: 0, lines: 0, level: 1, over: false, won: false,
    ticks: 0, remainder: 0, gravityTicks: 0, lockTicks: 0,
    lockResets: 0, pieces: 0, combo: -1, lastClear: 0
  };
  state.next = takePiece(state);
  spawn(state);
  return state;
}

function grounded(state) {
  return !fits(state, {...state.piece, y: state.piece.y + 1});
}

function move(state, dx, dy, rotation = state.piece.rotation) {
  const candidate = {...state.piece, x: state.piece.x + dx, y: state.piece.y + dy, rotation};
  if (!fits(state, candidate)) return false;
  const wasGrounded = grounded(state);
  state.piece = candidate;
  if (wasGrounded && state.lockResets < 15) {
    state.lockTicks = 0;
    state.lockResets++;
  }
  return true;
}

function rotate(state) {
  if (state.piece.type === 4) return;
  const rotation = (state.piece.rotation + 1) % 4;
  for (const [dx, dy] of KICKS) {
    if (move(state, dx, dy, rotation)) return;
  }
}

function landing(state, piece = state.piece) {
  let y = piece.y;
  while (fits(state, {...piece, y: y + 1})) y++;
  return y;
}

function lock(state) {
  const occupied = cells(state.piece);
  // Never partly write a piece above the top and silently discard its cells.
  if (occupied.some(([, y]) => y < 0)) {
    state.over = true;
    return;
  }
  for (const [x, y] of occupied) state.board[y][x] = state.piece.type;
  const remaining = state.board.filter(row => row.some(value => value === 0));
  const count = HEIGHT - remaining.length;
  state.lastClear = count;
  state.combo = count ? state.combo + 1 : -1;
  if (count) {
    state.score += [0, 100, 300, 500, 800][count] * state.level + state.combo * 50 * state.level;
    state.lines += count;
    state.level = 1 + Math.floor(state.lines / 10);
    state.board = [...Array.from({length: count}, () => Array(WIDTH).fill(0)), ...remaining];
  }
  state.pieces++;
  spawn(state);
}

function tick(state) {
  state.ticks++;
  state.gravityTicks++;
  const interval = Math.max(6, Math.round(90 * Math.pow(0.82, state.level - 1)));
  if (state.gravityTicks >= interval) {
    state.gravityTicks -= interval;
    move(state, 0, 1);
  }
  if (grounded(state)) {
    state.lockTicks++;
    if (state.lockTicks >= LOCK_TICKS) lock(state);
  } else {
    state.lockTicks = 0;
  }
}

/**
 * Mutates and returns state. Actions happen once, in order, before dt elapses:
 * 0 wait, 1 left, 2 right, 3 clockwise, 4 soft drop, 5 hard drop, 6 unused.
 * A hard drop ends this action batch so remaining input cannot affect a new
 * piece. Time advances in 1/120-second ticks with unspent time retained.
 */
export function stepBlocks(state, dtSeconds, actions = []) {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError('dtSeconds must be finite and nonnegative');
  if (state.over) return state;
  for (const action of actions) {
    if (action === 1) move(state, -1, 0);
    else if (action === 2) move(state, 1, 0);
    else if (action === 3) rotate(state);
    else if (action === 4) {
      if (move(state, 0, 1)) state.score++;
      state.gravityTicks = 0;
    } else if (action === 5) {
      const y = landing(state);
      state.score += 2 * (y - state.piece.y);
      state.piece.y = y;
      lock(state);
      break;
    }
  }
  if (state.over) return state;
  const elapsed = Math.round((state.remainder + dtSeconds * HZ) * 1e9) / 1e9;
  const ticks = Math.floor(elapsed + 1e-9);
  state.remainder = Math.round((elapsed - ticks) * 1e9) / 1e9;
  for (let i = 0; i < ticks && !state.over; i++) tick(state);
  return state;
}

function surface(board) {
  let holes = 0, height = 0, sum = 0, roughness = 0, previous = 0;
  for (let x = 0; x < WIDTH; x++) {
    let top = HEIGHT;
    for (let y = 0; y < HEIGHT; y++) {
      if (board[y][x] && top === HEIGHT) top = y;
      if (!board[y][x] && top < HEIGHT) holes++;
    }
    const h = HEIGHT - top;
    height = Math.max(height, h);
    sum += h;
    if (x) roughness += Math.abs(h - previous);
    previous = h;
  }
  return {holes, height, sum, roughness};
}

function suggestedX(state) {
  let best = state.piece.x, bestCost = Infinity;
  // Advice keeps the current rotation; all positions must be reachable by
  // horizontal motion at the current height, rather than teleporting through a stack.
  for (let direction = -1; direction <= 1; direction += 2) {
    for (let x = state.piece.x; x >= -3 && x < WIDTH; x += direction) {
      const piece = {...state.piece, x};
      if (!fits(state, piece)) break;
      piece.y = landing(state, piece);
      if (cells(piece).some(([, y]) => y < 0)) continue;
      const board = state.board.map(row => row.slice());
      for (const [cx, cy] of cells(piece)) board[cy][cx] = piece.type;
      const rows = board.filter(row => row.some(value => value === 0));
      const cleared = HEIGHT - rows.length;
      const after = [...Array.from({length: cleared}, () => Array(WIDTH).fill(0)), ...rows];
      const s = surface(after);
      const cost = s.holes * 80 + s.sum * 3 + s.roughness * 2 + s.height * 2 - cleared * 120;
      if (cost < bestCost || (cost === bestCost && Math.abs(x - state.piece.x) < Math.abs(best - state.piece.x))) {
        best = x;
        bestCost = cost;
      }
    }
  }
  return best;
}

/** Coordinates are the 4×4 piece frame's origin; danger is stack height 0–20. */
export function observeBlocks(state) {
  return {
    x: state.piece.x, y: state.piece.y,
    targetX: state.over ? state.piece.x : suggestedX(state),
    score: state.score, lines: state.lines, danger: surface(state.board).height
  };
}

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function number(ctx, value, x, y, size = 2) {
  for (const ch of String(value)) {
    const mask = DIGITS[Number(ch)];
    if (mask) for (let i = 0; i < 15; i++) {
      if (mask[i] === '1') ctx.fillRect(x + i % 3 * size, y + Math.floor(i / 3) * size, size, size);
    }
    x += 4 * size;
  }
}

function tile(ctx, x, y, size, type, ghost = false) {
  if (ghost) {
    ctx.fillStyle = '#506c70';
    ctx.fillRect(x + 1, y + 1, size - 2, 1);
    ctx.fillRect(x + 1, y + size - 2, size - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, size - 2);
    ctx.fillRect(x + size - 2, y + 1, 1, size - 2);
    return;
  }
  ctx.fillStyle = COLORS[type];
  ctx.fillRect(x + 1, y + 1, size - 1, size - 1);
  ctx.fillStyle = '#e3f0c4';
  ctx.fillRect(x + 2, y + 2, size - 4, 1);
  ctx.fillStyle = '#203f48';
  ctx.fillRect(x + 2, y + size - 2, size - 3, 1);
}

/** Draws only game pixels and numeric meters; surrounding localized UI is external. */
export function drawBlocks(ctx, state, w, h) {
  if (!(w > 0 && h > 0)) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b202a';
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / 320, h / 240);
  ctx.translate(Math.floor((w - 320 * scale) / 2), Math.floor((h - 240 * scale) / 2));
  ctx.scale(scale, scale);
  ctx.fillStyle = '#1e4149';
  ctx.fillRect(100, 16, 108, 208);
  ctx.fillStyle = '#102c35';
  ctx.fillRect(104, 20, 100, 200);
  ctx.fillStyle = '#18363e';
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) ctx.fillRect(108 + x * 10, 24 + y * 10, 1, 1);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (state.board[y][x]) tile(ctx, 104 + x * 10, 20 + y * 10, 10, state.board[y][x]);
  }
  if (!state.over) {
    const ghost = {...state.piece, y: landing(state)};
    for (const [x, y] of cells(ghost)) if (y >= 0) tile(ctx, 104 + x * 10, 20 + y * 10, 10, ghost.type, true);
    for (const [x, y] of cells(state.piece)) if (y >= 0) tile(ctx, 104 + x * 10, 20 + y * 10, 10, state.piece.type);
  }
  // Next-piece window, numeric score, cleared-row meter and speed level.
  ctx.fillStyle = '#1e4149';
  ctx.fillRect(224, 24, 64, 60);
  for (const [x, y] of cells({type: state.next, rotation: 0, x: 0, y: 0})) tile(ctx, 234 + x * 10, 34 + y * 10, 10, state.next);
  ctx.fillStyle = '#bad5b1';
  number(ctx, state.score, 20, 49, String(state.score).length > 8 ? 1 : 2);
  ctx.fillRect(20, 31, 8, 8);
  ctx.fillStyle = '#6ad8d2';
  for (let row = 0; row < 3; row++) ctx.fillRect(20, 99 + row * 4, 18, 2);
  number(ctx, state.lines, 20, 119);
  ctx.fillStyle = '#ead475';
  for (let bar = 0; bar < Math.min(10, state.level); bar++) ctx.fillRect(224 + bar * 5, 130 - bar * 2, 3, 8 + bar * 2);
  number(ctx, state.level, 224, 145);
  if (state.over) {
    ctx.fillStyle = '#0b202a';
    ctx.fillRect(119, 99, 70, 30);
    ctx.fillStyle = '#ead475';
    // Pixel cross communicates stopped play without embedding a language.
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(144 + i * 3, 104 + i * 3, 3, 3);
      ctx.fillRect(162 - i * 3, 104 + i * 3, 3, 3);
    }
  }
  ctx.restore();
}

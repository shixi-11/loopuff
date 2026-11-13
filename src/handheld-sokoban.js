// Original miniature warehouse puzzles and pixel artwork; no external assets.
// Authored in increasing order: direct push, approach, two-box assignment,
// routing around a pillar, then three boxes sharing narrow upper passages.
const LEVELS = [
  ['#######', '#     #', '# @$. #', '#     #', '#######'],
  ['########', '# .    #', '# $ #  #', '#   @  #', '#      #', '########'],
  ['########', '#  . . #', '#  $ $ #', '#  @   #', '#      #', '########'],
  ['#########', '#  . .  #', '#  #    #', '# $$    #', '#   @   #', '#########'],
  ['##########', '#   . .  #', '#  # #  .#', '#  $ $$  #', '#        #', '#   @    #', '##########']
];
const DIRECTIONS = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]];

function loadLevel(state) {
  const rows = LEVELS[state.level - 1];
  state.boxes = [];
  state.board = rows.map((row, y) => [...row].map((cell, x) => {
    if (cell === '@') state.player = {x, y};
    if (cell === '$') state.boxes.push({x, y});
    return cell === '@' || cell === '$' ? ' ' : cell;
  }).join(''));
  state.width = rows[0].length;
  state.height = rows.length;
  state.moves = 0;
  state.pushes = 0;
  state.facing = 3;
  state.history = [];
}

/** Plain JSON state. Seed is retained for replay identity; puzzle order is fixed. */
export function createSokoban(seed = 1) {
  const state = {
    seed: Number(seed) >>> 0, level: 1, levelCount: LEVELS.length,
    score: 0, over: false, won: false, completed: [],
    board: [], boxes: [], player: {x: 0, y: 0}, history: []
  };
  loadLevel(state);
  return state;
}

function boxAt(state, x, y) {
  return state.boxes.findIndex(box => box.x === x && box.y === y);
}

function wallAt(state, x, y) {
  return y < 0 || y >= state.height || x < 0 || x >= state.width || state.board[y][x] === '#';
}

function snapshot(state) {
  return {
    player: {...state.player}, boxes: state.boxes.map(box => ({...box})),
    moves: state.moves, pushes: state.pushes, facing: state.facing
  };
}

function move(state, action) {
  const [dx, dy] = DIRECTIONS[action];
  const x = state.player.x + dx, y = state.player.y + dy;
  if (wallAt(state, x, y)) return;
  const index = boxAt(state, x, y);
  if (index !== -1 && (wallAt(state, x + dx, y + dy) || boxAt(state, x + dx, y + dy) !== -1)) return;
  state.history.push(snapshot(state));
  state.player = {x, y};
  state.facing = action;
  state.moves++;
  if (index !== -1) {
    state.boxes[index] = {x: x + dx, y: y + dy};
    state.pushes++;
  }
  if (state.boxes.every(box => state.board[box.y][box.x] === '.')) {
    // Completion rewards live outside undo snapshots and never depend on moves.
    if (!state.completed.includes(state.level)) {
      state.completed.push(state.level);
      state.score += state.level * 100;
    }
    if (state.level === LEVELS.length) {
      state.won = true;
      state.over = true;
      state.history = [];
    } else {
      state.level++;
      loadLevel(state);
    }
  }
}

/**
 * Returns an independent state without mutating the input, including its history.
 * Actions run once each in order: 0 wait, 1 up, 2 right, 3 down, 4 left,
 * 5 undo the last successful move on this level, 6 restart this level.
 * dt is validated but never moves the player. Deadlocks remain undoable;
 * only completing the last puzzle sets over/won. Level transitions clear undo.
 */
export function stepSokoban(state, dt, actions = []) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
  if (!Array.isArray(actions)) throw new TypeError('actions must be an array');
  const next = JSON.parse(JSON.stringify(state));
  if (next.over) return next;
  for (const action of actions) {
    if (action >= 1 && action <= 4 && Number.isInteger(action)) move(next, action);
    else if (action === 5 && next.history.length) Object.assign(next, next.history.pop());
    else if (action === 6) loadLevel(next);
    if (next.over) break;
  }
  return next;
}

/** Neighbor codes: 0 floor, 1 wall/outside, 2 goal, 3 box, 4 box on goal. */
function neighbor(state, x, y) {
  if (wallAt(state, x, y)) return 1;
  const goal = state.board[y][x] === '.';
  return boxAt(state, x, y) !== -1 ? (goal ? 4 : 3) : (goal ? 2 : 0);
}

/** Local observations support conditions; they do not promise an automatic solver. */
export function observeSokoban(state) {
  const {x, y} = state.player;
  return {
    playerX: x, playerY: y, level: state.level, moves: state.moves,
    pushes: state.pushes, boxesOnGoals: state.boxes.filter(box => state.board[box.y][box.x] === '.').length,
    up: neighbor(state, x, y - 1), right: neighbor(state, x + 1, y),
    down: neighbor(state, x, y + 1), left: neighbor(state, x - 1, y),
    score: state.score, over: Number(state.over), won: Number(state.won)
  };
}

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function number(ctx, value, x, y) {
  for (const digit of String(value)) {
    const mask = DIGITS[Number(digit)];
    if (mask) for (let i = 0; i < 15; i++) if (mask[i] === '1') ctx.fillRect(x + i % 3 * 2, y + Math.floor(i / 3) * 2, 2, 2);
    x += 8;
  }
}

/** Only game pixels, symbols and numbers; localized labels belong to the host. */
export function drawSokoban(ctx, state, width = 320, height = 240) {
  if (!(width > 0 && height > 0)) return;
  ctx.save();
  ctx.fillStyle = '#0b202a';
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / 320, height / 240);
  ctx.translate(Math.floor((width - 320 * scale) / 2), Math.floor((height - 240 * scale) / 2));
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  const size = Math.floor(Math.min(280 / state.width, 184 / state.height));
  const ox = Math.floor((320 - size * state.width) / 2);
  const oy = 40 + Math.floor((184 - size * state.height) / 2);
  for (let y = 0; y < state.height; y++) for (let x = 0; x < state.width; x++) {
    const px = ox + x * size, py = oy + y * size;
    const wall = state.board[y][x] === '#';
    ctx.fillStyle = wall ? '#35545b' : '#15313a';
    ctx.fillRect(px, py, size - 1, size - 1);
    if (wall) {
      ctx.fillStyle = '#65817f';
      ctx.fillRect(px + 2, py + 2, size - 5, 2);
      ctx.fillStyle = '#203e48';
      ctx.fillRect(px + 2, py + size - 5, size - 4, 3);
      ctx.fillRect(px + Math.floor(size / 2), py + 5, 1, size - 10);
    } else if (state.board[y][x] === '.') {
      ctx.fillStyle = '#c9af75';
      const c = Math.floor(size / 2);
      ctx.fillRect(px + c - 4, py + c - 2, 8, 4);
      ctx.fillRect(px + c - 2, py + c - 4, 4, 8);
    } else {
      ctx.fillStyle = '#23414a';
      ctx.fillRect(px + 3, py + size - 4, 2, 1);
    }
  }
  for (const box of state.boxes) {
    const x = ox + box.x * size + 3, y = oy + box.y * size + 3, side = size - 7;
    const onGoal = state.board[box.y][box.x] === '.';
    ctx.fillStyle = '#071c26';
    ctx.fillRect(x + 1, y + 2, side, side);
    ctx.fillStyle = onGoal ? '#c9af75' : '#779b9b';
    ctx.fillRect(x, y, side, side);
    ctx.fillStyle = onGoal ? '#ecdcb4' : '#c4d5cc';
    ctx.fillRect(x + 2, y + 2, side - 4, 2);
    ctx.fillRect(x + 2, y + 3, 2, side - 5);
    ctx.fillStyle = onGoal ? '#7b6946' : '#37565c';
    ctx.fillRect(x + side - 4, y + 3, 2, side - 5);
    for (let i = 4; i < side - 4; i += 2) ctx.fillRect(x + i, y + i, 2, 2);
  }
  const px = ox + state.player.x * size + Math.floor(size / 2);
  const py = oy + state.player.y * size + Math.floor(size / 2);
  ctx.fillStyle = '#081d28';
  ctx.fillRect(px - 6, py + 7, 13, 3);
  ctx.fillStyle = '#e9e6d7';
  ctx.fillRect(px - 5, py - 8, 10, 8);
  ctx.fillRect(px - 6, py, 12, 7);
  ctx.fillRect(px - 5, py + 7, 4, 2);
  ctx.fillRect(px + 2, py + 7, 4, 2);
  ctx.fillStyle = '#6e999b';
  ctx.fillRect(px - 4, py - 5, 8, 3);
  const [dx, dy] = DIRECTIONS[state.facing];
  ctx.fillStyle = '#143640';
  ctx.fillRect(px + dx * 3 - 1, py - 4 + dy, 2, 2);
  ctx.fillStyle = '#c9af75';
  for (let i = 0; i < state.levelCount; i++) {
    ctx.fillStyle = state.completed.includes(i + 1) ? '#c9af75' : i + 1 === state.level ? '#e9e6d7' : '#35545b';
    ctx.fillRect(20 + i * 10, 15, 6, 6);
  }
  ctx.fillStyle = '#9ab9b5';
  ctx.fillRect(92, 13, 3, 5);
  ctx.fillRect(97, 18, 3, 5);
  number(ctx, state.moves, 106, 14);
  ctx.fillRect(158, 14, 8, 8);
  number(ctx, state.pushes, 173, 14);
  ctx.fillStyle = '#e9e6d7';
  number(ctx, state.score, 244, 14);
  if (state.won) {
    ctx.fillStyle = '#0b202a';
    ctx.fillRect(132, 100, 56, 40);
    ctx.fillStyle = '#c9af75';
    for (let i = 0; i < 4; i++) ctx.fillRect(141 + i * 3, 115 + i * 3, 4, 4);
    for (let i = 0; i < 7; i++) ctx.fillRect(150 + i * 3, 124 - i * 3, 4, 4);
  }
  ctx.restore();
}

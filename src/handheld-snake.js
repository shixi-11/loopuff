// Original pixel art and deterministic grid simulation; no external assets.
const COLUMNS = 20, ROWS = 14, HZ = 120;
const VECTORS = [null, [-1, 0], [1, 0], [0, -1], [0, 1]];
const OPPOSITE = [0, 2, 1, 4, 3];

function interval(state) {
  return Math.max(10, 28 - state.eaten);
}

function placeFood(state) {
  const occupied = new Set(state.snake.map(cell => cell.y * COLUMNS + cell.x));
  const free = [];
  for (let i = 0; i < COLUMNS * ROWS; i++) if (!occupied.has(i)) free.push(i);
  if (!free.length) {
    state.food = null;
    state.won = state.over = true;
    return;
  }
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  const index = free[Math.floor(state.rng / 0x100000000 * free.length)];
  state.food = {x: index % COLUMNS, y: Math.floor(index / COLUMNS)};
}

/** Coordinates start at the upper left. Directions/actions: 1 left, 2 right, 3 up, 4 down. */
export function createSnake(seed = 1) {
  const state = {
    rng: Number(seed) >>> 0, columns: COLUMNS, rows: ROWS,
    snake: [{x: 6, y: 7}, {x: 5, y: 7}, {x: 4, y: 7}],
    direction: 2, pendingDirection: 0, food: null,
    score: 0, eaten: 0, over: false, won: false,
    ticks: 0, remainder: 0, moveTicks: 0, readyTicks: 90
  };
  placeFood(state);
  return state;
}

function destination(state, direction) {
  const [dx, dy] = VECTORS[direction];
  return {x: state.snake[0].x + dx, y: state.snake[0].y + dy};
}

function eating(state, cell) {
  return state.food !== null && cell.x === state.food.x && cell.y === state.food.y;
}

function blocked(state, direction) {
  const cell = destination(state, direction);
  if (cell.x < 0 || cell.x >= COLUMNS || cell.y < 0 || cell.y >= ROWS) return true;
  // A non-growing move may enter the tail cell because it vacates simultaneously.
  const occupiedLength = state.snake.length - Number(!eating(state, cell));
  return state.snake.slice(0, occupiedLength).some(part => part.x === cell.x && part.y === cell.y);
}

function advance(state) {
  state.direction = state.pendingDirection || state.direction;
  state.pendingDirection = 0;
  if (blocked(state, state.direction)) {
    state.over = true;
    return;
  }
  const head = destination(state, state.direction);
  const grows = eating(state, head);
  state.snake.unshift(head);
  if (grows) {
    state.eaten++;
    state.score += 10;
    placeFood(state);
  } else state.snake.pop();
}

/**
 * Returns a new JSON-serializable state, leaving all input state untouched.
 * 0 waits. The first legal turn is buffered until the next cell movement;
 * further turns wait for a later call after that movement. Direct reversal is
 * ignored. Holding a direction therefore works without key-repeat machinery.
 * Time uses retained 1/120-second ticks, including a 0.75-second initial pause.
 */
export function stepSnake(state, dtSeconds, actions = []) {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError('dtSeconds must be finite and nonnegative');
  const elapsed = Math.round((state.remainder + dtSeconds * HZ) * 1e9) / 1e9;
  if (!Number.isSafeInteger(Math.floor(elapsed))) throw new RangeError('dtSeconds exceeds the simulation clock range');
  const next = {...state, snake: state.snake.map(cell => ({...cell})), food: state.food && {...state.food}};
  if (next.over) return next;
  for (const action of Array.isArray(actions) ? actions : []) {
    if (Number.isInteger(action) && action >= 1 && action <= 4 &&
        !next.pendingDirection && action !== next.direction && action !== OPPOSITE[next.direction]) {
      next.pendingDirection = action;
    }
  }
  const ticks = Math.floor(elapsed + 1e-9);
  next.remainder = Math.round((elapsed - ticks) * 1e9) / 1e9;
  for (let i = 0; i < ticks && !next.over; i++) {
    next.ticks++;
    if (next.readyTicks > 0) next.readyTicks--;
    else if (++next.moveTicks >= interval(next)) {
      next.moveTicks = 0;
      advance(next);
    }
  }
  return next;
}

/** Integer observations; danger includes forbidden reversal as well as collision. */
export function observeSnake(state) {
  const danger = direction => Number(state.over || direction === OPPOSITE[state.direction] || blocked(state, direction));
  return {
    headX: state.snake[0].x, headY: state.snake[0].y,
    foodX: state.food ? state.food.x : -1, foodY: state.food ? state.food.y : -1,
    direction: state.direction, nextDirection: state.pendingDirection || state.direction,
    dangerLeft: danger(1), dangerRight: danger(2), dangerUp: danger(3), dangerDown: danger(4),
    score: state.score, length: state.snake.length, eaten: state.eaten,
    columns: COLUMNS, rows: ROWS, ready: Number(state.readyTicks === 0),
    over: Number(state.over), won: Number(state.won)
  };
}

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function number(ctx, value, x, y) {
  for (const char of String(value)) {
    const mask = DIGITS[Number(char)];
    if (mask) for (let i = 0; i < 15; i++) if (mask[i] === '1') ctx.fillRect(x + i % 3 * 2, y + Math.floor(i / 3) * 2, 2, 2);
    x += 8;
  }
}

/** Pixel-only HUD and art; localized menus and captions belong to the surrounding UI. */
export function drawSnake(ctx, state, width = 320, height = 240) {
  if (!(width > 0 && height > 0)) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#090f29';
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / 320, height / 240);
  ctx.translate(Math.floor((width - 320 * scale) / 2), Math.floor((height - 240 * scale) / 2));
  ctx.scale(scale, scale);
  for (let i = 0; i < 38; i++) {
    ctx.fillStyle = i % 3 ? '#334464' : '#72829e';
    ctx.fillRect((i * 71 + 13) % 320, (i * 43 + 17) % 240, 1, 1);
  }
  ctx.fillStyle = '#435375';
  ctx.fillRect(18, 34, 284, 200);
  ctx.fillStyle = '#101c33';
  ctx.fillRect(20, 36, 280, 196);
  ctx.fillStyle = '#1b2d46';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLUMNS; x++) ctx.fillRect(26 + x * 14, 42 + y * 14, 1, 1);
  if (state.food) {
    const x = 20 + state.food.x * 14, y = 36 + state.food.y * 14;
    ctx.fillStyle = '#ead475';
    ctx.fillRect(x + 4, y + 3, 6, 8);
    ctx.fillRect(x + 3, y + 5, 8, 4);
    ctx.fillStyle = '#f7ecc1';
    ctx.fillRect(x + 5, y + 4, 2, 2);
    ctx.fillStyle = '#88c997';
    ctx.fillRect(x + 7, y + 1, 3, 2);
  }
  for (let i = state.snake.length - 1; i >= 0; i--) {
    const cell = state.snake[i], x = 20 + cell.x * 14, y = 36 + cell.y * 14;
    ctx.fillStyle = i === 0 ? '#b3fff4' : i % 2 ? '#6ad8d2' : '#63bcbf';
    if (i === state.snake.length - 1) ctx.fillRect(x + 4, y + 4, 6, 6);
    else ctx.fillRect(x + 2, y + 2, 10, 10);
    if (i > 0) {
      const toward = state.snake[i - 1];
      ctx.fillRect(Math.min(x + 5, 25 + toward.x * 14), Math.min(y + 5, 41 + toward.y * 14),
        Math.abs(toward.x - cell.x) * 14 + 4, Math.abs(toward.y - cell.y) * 14 + 4);
    }
  }
  const head = state.snake[0], hx = 20 + head.x * 14, hy = 36 + head.y * 14;
  ctx.fillStyle = '#102c35';
  const [dx, dy] = VECTORS[state.direction];
  if (dx) {
    ctx.fillRect(hx + (dx > 0 ? 9 : 3), hy + 3, 2, 2);
    ctx.fillRect(hx + (dx > 0 ? 9 : 3), hy + 9, 2, 2);
  } else {
    ctx.fillRect(hx + 3, hy + (dy > 0 ? 9 : 3), 2, 2);
    ctx.fillRect(hx + 9, hy + (dy > 0 ? 9 : 3), 2, 2);
  }
  ctx.fillStyle = '#ead475';
  ctx.fillRect(20, 15, 8, 8);
  number(ctx, state.score, 36, 14);
  ctx.fillStyle = '#6ad8d2';
  ctx.fillRect(144, 17, 17, 4);
  number(ctx, state.snake.length, 170, 14);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i <= Math.floor((28 - interval(state)) / 3) ? '#ead475' : '#334464';
    ctx.fillRect(266 + i * 5, 24 - i * 2, 3, 3 + i * 2);
  }
  if (state.over) {
    ctx.fillStyle = '#090f29dd';
    ctx.fillRect(122, 104, 76, 40);
    ctx.fillStyle = state.won ? '#ead475' : '#de9bba';
    if (state.won) {
      ctx.fillRect(146, 114, 28, 5);
      ctx.fillRect(151, 119, 18, 9);
      ctx.fillRect(158, 128, 4, 6);
      ctx.fillRect(151, 134, 18, 3);
    } else for (let i = 0; i < 7; i++) {
      ctx.fillRect(149 + i * 3, 113 + i * 3, 3, 3);
      ctx.fillRect(167 - i * 3, 113 + i * 3, 3, 3);
    }
  }
  ctx.restore();
}

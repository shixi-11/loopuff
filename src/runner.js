// An original teaching interpreter for a small, explicit introductory subset.
// This is not the Tolang compiler or TVM. It has no network, filesystem or eval.
export class LessonError extends Error {
  constructor(code, position = 0) { super(code); this.code = code; this.position = position; }
}
export function compile(source) {
  if (typeof source !== 'string' || source.length > 4096) throw new LessonError('limit');
  const tokens = []; let offset = 0;
  while (offset < source.length) {
    if (/\s/.test(source[offset])) { offset++; continue; }
    const m = /^(\d+|[A-Za-z_][A-Za-z_0-9]*|[+().=;])/.exec(source.slice(offset));
    if (!m) throw new LessonError('syntax', offset);
    tokens.push({ value: m[0], position: offset }); offset += m[0].length;
    if (tokens.length > 1024) throw new LessonError('limit', offset);
  }
  let cursor = 0, depth = 0;
  const names = new Set();
  const peek = () => tokens[cursor]?.value;
  const fail = code => { throw new LessonError(code, tokens[cursor]?.position ?? source.length); };
  const take = expected => { if (peek() !== expected) fail('syntax'); return tokens[cursor++]; };
  function value() {
    if (++depth > 64) fail('limit');
    let node;
    if (peek() === '(') { take('('); node = expression(); take(')'); }
    else if (/^\d+$/.test(peek() || '')) {
      const number = Number(tokens[cursor++].value);
      if (!Number.isSafeInteger(number) || number > 1000000) fail('limit');
      node = { type: 'number', value: number };
    } else if (/^[A-Za-z_]\w*$/.test(peek() || '') && !['let','log'].includes(peek())) {
      const name = tokens[cursor++].value;
      if (!names.has(name)) fail('name');
      node = { type: 'name', name };
    } else fail('syntax');
    depth--; return node;
  }
  function expression() {
    let left = value();
    while (peek() === '+') { take('+'); left = { type: 'add', left, right: value() }; }
    return left;
  }
  const statements = [];
  while (cursor < tokens.length) {
    if (peek() === 'let') {
      take('let'); const name = peek();
      if (!/^[A-Za-z_]\w*$/.test(name || '') || ['let','log'].includes(name) || names.has(name)) fail('syntax');
      cursor++; take('='); const expr = expression(); take(';'); names.add(name);
      statements.push({ type: 'bind', name, expr });
    } else {
      const expr = expression(); take('.'); take('log'); take('('); take(')');
      statements.push({ type: 'log', expr });
      if (peek() === ';') take(';');
    }
    if (statements.length > 64) fail('limit');
  }
  if (!statements.length) fail('syntax');
  return statements;
}
export function run(source) {
  const program = compile(source), env = new Map(), logs = []; let steps = 0;
  function evaluate(node) {
    if (++steps > 2048) throw new LessonError('limit');
    if (node.type === 'number') return node.value;
    if (node.type === 'name') return env.get(node.name);
    const result = evaluate(node.left) + evaluate(node.right);
    if (!Number.isSafeInteger(result) || result > 1000000) throw new LessonError('limit');
    return result;
  }
  for (const statement of program) {
    steps++;
    const result = evaluate(statement.expr);
    if (statement.type === 'bind') env.set(statement.name, result);
    else logs.push(String(result));
  }
  return { logs, steps, statementCount: program.length };
}

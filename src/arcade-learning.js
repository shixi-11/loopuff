import {inspectStartStep, startSteps} from './learning-paths.js';
import {gradeTask} from './assessment.js';
import {cartridges, newHandheld, compileHandheld, applyHandheld, handheldInput} from './handheld.js';
import {arcadeTickUs, arcadeActionCooldown} from './arcade-protocol.js';

const legacyIds = ['run', 'change', 'repair', 'calculate', 'name'];
export const arcadeLearningSteps = [
  ...legacyIds.map(id => ({...JSON.parse(JSON.stringify(startSteps.find(item => item.id === id))), kind: 'output', game: 'blocks', legacy: true})),
  {id: 'score', kind: 'output', game: 'blocks', starter: 'if score > 9 then { 0.log() } else { 0.log() }', example: 'if score > 9 then { 1.log() } else { 0.log() }'},
  {id: 'select', kind: 'game', game: 'blocks', starter: 'choose(1)', example: 'choose(3)'},
  {id: 'control', kind: 'game', game: 'tanks', starter: 'start()', example: 'start();\nright();\nfire()'},
  {id: 'repeat', kind: 'game', game: 'blocks', starter: 'start();\nright()', example: 'start();\nfor n in [1, 2, 3] { right() }'},
  {id: 'finish', kind: 'game', game: 'flight', starter: 'pause()', example: 'finish()'},
  {id: 'strategy', kind: 'strategy', game: 'blocks', starter: 'if x < targetX then { left() } else {\n  if x > targetX then { right() } else { drop() }\n}', example: cartridges[0].strategy}
];
export const arcadeLearningIds = arcadeLearningSteps.map(step => step.id);
export const arcadeScoreInputs = Object.freeze([0, 9, 10, 12, 20]);
export const arcadeStrategySeeds = Object.freeze([1, 147, 2026]);
const copy = value => JSON.parse(JSON.stringify(value));
const dt = arcadeTickUs / 1000000;
const controlConcepts = ['if', 'compare', 'name'];
const loopConcepts = ['for', 'while', 'loop'];
const check = (id, passed, actual, expected) => ({id, passed, actual, expected});

/** Fresh, independent JSON world for a learning preview; no existing work is edited. */
export function createArcadeLearningSession(game = 'blocks', seed = 2741, status = 'ready') {
  const index = cartridges.findIndex(cart => cart.id === game);
  if (index < 0 || !['ready', 'running'].includes(status)) throw new RangeError('Invalid learning session');
  const session = newHandheld(seed);
  session.selected = index; session.world = cartridges[index].create(session.seed); session.status = status;
  return session;
}

export function createArcadeLearningPreview(id){
  const task=arcadeLearningSteps.find(step=>step.id===id);if(!task)throw new RangeError('Unknown arcade learning step');
  const session=createArcadeLearningSession(task.game,id==='strategy'?arcadeStrategySeeds[0]:2741,['finish','strategy'].includes(id)?'running':'ready');
  // Independent lesson preview: use a clear corridor without changing the cartridge arena.
  if(id==='control'){session.world.player.x=72;session.world.player.y=184;}
  return session;
}

function scene(session) {
  return {session, world: session.world, observe: handheldInput(session), game: cartridges[session.selected].id};
}
function advance(session, actions) {
  if (session.status !== 'running') return {fired: false};
  const cart = cartridges[session.selected], before = session.world.player?.cooldown || 0;
  session.world = cart.step(session.world, dt, actions) ?? session.world;
  session.activeMs += arcadeTickUs / 1000;
  if (session.world.over) session.status = 'ended';
  return {fired: cart.id === 'tanks' && actions.includes(5) && session.world.player.cooldown > before};
}

// The console emits one command per six fixed ticks. Continuous controls last
// for that pulse; discrete controls happen once, in their original order.
function executeCommands(session, source, ticks = 120, finishAllCommands = true) {
  const compiled = compileHandheld(source, session), events = [], effectEvents = [];
  if (finishAllCommands) ticks = Math.max(ticks, compiled.commands.length * arcadeActionCooldown);
  const frames = [{tick: 0, session: copy(session)}];
  let cursor = 0, pulse = [], pulseTicks = 0, fired = 0, generation = 0;
  for (let tick = 0; tick < ticks; tick++) {
    let actions = [];
    if (tick % arcadeActionCooldown === 0 && cursor < compiled.commands.length) {
      const command = compiled.commands[cursor], output = compiled.result.outputs[cursor];
      const previousWorld = session.world;
      actions = applyHandheld(session, [command]);
      if (previousWorld !== session.world) { generation++; fired = 0; }
      events.push({tick, command, generation, actions: [...actions], concepts: [...output.concepts]});
      cursor++; pulse = [...actions]; pulseTicks = arcadeActionCooldown;
    }
    if (!cartridges[session.selected].discrete) {
      actions = pulseTicks > 0 ? pulse : []; pulseTicks = Math.max(0, pulseTicks - 1);
    }
    const tankRunning = cartridges[session.selected].id === 'tanks' && session.status === 'running';
    const xBefore = tankRunning ? session.world.player.x : null;
    const effect = advance(session, actions);
    const xAfter = tankRunning ? session.world.player.x : null;
    if (tankRunning && actions.includes(2) && xAfter > xBefore) effectEvents.push({tick, generation, type: 'moveRight', xBefore, xAfter});
    if (effect.fired) { fired++; effectEvents.push({tick, generation, type: 'fired', xBefore, xAfter}); }
    if ((tick + 1) % 6 === 0 || tick + 1 === ticks) frames.push({tick: tick + 1, session: copy(session)});
  }
  return {compiled, events, effectEvents, frames, fired, generation, remaining: compiled.commands.length - cursor};
}

function outputCases(id, source) {
  if (legacyIds.includes(id)) {
    const report = inspectStartStep(id, source);
    return report.cases.map(item => {
      const session = createArcadeLearningSession();
      return {...item, ...scene(session), actualInput: {}, actual: {logs: item.result?.logs || [], expected: item.expected}};
    });
  }
  return arcadeScoreInputs.map(score => {
    const prefix = `let score = ${score};\n`, expected = [score >= 10 ? '1' : '0'];
    const report = gradeTask(prefix + source, {logs: expected, require: controlConcepts});
    const session = createArcadeLearningSession();
    return {...report, ...scene(session), scoreInput: score, actualInput: {score}, expected,
      position: Math.max(0, (report.position || 0) - prefix.length),
      outputs: report.result?.outputs.map(output => ({...output, start: Math.max(0, output.start - prefix.length), end: Math.max(0, output.end - prefix.length)})) || [],
      actual: {score, logs: report.result?.logs || [], expected}};
  });
}

function commandCase(id, source) {
  const task = arcadeLearningSteps.find(item => item.id === id);
  const session = createArcadeLearningPreview(id);
  const before = copy(session), result = executeCommands(session, source, 120, id !== 'control');
  const checks = [check('commandsCompleted', result.remaining === 0, result.remaining, 0)];
  if (id === 'select') {
    checks.push(check('selectedGame', cartridges[session.selected].id === 'flight', cartridges[session.selected].id, 'flight'));
    checks.push(check('ready', session.status === 'ready', session.status, 'ready'));
  } else if (id === 'control') {
    const currentEffects = result.effectEvents.filter(event => event.generation === result.generation);
    const firstShot = currentEffects.find(event => event.type === 'fired');
    const precedingMove = currentEffects.find(event => event.type === 'moveRight' && firstShot && event.tick < firstShot.tick);
    checks.push(check('selectedGame', cartridges[session.selected].id === 'tanks', cartridges[session.selected].id, 'tanks'));
    checks.push(check('movedRight', !!session.world.player && session.world.player.x > before.world.player.x, session.world.player?.x ?? null, {greaterThan: before.world.player.x}));
    checks.push(check('fired', result.fired > 0, result.fired, {atLeast: 1}));
    checks.push(check('movedBeforeFiring', !!precedingMove, precedingMove?.tick ?? null, {before: firstShot?.tick ?? null}));
  } else if (id === 'repeat') {
    const moves = result.events.filter(event => event.command === 2 && event.generation === result.generation && event.actions.includes(2));
    const loopMoves = moves.filter(event => loopConcepts.some(concept => event.concepts.includes(concept)));
    checks.push(check('selectedGame', session.selected === 0, cartridges[session.selected].id, 'blocks'));
    checks.push(check('movedThree', session.world.pieces === 0 && session.world.piece?.x === before.world.piece.x + 3, session.world.piece?.x ?? null, before.world.piece.x + 3));
    checks.push(check('loopContributes', loopMoves.length >= 3, loopMoves.length, {atLeast: 3}));
  } else if (id === 'finish') {
    checks.push(check('selectedGame', cartridges[session.selected].id === 'flight', cartridges[session.selected].id, 'flight'));
    checks.push(check('ended', session.status === 'ended', session.status, 'ended'));
  }
  const ok = checks.every(item => item.passed), conceptFailure = checks.some(item => item.id === 'loopContributes' && !item.passed);
  return {ok, code: ok ? null : conceptFailure ? 'conceptMissing' : 'goalMismatch', checks,
    ...scene(session), initial: before, actualInput: handheldInput(before), frames: result.frames,
    result: result.compiled.result, commands: result.compiled.commands, events: result.events, effectEvents: result.effectEvents,
    actual: {game: cartridges[session.selected].id, status: session.status, score: session.world.score,
      x: session.world.player?.x ?? session.world.piece?.x ?? null, shots: result.fired, pieces: session.world.pieces ?? 0}};
}

function strategyCase(source, seed) {
  const session = createArcadeLearningSession('blocks', seed, 'running'), initial = copy(session), decisions = [];
  const frames = [{tick: 0, session: copy(session)}];
  let cooldown = 0, policy = true, contributes = true;
  let elapsed = 0;
  // Every thirteen ticks matches the bounded strategy polling period; the real
  // six-tick discrete action cooldown is retained between game updates.
  for (let tick = 0; tick < 240 && session.status === 'running'; tick++) {
    let actions = [];
    if (cooldown > 0) cooldown--;
    if (tick % 13 === 0) {
      const input = handheldInput(session), compiled = compileHandheld(source, session, {strategy: true});
      const command = compiled.commands[0], expected = input.x < input.targetX ? 2 : input.x > input.targetX ? 1 : 7;
      if (command !== undefined && command !== 0) {
        const output = compiled.result.outputs[0];
        policy &&= command === expected;
        contributes &&= controlConcepts.every(concept => output.concepts.includes(concept));
        if (cooldown === 0) { actions = applyHandheld(session, compiled.commands); cooldown = arcadeActionCooldown; }
        decisions.push({tick, command, expected, input, concepts: [...output.concepts]});
      }
    }
    advance(session, actions);
    elapsed = tick + 1;
    if (elapsed % 6 === 0) frames.push({tick: elapsed, session: copy(session)});
  }
  if (frames.at(-1).tick !== elapsed) frames.push({tick: elapsed, session: copy(session)});
  const checks = [check('targetPolicy', policy, decisions.map(item => item.command), decisions.map(item => item.expected)),
    check('conditionContributes', contributes && decisions.length > 0, contributes && decisions.length > 0, true),
    check('placed', session.world.pieces > 0, session.world.pieces, {atLeast: 1}),
    check('scored', session.world.score > 0, session.world.score, {greaterThan: 0})];
  const ok = checks.every(item => item.passed);
  return {ok, code: ok ? null : !contributes ? 'conceptMissing' : 'goalMismatch', seed, initial, actualInput: handheldInput(initial),
    ...scene(session), frames, checks, decisions,
    actual: {seed, score: session.world.score, pieces: session.world.pieces, lines: session.world.lines, decisions: decisions.length}};
}

/** Pure, bounded inspection; sessions/results are JSON data and can be drawn by the host. */
export function inspectArcadeLearning(id, source) {
  const task = arcadeLearningSteps.find(item => item.id === id);
  if (!task) throw new RangeError('Unknown arcade learning step');
  if (typeof source !== 'string' || source.length > 4096) return {ok: false, code: 'limit', cases: [], actualResults: [], frames: [], actualInput: null, session: null, world: null, observe: null, game: task.game};
  let cases;
  try {
    cases = task.kind === 'output' ? outputCases(id, source)
      : id === 'strategy' ? arcadeStrategySeeds.map(seed => strategyCase(source, seed)) : [commandCase(id, source)];
  } catch (error) {
    const code = error.code || (['limit', 'command', 'waiting', 'lifecycle'].includes(error.message) ? error.message : 'syntax');
    const session = createArcadeLearningPreview(id);
    cases = [{ok: false, code, position: Number.isInteger(error.position) ? error.position : 0,
      checks: [], result: null, actual: {logs: []}, actualInput: handheldInput(session), frames: [{tick: 0, session: copy(session)}], ...scene(session)}];
  }
  const first = cases[0], ok = cases.length > 0 && cases.every(item => item.ok);
  return {ok, code: cases.find(item => !item.ok)?.code || null, cases, actualResults: cases.map(item => item.actual),
    frames: first?.frames || [], actualInput: first?.actualInput || null,
    session: first?.session || null, world: first?.world || null, observe: first?.observe || null, game: first?.game || task.game};
}
